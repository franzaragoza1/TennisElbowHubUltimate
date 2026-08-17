# Decisiones de diseño

Registro de decisiones no obvias, con su motivo. Ver también `docs/estructura.md` para
los hallazgos de reconocimiento de la fase 1.

## 2026-08-13 — `robots.txt` del foro y User-Agent del scraper

`https://www.managames.com/robots.txt` no restringe ninguna de las rutas que necesita el
proyecto (`OT_Rankings.php`, `OnlineTournaments.php`, `OT_ViewTournament.php`,
`OT_LastResults.php`). Las rutas bloqueadas son zonas del foro que no tocamos:
`posting.php`, `viewforum`, `viewtopic`, `search`, `profile`, `privmsg`, `ucp.php`,
`memberlist`, etc. Sitemap declarado: `https://www.managames.com/sitemap.xml`.

El scraper (`scripts/explore.ts`, y el futuro scraper de backfill) se identifica con un
User-Agent explícito, decisión del propietario del proyecto:

```
TE4TourBot/0.1 (+mailto:thelolosmusica@gmail.com)
```

**Por qué**: CLAUDE.md pide un User-Agent identificable con contacto para reducir la
probabilidad de bloqueo silencioso — si el operador del foro nota tráfico automatizado
inusual, puede escribir antes de bloquear sin más. Contacto elegido explícitamente
por el propietario del proyecto (no es el email personal usado para otras gestiones
del repo).

## 2026-08-13 — Challenge anti-bot no se activó en el reconocimiento

Las 8 peticiones de `scripts/explore.ts` (dos índices anuales, dos rankings, tres
cuadros, últimos resultados) se sirvieron directamente, sin pantalla de verificación
JS. No se necesitó intervención manual en esta sesión.

**Por qué importa**: no significa que el challenge no exista — CLAUDE.md avisa
explícitamente de que está ahí. Puede depender de volumen de tráfico, IP, o de
cabeceras que el navegador real de Playwright ya satisface por defecto. El manejo de
espera/reintento (`waitOutChallenge` en `scripts/explore.ts`) se mantiene para el
scraper de backfill por si aparece con un patrón de tráfico distinto (cientos de
peticiones en lugar de 8).

## 2026-08-13 — Base de datos: Neon desde ya, no PGlite ni Postgres nativo

Se usa Neon (Postgres gestionado) como base de datos tanto en desarrollo como el día de
producción, decisión explícita del propietario del proyecto. La cadena de conexión vive
en `.env` (fuera de git).

**Por qué**: es lo que CLAUDE.md sección 2 ya prevé para despliegue ("Vercel + Neon
inicialmente"); usarlo desde el principio evita mantener dos motores de base de datos
distintos (uno local, otro de producción) que podrían divergir sutilmente.

## 2026-08-13 — `category` y `surface` como texto libre, no el enum de CLAUDE.md

CLAUDE.md sección 3 sugiere un enum para `category` (`GS`, `M1000`, `500`, `250`,
`finals`). Los datos reales traen más variedad de la que ese enum cubre: `Grand Slam`,
`Masters 1000`, `500`, `250`, `CT 125/100/90/80`, `Future`, `Exhibition` (confirmado en
el backfill de la fase 2, 232 torneos reales). Igual para `surface`, nunca tuvo un enum
propuesto pero por el mismo motivo se guarda tal cual.

**Por qué**: forzar los valores reales a un enum más corto pierde matices y exige
mantener una tabla de mapeo cada vez que aparece una categoría nueva (`CT 90`, etc.).
Texto libre es más fiel a la fuente y no se rompe con datos que no anticipamos.

## 2026-08-13 — Reconciliación de `player_aliases` sin heurística difusa

CLAUDE.md sección 3 avisa de que la reconciliación de identidades de jugador "es un
problema real" y prevé que sea semiautomática. En la práctica, para la fuente `mana`
resultó ser mucho más simple: el `p=` de `OT_Player.php` y el `u=` de `memberlist.php`
son el mismo ID de usuario de phpBB (confirmado cruzando `CaptainCrazy` en dos páginas
distintas — ver `docs/estructura.md`), y ese ID es estable de por vida salvo que el
jugador se cree una cuenta nueva. La clave `(sourceId, externalId)` en `player_aliases`
basta; no hace falta comparar nombres por similitud.

**Por qué importa**: si en el futuro se añade una fuente sin un ID de usuario estable
(o si aparece un jugador con dos cuentas de foro distintas), sí hará falta la
heurística semiautomática que CLAUDE.md anticipaba — pero eso queda para el panel de
administración (fase 6), no se ha construido todavía.

## 2026-08-13 — Next.js 16 se instaló a mano, no con `create-next-app` directo en el repo

`create-next-app` se ejecutó en un directorio temporal aparte y los ficheros generados
(`next.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `package.json`) se fusionaron
a mano con lo que ya existía en la raíz del repo, en vez de dejar que el instalador
escribiera directamente sobre un `package.json`/`tsconfig.json` que ya tenían Drizzle,
Vitest y los scripts de scraping configurados.

**Por qué**: `create-next-app` no está pensado para añadirse a un proyecto Node ya
existente con contenido propio; instalar directamente arriesgaba sobreescribir
configuración de las fases 2-3. Fusionar a mano fue más lento pero seguro.

Dos cosas que hubo que arreglar después de la fusión:

1. **`next dev` añade automáticamente un bloque de instrucciones para agentes de IA al
   final de `CLAUDE.md`** (función nueva de Next.js 16, activada por defecto). Se
   desactivó con `agentRules: false` en `next.config.ts` — nuestro `CLAUDE.md` es la
   especificación permanente del proyecto (sección 8 del propio fichero), no un sitio
   donde herramientas externas deban escribir.
2. **Los imports relativos con extensión `.js`** (convención de `moduleResolution:
   NodeNext`, necesaria para que `tsx`/Node ejecuten `scripts/*.ts` y `parsers/*.ts`
   directamente) **rompían la compilación de Next** (su bundler busca un fichero
   `schema.js` real y no lo encuentra). Se comprobó que `tsx` resuelve igual de bien
   imports relativos *sin* extensión, así que se quitó la extensión `.js` de todos los
   imports relativos del proyecto y se cambió `tsconfig.json` a
   `moduleResolution: "bundler"` — un único tsconfig sirve para Next, los scripts y los
   tests.

## 2026-08-13 — Banderas de país: mapeo hecho a mano, no una librería de geocoding

`players.country` es texto libre escrito por cada usuario del foro: mayúsculas
inconsistentes, nombre de ciudad en vez de país, abreviaturas, y en varios casos texto
corrupto **ya en el HTML de origen** (confirmado grepeando el HTML crudo archivado, no
es un fallo nuestro de codificación) — p. ej. `TÃ¼rkiye` en vez de `Türkiye`. Son ~150
cadenas distintas entre los 553 jugadores cargados.

`lib/countryCodes.ts` mapea a mano las variantes que aparecen de verdad (repara la
codificación rota cuando es mecánicamente reversible, prueba el patrón "Ciudad - País")
contra un diccionario de highest-frequency real. Lo que no se reconoce sale sin
bandera — no rompe la página ni se inventa un país.

**Por qué**: una librería de geocoding completa sería mucho más código para resolver un
problema que, con datos reales, tiene cola larga de casos irrecuperables de todas
formas (ciudades sueltas como "Edinburgh", abreviaturas ambiguas como "SEA"). El
diccionario a mano cubre los casos frecuentes (Poland, USA, Spain, France...) que son
la inmensa mayoría de los jugadores, y es trivial de ampliar cuando haga falta.

## 2026-08-13 — Login falso + editor de avatar (demo, no auth real)

A petición explícita del propietario: un login sin contraseña (cookie con el
`players.id` directamente) para poder enseñar un editor de avatar antes de decidir
cómo se hace la autenticación real. Marcado como "Demo — sin contraseña real" en la UI
para que no se confunda con auth de verdad si esto se ve fuera de esta sesión de
trabajo.

- **`players.character`** (ya existía desde la fase 3, pensado justo para esto) guarda
  el JSON de opciones de DiceBear elegidas, no una imagen. Se regenera el SVG al vuelo
  en cada render — más barato que alojar imágenes y trivial de versionar/cambiar de
  estilo el día que haga falta.
- **DiceBear: hay que fijar `@dicebear/core` a la línea 9.x, no la última (10.x).**
  `@dicebear/avataaars` (paquete de estilo) todavía depende de `@dicebear/core@^9` como
  peer — instalar el core "latest" (10.5.0) rompe en tiempo de ejecución porque cambió
  la API pública (`createAvatar()` como función vs. las clases `Style`/`Avatar` de la
  v10). Confirmado antes de escribir código, no a base de prueba y error en producción.
- **La sesión no se lee en el layout raíz.** Leer la cookie ahí forzaría toda la web a
  renderizado dinámico por petición, deshaciendo la generación estática que ya
  configuramos para `/rankings` y `/players/[id]` (fase 4a/4b). `SiteNav` consulta su
  propia sesión contra `/api/session` en cliente — el layout y las páginas de datos
  siguen pudiendo generarse en estático.

## 2026-08-13 — El cuadro se reconstruye desde los partidos, no se guarda su posición

`matches` nunca guardó dónde cae cada partido dentro del cuadro (fila/columna) — solo
quién jugó, quién ganó y en qué ronda. Para `/tournaments/[id]` hacía falta reconstruir
el árbol completo para dibujar los conectores. Se comprobó contra datos reales (Perth
2026, editionId 176) que basta con emparejar el `winnerId` de una ronda con el
`player1Id`/`player2Id` de la ronda siguiente, recorriendo hacia atrás desde la Final —
ver `lib/bracket.ts` y su test. Un jugador que entra por bye (sin partido registrado en
la ronda anterior) simplemente no tiene conector por ese lado; no hace falta fabricar
una fila de "Bye" con datos que no tenemos.

**Los seeds nunca se guardaron** (`parsers/tournamentPage.ts` los extraía, `scripts/load.ts`
los descartaba) — se añadieron `player1Seed`/`player2Seed` a `matches` y se recargó
(idempotente, sin volver a tocar la red).

## 2026-08-13 — El parser de marcadores se quedaba corto con datos reales a escala

Construir el cuadro visual obligó a mirar el campo `outcome` de cerca, y salieron tres
formatos que `parsers/tournamentPage.ts` (fase 3) no reconocía — afectaban a **882
partidos, ~17% del total**:

- `WO` y `w.o` (mayúsculas / sin punto final) — variantes de walkover no cubiertas por
  el `if (scoreText === "w.o.")` original, literal y sensible a mayúsculas.
- `RL` — "Random Luck", jerga de la comunidad TE4 para un cruce que no llegó a
  jugarse (confirmado con el propietario del proyecto). No es walkover ni retirada ni
  descalificación — es su propia categoría, así que se añadió `'random'` al enum
  `Outcome` en vez de forzarlo a encajar en otra existente.

Las fixtures de la fase 1 y los tests de la fase 3 no lo pillaron porque solo cubrían
un puñado de torneos de muestra — CLAUDE.md ya avisaba de esto en el plan de la fase 3
("es probable que aparezca algún caso que las fixtures no cubren"). Arreglado con tests
nuevos (`parseScoreText` ahora exportado y probado directamente) y una recarga completa
(idempotente). Queda un único caso sin resolver, 1 de 5319 partidos
(`"(8)6/7 6/4 6/2"`, el tie-break aparece antes que el marcador en vez de después) — no
compensa complicar el regex por un caso aislado.

## 2026-08-13 — La paleta la fija la marca propia, no las capturas de la ATP

CLAUDE.md §6 fija una paleta muestreada de capturas de atptour.com (`--navy-900 #001E5A`,
`--lime #E1FF00`), pero decía explícitamente "ajústala con cuentagotas sobre las imágenes
antes de fijarla". Al llegar el logotipo propio (`public/assets/logo.png` y `header.png`)
resultó que su navy es `#02005C` y su lime `#BDE700` — cerca, pero de tono distinto, y
puestos juntos se nota.

**Manda el logotipo**: es el elemento fijo e irrepetible del sitio, mientras que la
paleta de referencia solo era una aproximación a un aspecto. Se movieron `--navy-900` y
`--lime` a los valores de marca y se recalcularon `--navy-800`/`--navy-700` sobre el tono
nuevo. Se añadió `--paper-tint` como fondo de página, porque con todo en blanco puro las
tablas no se recortaban de nada y la web se leía como una hoja en blanco.

El wordmark es navy con filete lime, así que **sobre fondo navy es ilegible**: de ahí que
la cabecera sea una banda lime (reproduciendo `header.png` con las piezas sueltas, vía
`components/nav/BrandBar.tsx`) con la barra de navegación navy debajo, en vez de meter el
logotipo dentro de la barra oscura.

## 2026-08-13 — El fondo del avatar no se elige

`lib/avatar.ts` ofrecía 7 fondos a elegir. Con avatares distintos por jugador, la columna
del ranking quedaba desordenada. El fondo pasa a ser siempre el lime de marca
(`LOCKED_AVATAR_BACKGROUND`), **forzado al renderizar** y no solo en el editor, para que
los avatares guardados antes de la regla se normalicen solos sin migración. El fallback de
iniciales (`PlayerAvatar`) usa el mismo lime, si no la columna seguiría mezclando fondos.

## 2026-08-13 — Fuera la columna "Torneos" del ranking; la Race queda pendiente

La columna contaba ediciones distintas en `matches`, que solo cubre 2021 en adelante: a
cualquiera que compitiera antes le salía un número corto, y el dato no decía gran cosa.
Se sustituye por datos que sí son fiables dentro de nuestra ventana: mejor ranking
histórico, balance del año y títulos.

La alternativa que se valoró —los puntos de la **Race**— existe en la fuente
(`OT_Rankings.php?Week=…&Race=1`, y un tercer tipo `Race=2` = Challenger) pero **no está
en nuestro archivo**: el backfill de la fase 2 solo bajó `Race=0` (Entry). Traerla no es
trabajo de frontend: pide columna nueva en `ranking_snapshots` para el tipo de ranking,
una pasada de scraping de las 166 semanas y recarga. Queda anotado como fase aparte.

## 2026-08-13 — La interfaz pasa al inglés

La web estaba en español, pero el tour es internacional (los propios datos traen jugadores
de Chile, Uruguay, Turquía, Países Bajos, Italia, Croacia, Japón…) y la fuente publica en
inglés. Toda la interfaz pasa a inglés, incluidos `<html lang>` y el formato de cifras
(`toLocaleString("en-US")`, separador de millar con coma). **Los comentarios del código y
esta documentación siguen en español**, que es el idioma de trabajo del proyecto.

## 2026-08-13 — Párrafo de contexto del H2H: los hechos los calculamos nosotros

El H2H incluye un párrafo corto de contexto redactado por un modelo (Groq,
`llama-3.3-70b-versatile`). Tres decisiones que lo hacen viable:

**El modelo redacta, no analiza.** `lib/h2hNarrative.ts` calcula los hallazgos en
SQL/TS (quién lidera, reparto por temporada, racha viva, splits por superficie y
categoría, finales entre ambos) y le pasa ese objeto ya masticado. Si se le mandan los
partidos en crudo pidiéndole conclusiones, inventa. Lo comprobamos: la primera versión
pasaba cadenas preformateadas (`"Jirafalox 1-0 Franky"`) y el modelo las leyó como sets,
publicando "Franky Franchicha has not won a set on Clay or Indoor Concrete" — una frase
entera falsa. Con claves explícitas (`matchesWonBySurface`) y valores numéricos, no.

**Guardarraíl determinista**: `everyNumberIsBackedByFacts` extrae toda cifra del texto
generado y exige que aparezca en los hechos de entrada; si no, se descarta el párrafo.
No cubre afirmaciones sin números, pero corta en seco el fallo más probable.

**Caché en base de datos** (`h2h_narratives`), no una llamada por visita: hay ~152.000
parejas posibles y el texto solo cambia cuando esos dos vuelven a jugar. El
`fingerprint` es número de cruces + id del último cruce, así que un partido nuevo
invalida la entrada y cualquier otra visita reutiliza. Se renderiza dentro de
`<Suspense>` y si falla algo (sin clave, API caída, timeout de 8 s, cifra sin respaldo)
la sección simplemente no se pinta.

Se exigen 2 cruces como mínimo: por debajo de eso no hay nada que contar que no diga ya
la tabla de al lado.

## 2026-08-13 — Noticias: puerta de admin propia y carril con scroll-driven CSS

**El panel no cuelga del login de jugadores.** `lib/session.ts` es una sesión de demo:
`loginAsPlayer(id)` escribe la cookie sin pedir contraseña, así que cualquiera puede
entrar como cualquiera. Con la web ya pública, colgar de ahí la publicación de noticias
habría dejado el panel abierto de par en par. `lib/adminSession.ts` es independiente:
contraseña en `ADMIN_PASSWORD`, cookie con caducidad propia firmada por HMAC con
`ADMIN_SECRET` y comparación en tiempo constante. Sin estado en servidor.

El gate vive en el grupo de rutas `app/admin/(panel)/layout.tsx`, y `/admin/login` queda
fuera del grupo para no cerrarse con su propia puerta. **Cada Server Action revalida por
su cuenta** (`requireAdmin()`): un layout no protege un endpoint, y los Server Actions
son endpoints públicos.

**Jugadores etiquetados en tabla aparte** (`news_players`) y no como columna en `news`:
una crónica menciona normalmente a los dos de la final, y la ficha de jugador necesita la
consulta inversa ("noticias donde sale este jugador"), que pidió el propietario.

**El carril usa animaciones dirigidas por scroll en CSS puro** (`animation-timeline`),
sin JavaScript ni librería. La barra de progreso vive fuera del contenedor con scroll, así
que `scroll(nearest)` habría resuelto al scroll vertical de la página: se nombra la línea
de tiempo (`scroll-timeline: --news-rail inline`) y se expone con `timeline-scope` desde
la sección. Todo dentro de `@supports` y `prefers-reduced-motion: no-preference`; sin
soporte queda un carril con scroll-snap normal.

Es **la excepción acordada** a la regla de CLAUDE.md §6 ("la animación se concentra en la
navegación entre rondas del cuadro"), pedida expresamente para esta sección.

## 2026-08-13 — Vuelta de tuerca visual: tipografía, retícula, acento y avatar

Cuatro cambios pedidos juntos, todos con el mismo motivo de fondo: "está casi bien y no
lo está" ya no bastaba una vez la web tenía contenido real.

**Quicksand para todo el texto, Inter reservado a las cifras.** Antes de aplicarla se
comprobó a nivel de fichero TTF (lectura directa de las tablas `fvar`/`GSUB`/`GPOS`) que
Quicksand **no declara la feature `tnum`** y que sus dígitos son proporcionales de
fábrica (el "1" mide 363/1000em, el "0" mide 588) — aplicarle
`font-variant-numeric: tabular-nums` no habría hecho nada, y las columnas de ranking,
puntos y marcadores habrían bailado al cambiar de valor, justo lo que CLAUDE.md §6
prohíbe sin excepción. La clase `.tour-numeric` ahora cambia de familia a Inter (que sí
trae `tnum`) además de aplicar la feature — es la única parte del sitio que no va en
Quicksand, y pasa desapercibido porque son columnas de números, no texto corrido.
Quicksand además solo llega a peso 700 (no 800 como Inter), así que `.text-headline`
bajó de 800 a 700.

**Retícula única (`tour-container`, en `globals.css`).** Había cinco anchos de
contenedor distintos por el sitio (1280/1100/1000/900/760px) con márgenes inconsistentes
(`px-4`, a veces sin `sm:px-6`), así que la cabecera navy de cada página y el contenido
de debajo no compartían borde izquierdo — se notaba especialmente en `/rankings`. Ahora
hay un solo sitio donde tocar el ancho, con tres variantes (`wide` por defecto, `medium`
para tablas densas, `reading` para texto corrido) y un margen lateral progresivo
(1.25rem → 2rem → 3rem) que es la sangría que faltaba. El carril de noticias es el único
que sangra a propósito hasta el borde de pantalla (para dejar ver que hay más
contenido), pero su primer elemento arranca alineado con el resto vía
`padding-inline: max(gutter, (100% - 1200px) / 2 + gutter)`.

**El lime deja de ser el acento de UI**, sustituido por `--accent-500: #00d9c0` (cian).
Se probaron tres alternativas mostrando muestras reales sobre navy antes de decidir.
El lime como *token de color* (`--lime`) sigue existiendo, pero ahora solo lo usa
`BrandBar`: `public/assets/logo.png` y `ball.png` son PNG con ese verde grabado en los
píxeles del logotipo, así que la banda de marca tiene que quedarse en ese tono exacto o
el logotipo desentona contra su propio fondo. Es la única excepción documentada.

**El avatar cambia de Avataaars a Personas.** Avataaars es una caricatura de rasgos muy
exagerados que leía como app infantil y rompía la inmersión de un sitio que se quiere
"oficial"; se generó una hoja comparativa con 9 estilos de DiceBear (mismos 6 nombres
reales del tour, recortados en círculo sobre el fondo de marca, exactamente como se ven
en el ranking) para elegir a la vista y no a ciegas. Personas ganó: vector plano con
proporciones adultas, sin la lectura de dibujo animado.

Al cambiar de estilo, los 5 jugadores que ya tenían avatar guardado con el esquema de
Avataaars (`top`, `eyebrows`, `clothing`, `clothesColor`, `accessories` — campos que no
existen en `AvatarOptions` de Personas) quedaron con `character = NULL`: los valores de
enum antiguos (`"eyeRoll"`, `"shortFlat"`...) no son válidos para Personas, y aunque
DiceBear no lanza error con un valor desconocido, el resultado no se parecería a lo que
esos jugadores eligieron — mejor el fallback limpio de iniciales que un avatar
aleatorio sin sentido. Se resetean vía `UPDATE players SET character = NULL`, no
requiere migración de esquema porque `character` siempre fue texto libre.

## 2026-08-13 — Segunda vuelta de avatar: Personas tampoco convencía, header nuevo sin bola

Feedback directo tras ver Personas en producción: seguía leyendo "cara de muñeco".
Se generó una segunda hoja comparativa, esta vez con estilos deliberadamente distintos
entre sí (de "sin cara" — Initials, Thumbs, Bottts, Icons, Shapes — a caras ilustradas
de distinto grado de estilización), 16 en total, mostrada antes de decidir. Se eligió
**Notionists**: retrato lineal en blanco y negro, trazo suelto tipo caricatura editorial.

Notionists **no tiene ningún campo de color** (a diferencia de Avataaars/Personas) — es
dibujo monocromo puro, así que `AvatarEditor` perdió sus `ColorSwatches`. Sus rasgos
además son variantes numeradas sin nombre descriptivo (`variant01`..`variantNN`), no
palabras como "shortFlat"; se muestran humanizadas ("Variant 01") porque no hay nada
mejor que mostrar. Ojo con `hair`: no es una secuencia limpia `variant01..64`, son 63
variantes más una opción especial `"hat"` al final — generarla con `Array.from` habría
producido un `variant64` inexistente. Las listas de `AVATAR_CHOICES` se copiaron del
esquema real del paquete en vez de derivarse por rango, para evitar ese error en
cualquier campo.

Los 2 jugadores con avatar guardado en el esquema de Personas se resetearon a `NULL` por
el mismo motivo que en el cambio anterior: los campos no son compatibles entre estilos.

**El header.png se sustituyó** (1920×380, fondo cian en vez del lime original) y **ya
no incluye la bola TE4**, solo el wordmark. Se decidió no recolorear la bola vieja
(quedaba como parche automático) ni mantenerla: `BrandBar` pasa a mostrar solo
`logo.png`, alineado a la derecha como en la referencia. Casualidad útil: el cian exacto
del `header.png` nuevo (`#00dac0`) es, a efectos prácticos, el mismo acento que ya tenía
el resto del sitio (`--accent-500: #00d9c0`) — la banda de marca deja de necesitar un
token de color aparte y usa directamente `bg-accent-500`. El token `--lime` se eliminó
por completo de `globals.css`: ya no lo usa nada.

El pie de página también llevaba la bola (como icono junto al texto "XKT World Tour");
se quitó por coherencia y porque el `ball.png` extraído era del header viejo, en lime.
El wordmark (`logo.png`) tampoco sirve ahí: es un PNG navy que sobre el propio fondo
navy del pie se volvería invisible — se dejó el texto plano, que no tiene ese problema.

## 2026-08-14 — Toggle claro/oscuro y leaderboard "competitivo": se abandona el mandato de superficie única de CLAUDE.md §6

CLAUDE.md §6 pedía **una sola superficie fija por sección** (navy oscuro para nav/hero/H2H,
paper claro para tablas densas), sin concepto de tema elegible por el usuario. Petición
expresa del propietario: mover la web hacia una estética "esports competitivo" con
**toggle claro/oscuro real, oscuro por defecto**, aplicado a todo el sitio (no solo a
Rankings). Es un cambio de rumbo deliberado sobre lo escrito en la sección 6, no una
lectura alternativa de la misma — queda anotado aquí en vez de editar la sección
retroactivamente, para que quede constancia de cuándo y por qué cambió.

**Por qué no se pudo hacer solo invirtiendo `--navy-900`:** ese token hacía doble
función — fondo de la marca (`bg-navy-900` en nav, masthead, H2H, cabecera de jugador,
siempre oscuro, fijo) y color de texto de contenido (`text-navy-900` en tablas y
tarjetas sobre `--paper`, el que sí tenía que invertir con el tema). Invertirlo entero
habría vuelto invisible el texto de la marca o vuelto claro el nav en modo claro. Se
separó en dos: `--navy-900/800/700` se quedan fijos (marca, no cambian con el tema) y
se creó `--ink` como token nuevo, exclusivamente para texto de contenido sobre
`--paper`/`--paper-tint`, que sí es sensible al tema. El cambio de `text-navy-900` →
`text-ink` se aplicó de forma mecánica (sed) en 39 ficheros; se revisaron a mano los
tres sitios donde el texto iba sobre un fondo `bg-accent-500` fijo (chip de temporada en
`SeasonTabs`, botón de `H2HPicker`, iniciales de `PlayerAvatar`) porque ahí el
contraste tiene que ser fijo también — se quedaron en `text-navy-900` literal, no
`text-ink`, precisamente porque el fondo sobre el que están no cambia con el tema.

**Tokens de contenido que sí invierten con el tema** (`--paper`, `--paper-tint`,
`--rule`, `--muted-label`, `--ink`, y los de shadcn `--background`/`--card`/etc.): viven
en `:root` con sus valores OSCUROS por defecto — oscuro es el tema por defecto del
sitio, no una preferencia que haya que detectar — y `:root[data-theme="light"]` los
pisa con los valores claros que ya existían. `--navy-900/800/700`, `--accent-500` y el
resto de la paleta de marca no tienen entrada bajo `[data-theme="light"]`: son los
mismos en los dos temas a propósito.

**Sin parpadeo de tema equivocado:** `components/theme/ThemeScript.tsx` es un
`<Script strategy="beforeInteractive">` que lee `localStorage` y fija
`data-theme` en `<html>` antes del primer pintado — si no hay preferencia guardada,
oscuro (nunca se consulta `prefers-color-scheme`, porque el default del sitio es oscuro
pase lo que pase con la preferencia del sistema). `components/theme/ThemeToggle.tsx`
alterna el atributo y lo persiste en `localStorage`; vive en `SiteNav`, junto al
indicador de "Admin Mode" (ver más abajo).

**Rankings como leaderboard competitivo:** se añadió `--glow-500` (cian más saturado
que `--accent-500`, pensado para leer como acento "neón" sobre el obsidiano del tema
oscuro) y `RankingTable` ahora resalta el corte de clasificación a Finals: las 8
primeras filas llevan una franja izquierda y un tinte de fondo en `--glow-500`, su
número de puesto va en una insignia circular en vez de texto plano, y justo debajo de
la fila 8 se inserta una línea divisoria con la etiqueta "Finals cutoff — top 8
qualify". El corte está en una constante (`FINALS_CUTOFF = 8`) en el propio componente,
no en base de datos: es un dato de formato de las Tour Finals (ver el módulo de
`lib/finals/`), no un dato de ranking.

**Alcance de este cambio:** la infraestructura del tema (script, toggle, tokens) es
del sitio entero, y la mayoría de las páginas de contenido heredan el tema
automáticamente porque ya usaban `bg-paper`/`border-rule`/`text-muted-label` de forma
consistente antes de este cambio — no hizo falta tocarlas una a una. El rediseño
explícito de "leaderboard competitivo" (insignias, franja de corte, tono neón) se
aplicó solo a `RankingTable`, que es la superficie que se pidió expresamente subir de
nivel; el resto de tablas y tarjetas heredan el tema pero no ese tratamiento extra.

## 2026-08-14 — Indicador "Admin Mode" en la nav: el panel no estaba roto, solo era invisible

El propietario reportó el panel de admin como "missing or inaccessible". No lo estaba:
`ADMIN_PASSWORD`/`ADMIN_SECRET` estaban configurados en `.env`, `/admin/login` y el
grupo de rutas `(panel)` funcionaban correctamente y sin conflictos de enrutado. El
problema real era más tonto: `SiteNav` no tenía ningún enlace a `/admin`, así que solo
se podía llegar escribiendo la URL a mano. Se añadió `app/api/admin-session/route.ts`
(expone `isAdmin()` a un componente cliente, porque la cookie es httpOnly y `SiteNav`
no puede leerla directamente) y un indicador "Admin Mode" en la nav, visible solo
cuando `isAdmin()` es cierto, que enlaza a `/admin`.

## 2026-08-14 — Bug real de navegación: mismatch de hidratación por el script del tema

El propietario reportó que a veces un clic en la nav no navegaba, y había que hacer
clic en otra página primero. Se reprodujo con un driver de Playwright propio
(`chromium-cli` no estaba disponible en este entorno Windows) contra el dev server
real, con captura de `console`/`pageerror` — no se adivinó a partir del código.

Causa confirmada: `components/theme/ThemeScript.tsx` (añadido en la sesión anterior
para el toggle claro/oscuro) fija `data-theme` en `<html>` con un
`<Script strategy="beforeInteractive">`, ANTES de que React hidrate. El HTML que
manda el servidor no tiene ese atributo — React lo detecta como mismatch en la
hidratación del nodo raíz y lo reporta como "this won't be patched up" en consola.
Sin `suppressHydrationWarning` en `<html>`, ese mismatch en el nodo raíz podía dejar
el árbol en un estado donde los manejadores de clic de algunos `Link` no quedaban
bien enganchados tras la primera hidratación — de ahí el "hace falta un clic de más".

Arreglo: `suppressHydrationWarning` en el `<html>` de `app/layout.tsx` — es el patrón
estándar para scripts de tema que tocan el DOM antes de hidratar (el mismo que usa
`next-themes`). Verificado con el mismo driver: antes del arreglo, el mismatch salía
en consola en cada carga; después, cero errores en 10+ navegaciones, incluyendo clics
inmediatos tras cargar, clics en ráfaga sin esperar, y clics que interrumpen una
navegación en curso.

## 2026-08-14 — Tipografía: Quicksand fuera, Inter para todo el sitio

Petición directa: el sitio se leía "goofy" (Quicksand es una fuente redondeada,
pensada para algo desenfadado, no para un leaderboard competitivo). Se quita
Quicksand del todo — dejó de usarla nada en cuanto `--font-sans` pasó a apuntar a
Inter — y de paso se vuelve a lo que pedía CLAUDE.md §6 desde el principio:
ExtraBold (800) con tracking -0.02em en `.text-headline`, que Quicksand no podía dar
porque su eje de peso topa en 700. Inter ya estaba cargada (se usaba para
`.tour-numeric`, por la feature `tnum` que Quicksand no tiene), así que no hizo falta
ningún fichero de fuente nuevo — solo dejar de cargar el `.ttf` de Quicksand
(126 KB, borrado de `public/font/`) y limpiar `lib/fonts.ts`.

## 2026-08-14 — Logos de torneo: tabla verificada a mano, no un emparejador automático

El propietario añadió `XKTTBSTD/` (fuera de git, 201 carpetas con `Icon.png` +
`Court.jpg` + `Hud` por torneo, 60 MB) a la raíz del repo. Solo el `Icon.png` de cada
carpeta hacía falta — se copió aplanado a `public/tournament-logos/<slug>.png`
(77 ficheros, 1.1 MB en total) y se descartó el resto.

El problema real era el emparejamiento: `events.displayName` en base de datos son
85 nombres simples ("Madrid", "Adelaide"...), pero `XKTTBSTD` tiene variantes ATP/WTA
por ciudad, algunas dobles ("Adelaide 2 ATP 250"), genéricos sin categoría ("Madrid"
a secas) y unas cuantas erratas propias (`S'Hertogenbosh`, sin la "c" final). Un
emparejador automático en tiempo de ejecución (normalizar y buscar el más parecido)
se probó primero para explorar el problema, pero adivinar mal pone el escudo
equivocado en un torneo — así que la tabla final (`lib/tournamentLogos.ts`) es un
diccionario fijo, verificado a mano entrada por entrada contra las carpetas reales,
no la salida del emparejador. Los pocos eventos sin carpeta razonable (Albacete,
Ankara I, Beach House Exho, Montevideo I, Perth, Rome — carpeta vacía —, Verona) se
quedan sin logo a propósito, en vez de forzar una coincidencia dudosa.

Grand Slams: pista principal, sesión de noche cuando existe esa variante (Australian
Open y Roland Garros la tienen — instrucción directa del propietario, con
"RG Philippe Chatrier Night" corrigiendo un paréntesis de más que traía el mensaje
original). Wimbledon y US Open no tienen variante de noche en `XKTTBSTD`, así que
usan su pista central de día ("Wimbledon Center Court Day", "US Open Arthur Ashe").

## 2026-08-14 — Tarjeta de torneo: expansión al pasar el ratón con `grid-template-rows`

Para el "expand" al hacer hover pedido en la tarjeta de torneo, la técnica es
`grid-template-rows: 0fr` → `1fr` en transición (con el contenido dentro de un
`overflow-hidden`), no un `max-height` fijo adivinado: anima a la altura real del
contenido sin necesidad de conocerla de antemano, y sin JavaScript. La información
que aparece (finalista y marcador de la final) ya salía de `getRecentTournaments`/
`getTournamentsByYear` con una sola query ampliada (un JOIN más a `players` por el
perdedor de la ronda 'F'), no una consulta nueva por tarjeta.

## 2026-08-14 — Rankings vs Race: se importa de Mana Games, no se calcula aquí

El "FINALS CUTOFF" salía en el ranking oficial, que es el equivocado: Mana Games
publica dos rankings — el de siempre (`OT_Rankings.php?Race=0`) y la Race
(`OT_Rankings.php?Race=1`, solo puntos de la temporada en curso), y es la Race la que
decide plaza en las Tour Finals. Se pidió explícitamente NO calcular la Race
localmente (sumar "puntos ganados este año" a partir de lo ya importado no
reproduciría el número real de Mana Games — una clasificación rolling de 52 semanas y
una race de año natural no son la misma resta) — se importa igual que el ranking
oficial, mismo mecanismo, mismo respeto por CLAUDE.md §4 ("no se calcula nada").

**Esquema**: `ranking_snapshots` gana una columna `kind` ('official' | 'race',
default 'official' — así que las ~167 semanas ya importadas no cambian de
significado) en vez de una tabla aparte, porque es la misma forma de fila con el
mismo origen. El índice único pasa a incluir `kind`. Toda consulta existente que leía
`ranking_snapshots` sin filtrar (perfil de jugador, H2H, `/rankings`, viudo de la
home) se revisó una por una y se le añadió `kind = 'official'` explícito — si no,
en cuanto hubiera filas Race importadas se habrían mezclado con las oficiales en
sitios donde nunca debieron aparecer.

**Scraper**: `scripts/backfill.ts` ya descubre la lista de semanas desde el
desplegable de `OT_Rankings.php` y las encola con `Race=0`; ahora encola también cada
semana con `Race=1`, asumiendo (sin confirmar todavía) que la Race comparte el mismo
calendario de semanas que el oficial — es la lectura más razonable de la URL (mismo
script, mismo parámetro que cambia de valor), pero no se ha visto una página Race real
todavía. Se reseteó a mano la fila `ranking_index` de la cola (`data/scrape-
queue.sqlite`, estaba en 'done' de la pasada anterior) para que el próximo
`npm run backfill` vuelva a visitar el índice y encole las URLs Race nuevas — las 405
páginas ya archivadas no se re-descargan (`INSERT OR IGNORE` + URL única).

**Parser**: `scripts/load.ts` reutiliza `parseRankingPage` tal cual para las páginas
Race — no se escribió un parser aparte porque no hay una muestra real de HTML Race
con la que verificarlo (CLAUDE.md §5: "la estructura de estas páginas la averiguas tú
antes de escribir un solo parser", y aquí no se ha podido). Si la plantilla Race
resulta distinta a la oficial, esto falla alto y por fichero (Zod + try/catch ya
existentes), nunca en silencio ni a medias. `kind` se decide por el nombre del
fichero archivado (`...-race-1.html` vs `...-race-0.html`, que pone `slugify()` en
backfill.ts a partir de la URL), no por nada dentro del HTML.

**Por qué no se scrapeó ya**: no hay contexto persistente de Chromium en esta máquina
(`.playwright/` no existe — el backfill original que ya está en `data/raw/mana/` se
corrió en otro sitio o en un perfil que no sobrevivió). Sin él, la primera visita a
`managames.com` vuelve a pedir resolver el challenge anti-bot a mano, en una ventana
de Chromium real — visitarlo por script sin esa ventana sería justo lo que CLAUDE.md
§5 pide no hacer. Hace falta que quien tenga acceso a esa sesión ejecute
`npm run backfill` (encolará ~167 páginas Race nuevas, hora y media a 8 s cada una) y
después `npm run load`.

## 2026-08-14 — La Race solo enseña su semana más reciente, sin selector de semana

Pedido explícito: a diferencia del ranking oficial (donde navegar el histórico
semana a semana tiene valor real, por eso `RankingFilters` deja elegir), la Race no
tiene ese mismo valor histórico — lo que importa es dónde está la carrera a las
Finals AHORA MISMO, no cómo estaba hace 10 semanas. `RankingFilters` gana un
`showWeekPicker` (por defecto `true`, para no tocar la vista oficial) y
`/rankings?view=race` ignora el parámetro `week` de la URL directamente en el
servidor — no solo se oculta el selector en el cliente, la página tampoco atiende la
petición si alguien construye la URL a mano.

## 2026-08-14 — `scripts/backfill.ts` acepta `--week`/`--from`/`--to` para no repetir el histórico completo

Pedido explícito: poder relanzar el scraper para una semana suelta o un rango, en vez
de barrer siempre 2021-hoy — útil cuando solo hace falta traer una semana que quedó
mal, o adelantarse a la incremental semanal (fase 7) sin escribirla todavía.

**Rankings**: trivial, el `<select name="Week">` de `OT_Rankings.php` ya da valores
`AAAA-WW` explícitos (`docs/estructura.md` §2) — basta con filtrar la lista antes de
encolar `Race=0`/`Race=1`.

**Torneos**: menos obvio, porque el índice anual (`OnlineTournaments.php?Archive=<año>`)
no tiene URL por semana, solo por año. Pero sí lleva la semana de cada torneo *dentro*
de la tabla: una celda `<td class="Title">Week N:</td>` en la primera fila de cada
bloque semanal, con las filas siguientes de esa misma semana usando
`<td class="Hidden">` en su lugar (`docs/estructura.md` §1). `extractArchiveTournamentLinks`
ahora "arrastra" ese número hacia abajo fila a fila (igual que tendría que hacer un
lector humano de la tabla) y devuelve `{url, isoWeek}` en vez de solo `url`; el filtro
se aplica después de conocer el año (que sí viene en la URL del índice) y la semana.
Esto significa que **para filtrar por semana igual hay que descargar el índice anual
entero** de cada año implicado (no hay atajo para pedir solo una semana al foro), pero
eso es una sola página por año, no 70.

**Cola no se vacía al filtrar**: `seedQueue` (antes `seedIfEmpty`) solo hacía sembrado
completo si la cola estaba vacía. Con un filtro de semana, ahora siembra los índices
necesarios (`INSERT OR IGNORE`, así que no pisa nada) aunque la cola ya tenga cientos
de filas `done` de un backfill previo — permite pedir semanas sueltas después de un
histórico completo sin tocar lo ya descargado.

Uso: `npm run backfill -- --week=2026-32` o `npm run backfill -- --from=2026-30 --to=2026-35`.

Añadido después, mismo pedido: `--official-only` para saltarse `Race=1` del todo cuando
solo hace falta el ranking de siempre — antes el filtro de semana ya encolaba las dos
variantes juntas sin forma de pedir solo una.

Añadido una tercera vez: `--tournament=<Trn>` para un torneo suelto (p. ej. una recarga
puntual de uno que quedó mal, sin querer volver a barrer la semana entera). A
diferencia de `--week`, aquí no hace falta pasar por ningún índice anual — el `Trn=` ya
ES la URL completa (`OT_ViewTournament.php?Trn=<id>`), así que `seedQueue` la encola
directamente. Modo aparte, no compatible con `--week`/`--from`/`--to`/`--official-only`:
mezclarlos no tiene un significado claro (¿un torneo suelto dentro de un rango de
semanas, para qué sirve el rango entonces?), así que se rechaza explícitamente en vez
de adivinar cuál gana.

## 2026-08-14 — Bug real: partidos con enlace al hilo del reporte se perdían en silencio

Reportado por el propietario tras usar `--tournament=2091` (Montreal 2026, en curso al
archivarlo): el cuadro salía roto, con tarjetas fusionadas y rondas que no encajaban.
Investigado contra el HTML real archivado, no adivinado.

**Causa**: algunas celdas del cuadro traen un `<a>` EXTRA al hilo del foro con el
reporte del partido (icono `topic_read.png`) **antes** del `<a>` del jugador:

```html
<td rowspan="4">
  <a href="topic-38559.php"><img src="…/topic_read.png"></a>
  &nbsp;
  <a href="OT_Player.php?p=60926&d=0">Bartek</a> (30)
  <br><span class="score">6/0 6/0</span>
</td>
```

`extractCell()` (`parsers/tournamentPage.ts`) cogía `$td.find("a").first()` — con esta
celda, coge el icono (sin texto, sin `p=`) en vez del jugador. Sin `externalId`, la
celda se leía como "sin jugador" (`player: null`), y `extractMatchesFromTable` solo
crea un partido si AMBOS entrantes tienen `player` no nulo — así que el partido se
descartaba entero, sin avisar ni romper nada visiblemente: por eso "algunos partidos no
se parsean" y el cuadro se ve con huecos y conectores que no cuadran, en vez de dar un
error claro.

**No es un caso aislado de un jugador**: al perderse un partido, el jugador que lo ganó
queda sin "padre" en el árbol reconstruido (`lib/bracket.ts`), así que TODA su
progresión posterior también sale mal posicionada (de ahí las tarjetas visualmente
fusionadas que enseñó el propietario) — un solo `<a>` de más rompía el cuadro entero
para esa rama, no solo una celda.

**Alcance**: solo 1 de los 234 ficheros de torneo archivados trae este patrón (Trn=2091,
20 celdas afectadas) — parece un icono nuevo de "hay reporte del partido en el foro",
probablemente solo aparece en torneos recientes/en curso con hilos de resultado activos.
Como la incremental semanal (fase 7) siempre está tocando torneos recién jugados, esto
volverá a aparecer — el arreglo no es solo para este torneo suelto.

**Arreglo**: `extractCell` busca el enlace por `href*="OT_Player.php"` en vez de por
posición (`$td.find('a[href*="OT_Player.php"]').first()`) — el enlace del jugador
siempre tiene esa forma, así que ignora cualquier otro `<a>` decorativo que se cuele
delante. Fixture nuevo `parsers/__fixtures__/draw-96-topic-link.html` (el HTML real
archivado de Trn=2091, sin recortar) con un test que fija la progresión completa
(R1:11, R2:32, R3:16, R4:8, Q:4, S:2, F:1 — limpia, cada ronda la mitad de la anterior
a partir de R2) y comprueba dos casos concretos que se habían perdido: RyGuy4696 pierde
R3 6/1 6/1 (antes no tenía ni el partido), y el campeón (Gyrmik) tiene las 6 rondas
completas en vez de solo Q/S/F.

**No hizo falta re-scrapear nada**: el HTML crudo ya archivado es la fuente de verdad
(CLAUDE.md §5) — `npm run load` reparsea TODO lo que hay en `data/raw/mana/` desde
disco y borra+reinserta los partidos por edición (`scripts/load.ts`), así que arreglar
el parser y volver a cargar bastó. Trn=2091 pasó de 42 a 74 partidos correctamente
reconstruidos; el resto del archivo (233 ficheros) no tenía este patrón y no cambió.

## 2026-08-14 — "Recent activity" del jugador, agrupado por torneo: solo lo que hay dato real detrás

Petición con imagen de referencia (estilo ATP): tarjeta por torneo con insignia de
categoría, nombre, línea "Ciudad, País | Fecha | Superficie", tabla Rd/Opponent/Score
por torneo, y un pie "Points: X, ATP Ranking: Y, Prize Money: Z".

**Comprobado antes de construir nada** (`db/schema.ts`, `docs/estructura.md` §1 y §3):
no existe ciudad/país de sede en ningún sitio (`events`/`editions` no lo modelan, y el
índice anual tampoco lo publica — solo Name/Competition/Draw/Surface/Category/Queue/
Winner/Runner Up), no hay ranking-en-el-momento-del-torneo, y no hay "Prize Money" en
ninguna página del foro (el tour es de un juego, no ATP real). Los tres campos del pie
de la imagen de referencia se quedan fuera **por no inventarlos**, no por olvido.

**Lo que sí hay y se usa**: `editions.category`/`surface`/`weekStartDate` (esta última
sí está poblada, confirmado con consulta directa) para la insignia y la línea de
fecha · superficie; `matches.round`/`player1Seed`/`player2Seed`/`outcome` y la tabla
`sets` (antes solo la usaba el cuadro de torneo) para Rd/Opponent/Score con el mismo
superíndice de tie-break que CLAUDE.md §6 pide para el cuadro — se extrajo la lógica de
`components/tournament/MatchCard.tsx` a `lib/matchScore.ts` (`scoreFromPerspective`)
para no duplicarla entre el cuadro y esta vista nueva.

**El pie no es "Points/Ranking/Prize Money" sino un resumen honesto**: "Champion" /
"Runner-up" / "Lost in {ronda}", derivado del último partido registrado del jugador en
ese grupo. Si el último partido registrado es una VICTORIA en una ronda que no es la
Final, no se dice nada — no hay forma de distinguir "el torneo sigue en curso" de "el
límite de 50 partidos recientes cortó la lista a media altura", y afirmar cualquiera de
las dos sería inventar.

**Agrupación por `editionId`, no por (year, isoWeek)**: hay semanas con más de un
torneo a la vez (Los Cabos + Atlanta + Prague la misma semana, ya documentado en
`docs/estructura.md` §1) — agrupar por semana habría mezclado dos torneos distintos en
una sola tarjeta.

**Pendiente si se quiere de verdad "Points"**: la página del cuadro de torneo SÍ trae
una fila de puntos por ronda (`docs/estructura.md` §3, "Cincinnati: 10, 200, 400, 650,
1000") — existe en la fuente, pero el parser actual no la captura y no hay columna para
guardarla. Traerla es trabajo aparte (parser + migración + recarga), no se ha hecho
porque no se pidió explícitamente y el resto de la funcionalidad no depende de ello.
`MatchHistoryTable.tsx` (la tabla plana anterior) se borró: `RecentActivity.tsx` la
sustituye por completo, sin usuarios que quedaran colgando de la anterior.

## 2026-08-14 — Bug real: el superíndice de tie-break caía del lado equivocado cuando el ganador del partido perdía ese set

Reportado por el propietario ("scores are not displayed correctly") junto con la
imagen de referencia de un partido a 4 sets donde el campeón pierde el primer set en
la muerte súbita ("6/7(7) 6/4 6/3 6/4"-style). `lib/matchScore.ts` decidía a qué lado
pegar el superíndice comparando cuál de los dos números era menor EN ESE SET
(`isSetLoser = games < opponentGames`) — funciona si el ganador del partido también
ganó ese set concreto, pero se equivoca justo cuando lo perdió: `winnerGames`/
`loserGames` en `sets` están siempre escritos desde la perspectiva del ganador DEL
PARTIDO (confirmado contra un caso real, `score_raw: "6/7(3) 7/6(4) 7/5"`, partido
54981 — el "(3)" va pegado al "7", el número MÁS ALTO de ese set, porque el ganador
del partido perdió esa muerte súbita).

**Arreglo**: el superíndice va siempre con `loserGames` (el perdedor DEL PARTIDO en
ese set, sea cual sea el marcador), nunca con una comparación de magnitud por set —
`scoreFromPerspective` pasa a ser `superscript: playerWonMatch ? null : tiebreakLoserPoints`,
sin mirar los números. Test nuevo en `lib/matchScore.test.ts` fija el caso real que
lo delató. Afecta a `MatchCard.tsx` (el cuadro) además de `RecentActivity`, que
comparte la misma función — un solo arreglo cubre las dos superficies.

**De paso**, `RecentActivity` pasó a enseñar los dos marcadores del set pegados
("6" + "7", uno con el superíndice si toca) en vez de solo el número propio del
jugador — sin el del rival al lado no se distingue "gané 6-0" de "gané 7-6" en la
tabla de un solo jugador. Nueva función `pairedScoreFromPerspective` en
`lib/matchScore.ts` para esto, `scoreFromPerspective` (una sola cifra) se queda para
`MatchCard`, que ya tiene una fila por jugador.

**También**, dentro de cada torneo las rondas ahora se enseñan de la más avanzada a
la más temprana (F arriba, R1 abajo) — pedido explícito, para leer de un vistazo hasta
dónde llegó sin bajar a la última fila. El resumen del pie (Champion/Runner-up/Lost in
X) se sigue calculando sobre el orden cronológico real; solo el orden de PINTADO se
invierte (`[...group.matches].reverse()`).

## 2026-08-14 — Cuadro de torneo: geometría compacta por ronda + navegación por ventana de 2 columnas

Pedido explícito, con capturas de referencia de atptour.com: los botones de ronda no
deben desplazar un lienzo enorme, sino enseñar solo las tarjetas que importan, sin
distancias enormes entre partidos. Además, tarjetas más grandes y resaltar el número
de juegos del lado que ganó CADA set (no solo el partido).

**La causa real de "distancia enorme"**: `lib/bracket.ts` posicionaba cada partido con
un contador global (`nextLeafY`) que se repartía en el orden en que una búsqueda hacia
atrás desde la Final iba descubriendo cada entrante — byes incluidos, aunque un bye no
tenga fila en `matches`. Para un cuadro de 96 (Montreal, Trn=2091) eso significaba que
R1 (solo 7 partidos reales) quedaba esparcida por un lienzo calibrado para ~96
posiciones teóricas. **Arreglo**: `buildBracketLayout` pasa a calcular hacia delante
(R1 -> ... -> F): cada ronda ocupa el rango denso `0..N-1` de sus propios partidos
reales, sin huecos reservados para byes. El ancla (promedio de los dos alimentadores,
o el único que sí jugó) decide el ORDEN dentro de la ronda, no la magnitud — se
descartó interpolar el valor numérico bruto entre anclas porque comprimía las rondas
con MÁS partidos que alimentadores (p. ej. R2, 32 partidos reales alimentados por solo
11 ganadores de R1) dentro del rango, más pequeño, de la ronda anterior: la ronda con
más partidos acababa con MENOS espacio, justo al revés de lo necesario. La función
nueva (`rankByAnchor`) ordena por ancla y asigna el rango de posición, no el valor.

Efecto secundario detectado y corregido de paso: sin `ORDER BY id` explícito en la
consulta de partidos de `app/tournaments/[id]/page.tsx`, Postgres no garantiza el
orden de filas — y el nuevo algoritmo usa el orden de aparición como pista de
posición para los partidos sin alimentador. Se añadió el `orderBy(asc(matches.id))`.

**Navegación por ventana**: `BracketColumns` ya no usa scroll horizontal libre sobre
un lienzo gigante — muestra 2 rondas completas (más un asomo de la siguiente, como en
la referencia) dentro de un contenedor `overflow-hidden` de ancho fijo, desplazado con
`translateX` animado. Los chips de ronda saltan la ventana directamente a esa ronda;
se añadieron flechas `<`/`>` para desplazarla de una en una. La altura del contenedor
solo reserva la de las 1-2 rondas VISIBLES (`roundHeights` nuevo en
`lib/bracketGeometry.ts`), no la del cuadro entero.

**Tarjetas más grandes** (`ROW_HEIGHT` 36→44, ancho fijo 224→260px) y **se resalta el
número de juegos de quien ganó CADA set** (no el partido): `setWinners()` en
`MatchCard.tsx` compara los dos marcadores de ESE set concretamente (con
`--headline`/blanco el que ganó, atenuado el que perdió) — un dato distinto al
superíndice de tie-break (arreglado arriba), que sigue yendo por perdedor del
PARTIDO. Verificado contra Trn=2091 (32 partidos reales en R2, el caso más denso del
archivo): sin colisiones, sin tarjetas superpuestas, conectores correctos en las tres
ventanas de ronda comprobadas.

## 2026-08-14 — Tour Finals reusa `TournamentCard` tal cual

Pedido explícito: que las tarjetas de las Tour Finals no se sientan como una sección
aparte. `FinalsEditionCard` ya no es su propio componente visual — mapea sus datos a
`TournamentCardData` y renderiza `TournamentCard` con `tier="large"` (es el evento de
cierre de temporada, el más importante) y un `href` explícito a `/finals/[id]`
(`TournamentCard` ganó un prop `href` opcional para esto, antes enlazaba siempre a
`/tournaments/[id]`).

**Sin superficie real que mostrar**: `finalsEditions` no modela `surface` (no es un
torneo del archivo de Mana Games, es un evento propio de fin de temporada) —
`TournamentCardData.surface` pasa a ser `string | null`, y sin superficie la tarjeta
usa el acento de marca en vez de un color de superficie inventado, y la línea de
categoría no intenta añadir un "· null". `listFinalsEditions()` se amplió para traer
también país del campeón, finalista y marcador de la final (antes solo el nombre del
campeón) — la misma consulta a `finalsMatches`/`players` que ya existía, solo con más
columnas.

## 2026-08-14 — Ranking "Next Gen Race": filtro sobre la Race ya importada, no un baremo nuevo

Pedido: una clasificación de debutantes (sin partidos registrados antes de la
temporada en curso) calculada a partir de la Race que ya se importa de Mana Games.
**No es un baremo propio** (CLAUDE.md §4): son los mismos puntos de Race ya
importados, filtrados a un subconjunto de jugadores y renumerados 1..N — el filtro en
sí (¿debutó este año o no?) sale de `matches`/`editions`, datos reales ya cargados, no
de una fórmula inventada.

`getNextGenRaceRanking()` en `lib/tourQueries.ts`: toma la semana de Race más reciente
(`getLatestRaceWeek()`, igual que `getLatestRankingWeek()` pero para `kind='race'`),
y descarta a cualquier jugador con al menos un partido en una edición de un año
ANTERIOR al que cubre esa Race — comprobado con datos reales: Gyrmik (campeón de
Montreal 2026 esta misma sesión) sale #1 porque, verificado contra `matches`, sus 73
partidos registrados son TODOS de 2026, ningún año antes.

**`moved` siempre en 0** — no hay un histórico de "Next Gen Race" contra el que
comparar la semana anterior (es un filtro calculado al vuelo, no una tabla con
snapshots propios), así que no hay nada real que enseñar en +/-. `MovedIndicator` ya
pinta `0` como "--", no como "sin cambio" — la lectura correcta sigue siendo "no hay
dato", no "no se movió". Nueva pestaña en `RankingViewToggle` (`RankingView` gana
`"nextgen"`), reusa el calendario de semanas de la Race (sin selector de semana, igual
que la Race normal) y las mismas cards de agregados (`getPlayerTotals`/
`getYearRecords`) que ya usaban las otras dos vistas.

## 2026-08-14 — H2H: aro de victorias proporcional y nombres en píldora de color

Pedido con imagen de referencia (estilo ATP), aclarando que las estadísticas de la
imagen no son las que hay que copiar — solo el aspecto, con lo que ya tenemos.

**Aro de "Vs Wins" proporcional de verdad**: antes era un círculo con borde fijo,
decorativo. Ahora es un SVG con dos arcos (azul/lima, un color por jugador) cuya
longitud es su cuota real de victorias del enfrentamiento (`strokeDasharray` sobre la
circunferencia) — sin enfrentamientos todavía, el aro sale gris neutro, no partido
50/50 de forma inventada.

**Nombre en píldora de color** en vez de texto plano — un jugador en azul
(`--blue-500`), el otro en el acento de marca (`--accent-500`), con la bandera dentro
de la píldora. Mismos dos colores que ya usaban las barras comparativas de
`H2HStatsRow` (`por qué`: consistencia, no un tercer color nuevo) — así el color de
cada jugador se reconoce de un vistazo en toda la página, no solo en las barras.

**Barras de `H2HStatsRow` más gruesas** (1.5px → 2.5px) y las cifras a su lado más
grandes — el resto de la estructura (barra que crece desde el centro hacia cada lado,
la mitad de cada jugador de su color) ya seguía el patrón que pedía CLAUDE.md §6
desde el principio, así que no hizo falta rehacerla, solo darle más peso visual.

No se tocaron los campos: sin edad/peso/altura/mano/prize money reales en el esquema,
la ficha de jugador sigue enseñando solo Ranking/Points/Career high/Playing since, que
es lo que ya existía y es honesto con los datos disponibles.

## 2026-08-14 — Cuadro: tarjetas de "Bye" propias + vuelta a la alineación por promedio

Corrección directa del propietario: pidió replicar el cuadro de la referencia, y las
plazas con bye (docs/estructura.md §3: "el marcador aparece como celda propia sin
`<a>`") seguían sin tarjeta — el cuadro se veía incompleto en las rondas tempranas, y
la ronda siguiente no caía entre sus dos alimentadores como debería.

**Byes como tarjeta real, no como hueco**: `lib/bracket.ts` gana `findByeSlots()` —
para cada jugador, mira en qué ronda cae su primer partido REAL registrado; si no es
ya la primera ronda del cuadro, esa ronda anterior necesita una tarjeta de bye. Un solo
bye por jugador (no se intentan reconstruir cadenas de bye de más de una ronda: no hay
forma de verificarlas con lo que archivamos, mejor mostrar de menos que inventar de
más). `app/tournaments/[id]/page.tsx` construye esas tarjetas completas (nombre, país,
seed sacados de cualquier partido real del jugador) y las añade a la lista antes de
pasarla al layout — `lib/bracket.ts` no sabe nada de "jugador Bye": para él es un
partido más, con "Bye" (`BYE_PLAYER_ID = -1`, centinela en `MatchCard.tsx`) como el
otro lado y el jugador real como ganador automático.

**Esto es lo que de verdad arregla la alineación**: con cada plaza real representada
(bye o partido), `buildBracketLayout` puede volver al cálculo simple por promedio de
alimentadores (la `y` de un partido es la media de sus dos alimentadores) que se había
abandonado la sesión anterior por un problema de densidad — ese problema era un síntoma
de los byes invisibles, no del promedio en sí. Con los byes ya representados, el
promedio da exactamente lo pedido: la tarjeta de la ronda siguiente cae entre sus dos
alimentadores, ni más arriba ni más abajo. Verificado contra Montreal (Trn=2091,
editionId 1625): 53 tarjetas de bye sintetizadas en R128 (64 plazas reales - 11
partidos), cero colisiones, conectores correctos en las tres ventanas comprobadas.

**Bug real encontrado de paso, ventana vertical**: al hacerse más alta la primera
ronda (ahora con plazas de bye incluidas), las rondas siguientes podían caer en
cualquier punto del lienzo completo — la ventana de navegación solo recortaba la
ALTURA visible pero nunca se desplazaba verticalmente hasta donde estuvieran las
tarjetas de la ronda enfocada, así que clicar en una ronda posterior enseñaba una
ventana en blanco. `computeBracketGeometry` pasa a devolver `roundBounds` (mínimo y
máximo de cada ronda, no solo el máximo) y `BracketColumns` aplica `translate(x, y)`
con el mínimo de la ventana visible, no solo `translateX`.

## 2026-08-14 — Un w.o. no cuenta como derrota para quien no pudo jugar

Pedido explícito: "byes should still not be counted as victories, but neither should
walkovers be counted as losses". Lo primero ya era cierto por construcción — un bye
nunca tuvo fila en `matches` (arriba), así que no hay de dónde contarlo como victoria
de nadie. Lo segundo sí exigía un cambio: `getPlayerTotals`/`getYearRecords`
(`lib/tourQueries.ts`) y `getCareerStats` (`lib/h2hStats.ts`) contaban CUALQUIER
partido con `winner_id <> jugador` como derrota, w.o. incluido.

**Asimetría a propósito**: quien avanza por w.o. SIGUE sumando la victoria (pasó de
ronda, eso no se le quita) — solo se excluye el lado de la derrota
(`outcome <> 'walkover'` en el `FILTER` de las derrotas, sin tocar el de victorias).
899 partidos de 4.494 son w.o. en el archivo completo — no es un caso raro, cambia
records de verdad (ej. Heat: 137-131 → 137-128 tras el arreglo).

## 2026-08-14 — Ficha de jugador: YTD, Career y títulos, reusando `getCareerStats`

Pedido: añadir estadísticas del año en curso y de toda la carrera, más el número de
títulos, a la ficha de jugador — el H2H ya enseñaba justo esa comparativa
(`lib/h2hStats.ts::getCareerStats`) pero la ficha individual del jugador seguía con su
propio cálculo aparte, más pobre (solo un W-L de toda la vida, sin desglosar, y sin
títulos).

**Se reutiliza `getCareerStats(playerId, currentYear)` tal cual** en vez de duplicar
consultas — mismo criterio de w.o.-no-cuenta-como-derrota (arriba) heredado gratis, y
una sola fuente de verdad para "cuántas victorias/derrotas/títulos tiene este jugador"
en toda la web. `PlayerHeader` pasa de 4 a 6 estadísticas: Current rank, Points, Career
high, YTD W-L, Career W-L, Titles. Verificado con un debutante 2026 (YTD y Career
iguales, como toca) y un veterano (10-18 este año frente a 137-128 de carrera) — la
distinción se nota de verdad, no es un dato repetido con otro nombre.

**Corrección de formato, mismo día**: "Titles" pasa de un pie "N this year" (solo
visible si hay títulos esta temporada) a un valor único `N (M YTD)` siempre visible,
pedido explícito — no se pierde información cuando `M` es 0, simplemente se lee
"2 (0 YTD)" en vez de un pie ausente.

## 2026-08-14 — Cuadro: los byes rompían el orden real, arreglado con expansión hacia atrás desde la última ronda

Reportado con capturas: las tarjetas de bye salían agrupadas al final de su ronda en
vez de intercaladas en su sitio real, y eso descuadraba la ronda siguiente (partidos en
el orden equivocado, tarjetas solapadas).

**Causa**: `app/tournaments/[id]/page.tsx` construye los partidos reales primero
(ordenados por id, que sigue el orden real de fila del documento) y las tarjetas de
bye DESPUÉS, todas juntas, al final del array (`[...bracketMatches, ...byeMatches]`) —
más simple de construir así. El algoritmo de posición de la sesión anterior (promedio
calculado hacia delante, R1 -> F) usaba, para los partidos sin alimentador, el ORDEN DE
LLEGADA DEL ARRAY como pista de posición — con los bye agrupados al final, esa pista
ya no reflejaba su sitio real en el cuadro.

**Arreglo, `lib/bracket.ts`**: en vez de calcular hacia delante, `buildBracketLayout`
reconstruye el orden real EXPANDIENDO HACIA ATRÁS desde la última ronda presente. La
última ronda es la única de fiar por sí sola (para llegar tan lejos hay que haber
jugado de verdad, nunca hay un bye tan tarde), así que su orden guardado (por `id`) ya
es correcto. Cada partido de la ronda K+1 se "expande" en sus dos alimentadores de la
ronda K: `player1` es SIEMPRE la mitad de arriba de la pareja y `player2` la de abajo
—confirmado en el propio parser (`extractMatchesFromTable` en
`parsers/tournamentPage.ts`: `entrants[0]` es el primer cruce que encuentra bajando
fila a fila por la rejilla, ese es quien se guarda como `player1`)— y el alimentador de
cada lado se busca por `winnerId`, sin distinguir entre partido real y tarjeta de bye
sintética (las dos tienen `winnerId`). Repitiendo esto ronda a ronda se obtiene el
orden real de TODAS las rondas sin depender en ningún momento del orden de llegada del
array. Test de regresión en `lib/bracket.test.ts` que reproduce exactamente el patrón
del bug (bye al final del array) y comprueba que el resultado es idéntico al de
tenerlos ya en su sitio.

## 2026-08-14 — Nombres de campeón/finalista sin "…": ni en la tarjeta de torneo ni en el cuadro

Pedido explícito: no abreviar con puntos suspensivos el nombre del campeón/finalista en
`TournamentCard` ni el de los jugadores en `MatchCard` (el título del propio torneo sí
sigue truncándose, eso no es un nombre de jugador). Se quita `truncate` (que en
Tailwind implica `white-space: nowrap` + recorte) y se añade `break-words` — un alias
TE4 sin espacios (`"conventional_designation"`, `"maastodontee"`) no tiene dónde
partirse de forma natural, así que sin esto simplemente se saldría de su columna en vez
de mostrarse entero.

**En `MatchCard`, esto exige que la tarjeta pueda crecer**: la altura de fila
(`ROW_HEIGHT`) y la del cuadro (`MATCH_CARD_HEIGHT`) eran fijas (usadas tal cual por
`lib/bracketGeometry.ts` para calcular conectores), así que un nombre partido en dos
líneas se habría recortado invisible por el `overflow-hidden` de la tarjeta. Pasan a
ser una altura MÍNIMA (`minHeight`, no `height`) y se quita el `overflow-hidden` de la
tarjeta; `SLOT_HEIGHT` (el hueco vertical entre tarjetas de la misma ronda) gana más
margen (+36px en vez de +20px) para que ese caso, raro pero real, no se monte encima de
la fila de abajo. No es una garantía absoluta para un nombre extremadamente largo, pero
cubre los casos reales del archivo sin volver a recortar nada.

## 2026-08-14 — TournamentCard: nombre largo ensancha, no parte en varias líneas; hueco para el pop encima de "Week N"

Corrección directa sobre el arreglo anterior (con captura): `break-words` partía
"CaptainCrazy" en tres líneas sueltas ("Capt/ainCr/azy") — feo, y encima subía la
altura de la tarjeta. Pedido: que ensanche en vez de crecer en alto.

**`TournamentCard`**: el nombre de campeón/finalista pasa a `whitespace-nowrap` (nunca
se parte) y el ancho de la tarjeta pasa de fijo (`w-[…]`) a mínimo
(`sm:w-auto sm:min-w-[…]`, con `max-sm:w-full` para que el móvil siga a ancho
completo) — así un nombre largo empuja el ancho de la tarjeta hacia arriba en vez de
partirse. Esto solo funciona dentro de una fila `flex flex-wrap` (cada tarjeta ocupa el
ancho que su contenido pida); la sección "Latest tournaments" de la home usaba un
`grid` de columnas fijas, incompatible con "ensanchar" (la celda del grid no crece con
el contenido) — se cambió a `flex flex-wrap`, el mismo patrón que ya usaba
`/tournaments`, para que el comportamiento sea el mismo en las dos páginas donde vive
esta tarjeta.

**"Week N" tapado por la tarjeta en pleno hover**: el pop (`hover:scale-110
hover:-translate-y-2`) sube la tarjeta lo suficiente como para montarse encima del
título de la sección si no hay hueco de sobra por encima. Se añadió `pt-5` a la fila de
tarjetas en `/tournaments` y en la home (además del margen que ya traía la propia
cabecera) — verificado en hover real que "Week 30" queda completamente visible por
encima de la tarjeta en su punto más alto.

## 2026-08-15 — Cuadro: la ventana de Semis/Final arrastraba la distancia del árbol entero

Reportado con captura: al llegar a Semis, quedaba un hueco vacío enorme debajo de la
única tarjeta visible — vacío de verdad, no una tarjeta fuera de encuadre.

**Causa**: la `y` que calcula `buildBracketLayout` (lib/bracket.ts) es la posición
dentro del ÁRBOL ENTERO — para un cuadro de 96/128, las dos semifinales pueden caer a
más de 30 "unidades" de separación (heredada de cuánto tuvieron que separarse los
partidos de R128 para caber todos), aunque a esas alturas del cuadro ya solo queden 2
partidos. La ventana de navegación recortaba y desplazaba (`translate`) ese mismo
lienzo compartido — conservaba fielmente esa distancia heredada, así que Semis salía
con un hueco del tamaño que le habría hecho falta a R128 entero.

**Arreglo**: `lib/bracketGeometry.ts` gana `computeWindowGeometry(layout, focusIndex,
roundCount)`, que sustituye a `computeBracketGeometry` — ya no recorta un lienzo
compartido, RECALCULA la posición desde cero solo para las 2-3 rondas de la ventana
actual. La ronda visible más temprana se numera densa (0,1,2...) EN ESE MOMENTO, sin
arrastrar su posición en el árbol completo; las rondas siguientes de la ventana se
promedian a partir de esas posiciones ya recompactadas, no de las del árbol entero.
Como resultado, `BracketColumns` ya no necesita el `translate` vertical/horizontal que
tenía antes (la ronda visible más temprana siempre arranca en el mismo punto fijo) — se
quitó del todo, más simple que antes y sin el hueco. Verificado en vivo: R128 (denso,
sin cambios), Semis (2 tarjetas juntas, conector correcto a la Final, cero espacio
vacío) y Final (una sola tarjeta, sin columna de sobra a la derecha).

## 2026-08-15 — Escudo de Rome: la carpeta fuente estaba vacía, ya no

Reportado: "Rome no tiene escudo". Confirmado que no era un fallo del mapeo — el
2026-08-14 se dejó fuera a propósito porque `XKTTBSTD/Rome ATP 1000/` no tenía
`Icon.png` en ese momento. La carpeta se rellenó después (fuera de este repo, el
propietario gestiona `XKTTBSTD/` aparte). Copiado el `Icon.png` ya presente a
`public/tournament-logos/rome-atp-1000.png` (mismo criterio de aplanado que el resto) y
añadida la entrada `Rome: "Rome ATP 1000"` a `lib/tournamentLogos.ts`. Verificado en
vivo en la tarjeta de Rome 2022.

## 2026-08-15 — Acento de vuelta a verde lima/oliva (referencia: Nexus Mods), navy sin tocar

Pedido con imagen de referencia (la ficha de Tennis Elbow 4 en Nexus Mods: banda y
barra lateral en verde lima/oliva sobre fondo casi negro). Antes de tocar nada se
preguntó por el alcance, porque el fondo de la referencia es un navy neutro bastante
más oscuro que el nuestro — y `--navy-900/800/700` están fijados a mano a los píxeles
reales de `public/assets/logo.png` (decisión del 2026-08-13: "manda el logotipo").
Cambiar el fondo sin encargar un logotipo/header nuevos habría abierto una costura de
color justo donde vive la marca. Se acordó explícitamente: **solo el acento**, navy
intacto.

**Cambio real**: dos líneas en `app/globals.css` (`--accent-500` y `--glow-500`, más su
variante clara) — todo lo demás (`BrandBar`, botones, pestaña activa, aro del H2H,
resaltado del leaderboard...) ya consumía estos tokens por variable CSS/clase de
Tailwind, nunca un hexadecimal suelto (comprobado por grep antes de tocar nada), así
que el cambio se propaga solo sin tocar ningún componente. Colores a ojo, sin
cuentagotas exacto sobre la captura (no hay herramienta de muestreo de píxel a mano
en este entorno) — `--accent-500: #c4d82e` (oliva-lima, fijo en los dos temas, como ya
era), `--glow-500` pasa de cian a `#d8ff33` en oscuro y `#7c9a00` en claro (más oscuro
que el lima puro, para no perder contraste sobre blanco).

**Por qué no rompe nada visualmente**: `logo.png` (el wordmark) ya llevaba un filete
lima fino en el trazo desde antes — el acento nuevo hace juego con eso en vez de
chocar. Comprobado con grep que todo `text-accent-500` cae sobre superficie oscura
(`bg-navy-900` o `dark=true`), nunca sobre `--paper` claro — sin riesgo de contraste
roto en modo claro. Verificado en vivo: home (banda de marca, avatar, badge de
noticia), rankings (pestaña activa, chips) y H2H (aro de victorias, píldora de
nombre) — todo coherente, sin tocar el navy en ningún sitio.

## 2026-08-15 — Enlaces a la comunidad (Mana Games, Steam, XKT Mod, Tennis Elbow Hub) + logotipo a la izquierda

Pedido: enlaces con su logotipo a Mana Games Forum, Steam, XKT Mod (mod.io) y Tennis
Elbow Hub, en la cabecera y en la home; el wordmark de `BrandBar` pasa de la derecha a
la izquierda.

**Sin ficheros de logo reales todavía**: no hay forma de conseguir los logotipos
oficiales exactos de estas cuatro plataformas con las herramientas de este entorno
(nada de descarga de imágenes pixel-perfectas), y CLAUDE.md ya avisa contra
inventar/aproximar logotipos de terceros. Se preguntó directamente y el propietario
eligió añadir él mismo los ficheros más adelante (mismo patrón que `XKTTBSTD/` para
los escudos de torneo) en vez de un icono genérico o un enlace sin logo. `lib/
partnerLinks.ts` guarda la lista (id, etiqueta, URL, ruta esperada bajo
`/public/assets/partners/<id>.png`) — el propietario solo tiene que dejar los cuatro
PNG ahí con esos nombres y aparecen solos, sin tocar código.

**Bug real durante la implementación**: la primera versión comprobaba si el fichero
existía con `node:fs` (`existsSync`) en tiempo de render — igual que se planteó al
principio. Rompió Turbopack entero (`la chunking context no soporta node:fs`) porque
`BrandBar` cuelga de `SiteNav`, que ya es Client Component: cualquier cosa que
importe, aunque sea transitivamente, entra en el bundle del navegador, y `node:fs` no
existe ahí. Arreglado quitando `node:fs` de raíz — `lib/tournamentLogos.ts` ya
resolvía esto mismo con una tabla verificada a mano en vez de comprobar en vivo, así
que aquí se seguía la misma idea iría bien de no ser porque SÍ hace falta saber si el
fichero YA está antes de pintar el enlace (el propietario los añadirá en otra sesión,
sin desplegar código nuevo). Solución: `lib/useImageExists.ts`, un hook de cliente que
precarga la imagen con un `Image` de JS en un `useEffect` y solo pinta el enlace si
carga — nunca toca `node:fs`, todo en el navegador.

**Segundo intento fallido, más sutil**: la primera versión de esto usaba `<img
onError={...}>` en vez del hook — parecía bastar, pero en la práctica los cuatro
iconos salían con el icono de "imagen rota" del navegador en vez de ocultarse. Causa:
el `<img>` que manda el servidor empieza a cargar en cuanto el navegador parsea el
HTML, ANTES de que React hidrate y enganche `onError` — con un 404 tan rápido como
estos (el fichero ni existe), el evento de error nativo puede disparar y perderse
antes de que el manejador esté enganchado. Precargar a mano con `new Image()` desde
`useEffect` no tiene ese hueco: no se pinta nada hasta que el propio JavaScript
confirma que la imagen carga.

**Dos presentaciones distintas**: en `BrandBar` (cabecera), cada icono sin logo
simplemente no sale (`PartnerIcon` devuelve `null`) — la banda de marca no necesita
rellenar hueco. En la home (`CommunityLinks`), cada tarjeta SIEMPRE sale (nombre +
enlace funcionan ya), con un icono de enlace externo neutro de recambio mientras no
haya logo — la sección en sí no debe desaparecer solo porque falte una imagen.

**Logotipo a la izquierda**: `BrandBar` pasa de `justify-end` a `justify-between`, con
los cuatro iconos (cuando existan) a la derecha — encaja con haber liberado ese lado.

## 2026-08-15 — H2H: aro de victorias mal (bug real de signo), barras inconsistentes, y reordenado

Reportado con captura, tres cosas: colores/gráficas mal, y pedido explícito de que
"Every meeting" viva justo debajo de los dos jugadores, con mejor presentación.

**Bug real en el aro de "Vs Wins"**: con Jirafalox 5 - Madferit 2, el aro salía
mayoritariamente LIMA con solo un arco azul fino arriba — al revés de lo que tocaba
(Jirafalox, azul, tiene más victorias). Causa: la versión anterior dibujaba DOS arcos
complementarios, cada uno con su propio `stroke-dasharray`/`stroke-dashoffset` — el
signo del desfase del segundo arco (lima) estaba mal, así que en vez de completar al
primero (azul) lo tapaba casi entero (el lima se pinta después en el DOM, encima).
Arreglado dibujando un círculo COMPLETO en el color del jugador 2 primero (la base) y
solo el arco proporcional del jugador 1 encima — sin desfase que se pueda equivocar de
signo, lo que el arco de arriba no cubre es, por construcción, la cuota del otro.

**Barras de "By surface/category/round" no representaban la magnitud real**: eran una
barra apilada de ancho FIJO (los dos valores siempre sumaban el 100% de su ancho), así
que "1 contra 0" (un solo partido) se veía tan "llena" como "10 contra 8" — dos
muestras de tamaño muy distinto con el mismo peso visual, y además con un lenguaje
visual distinto al de "Career comparison" (que sí crece desde el centro, proporcional
al mayor de los dos valores). Se extrajo `CenterBar` (antes vivía duplicado dentro de
`H2HStatsRow`) a un componente compartido y `H2HSplitTable` pasa a usarlo también —
toda la página habla el mismo lenguaje de barras ahora.

**"Every meeting" a la altura de los dos jugadores**: pedido explícito, antes vivía al
final de la página tras toda la comparativa agregada. Se movió justo debajo de
`H2HHeader`, en tema oscuro (antes era la única sección clara de toda la página, y ya
no tenía sentido siendo la primera cosa que se ve tras la cabecera).

**Presentación nueva de cada cruce**: antes decía "Ganador venció a Perdedor" en texto
corrido, reordenado cada fila según quién ganara ESE partido — obligaba a leer cada
fila entera para saber quién iba ganando en general. Ahora cada fila enseña SIEMPRE a
los mismos dos jugadores en el mismo sitio (jugador 1 de la cabecera a la izquierda en
azul, jugador 2 a la derecha en lima, con bandera), y el que ganó ESE cruce concreto
sale en negrita y coloreado — de un vistazo por la columna se ve quién domina, sin leer
nada. `H2HMatchRow` cambia de `winnerName`/`loserName` a `player1Won: boolean`
(comparado contra el `player1Id` fijo de la página, no el `player1`/`player2` interno
de la fila de `matches`, que no tiene por qué coincidir) — `lib/h2hNarrative.ts` se
ajustó para derivar el nombre del ganador a partir de ese booleano en vez de leerlo ya
resuelto.

**Ajuste el mismo día, tras ver el arreglo del aro en vivo**: la proporción ya salía
bien (mayoría azul, como toca con 5-2), pero la porción lima aparecía pegada al panel
IZQUIERDO (el del jugador que no es lima) en vez de hacia su propio panel, a la
derecha — quedaba proporcionalmente correcto pero espacialmente raro. Cambio de fondo:
en vez de "círculo base + un arco encima" (dependía de por dónde barre `<circle>` con
`stroke-dasharray`, un detalle interno del navegador, no un dato que se controle),
ahora los dos arcos se trazan por coordenadas explícitas (`describeArc`, trigonometría
directa) arrancando juntos arriba y creciendo cada uno hacia SU lado: el azul en
sentido antihorario (hacia la izquierda, el panel del jugador 1) y el lima en sentido
horario (hacia la derecha, el panel del jugador 2) — se encuentran donde toque según
el reparto real, pero cada color crece desde el principio hacia donde vive su propio
jugador en la pantalla, no al revés.

## 2026-08-15 — Cabecera: misma altura hero en todas las páginas, iconos de partners más grandes

Antes `SiteNav` alternaba el tamaño de `BrandBar` según la ruta (`hero` solo en `/`,
`compact` en el resto) — pedido explícito de que la cabecera mida siempre lo mismo,
sea cual sea la página. `BrandBar size="hero"` pasa a ser incondicional; el tamaño
`compact` se deja definido en `SIZES` (no rompe nada mantenerlo) pero ya no lo usa
nadie.

Los iconos de partners (`PartnerIcon`) eran demasiado pequeños junto al wordmark a
tamaño hero (contenedor de 36px con logo de 24px, pensado para la banda compacta de
64px de alto). Suben a 48px de contenedor / 36px de logo en móvil y 64px / 48px desde
`sm:`, con más separación entre ellos (`gap-3`).

## 2026-08-15 — Finals: tarjetas y tabla de grupo se veían "demasiado simples"

Comparadas con el cuadro principal (`MatchCard`), las tarjetas de Finals (`FinalsMatchCard`)
eran una versión de segunda: sin filete de ganador, sin check, sin sets ganados en
negrita, sin pie con enlace al H2H. Ambas tarjetas viven en el mismo sitio (torneos vs.
Finals) sin motivo real para verse distintas, así que `FinalsMatchCard` pasa a compartir
el mismo lenguaje visual y las mismas medidas (`FINALS_CARD_WIDTH`/`FINALS_CARD_HEIGHT`,
iguales a las de `MatchCard`).

`GroupStandingsTable` gana número de posición, badge Q/E como píldora de color (antes
una letra suelta) y un filete izquierdo de color por fila (verde/rojo/transparente según
`qualStatus`) — mismo lenguaje que el filete de ganador de `MatchCard`. Ojo con combinar
`border-{color}` (todos los lados) y `border-l-{color}` en el mismo elemento: pisan la
misma propiedad de color del lado izquierdo sin garantía de orden en el CSS generado por
Tailwind — se usa `border-b-rule` (solo el lado inferior) en vez de `border-rule` para
que no compita con el filete izquierdo dinámico.

**Ronda eliminatoria con conectores de verdad**: antes SF1/SF2/Final eran tres tarjetas
sueltas en `flex flex-wrap`, sin ninguna relación visual entre ellas. Nuevo componente
`FinalsKnockoutBracket`: SF1 arriba y SF2 abajo en una columna, Final centrada
verticalmente entre las dos, con un conector SVG en forma de codo (mismo lenguaje que
`BracketConnectors` del cuadro principal). Como la forma es siempre la misma (2 semis →
1 final, a diferencia del cuadro principal que varía de tamaño), no hace falta el motor
de geometría genérico (`bracketGeometry.ts`): las coordenadas del conector se calculan
directamente a partir de las constantes de tamaño de `FinalsMatchCard`, sin medir nada
en el DOM.

## 2026-08-15 — Finals: el badge de clasificado desaparecía justo al terminar el grupo

`getGroupStandingsRows` solo calculaba Q/E mientras quedaban cruces por jugar
(`computeQualificationStatus`, el cálculo "score-bound" que simula escenarios). En
cuanto el grupo terminaba (`remainingPairs.length === 0`) el badge se apagaba del todo
(quedaba `qualStatus: null` a propósito — la idea original era "la tabla ya ordenada
lo dice sola"), justo cuando más falta hace ver de un vistazo quién pasó a semis. Con
el grupo ya completo no hace falta simular nada: la tabla ya está ordenada por el
desempate oficial, así que 1º y 2º SON los clasificados. Se añade `isGroupComplete`
(sin cruces pendientes Y con algo realmente jugado, para no confundirlo con un grupo
que ni ha arrancado) y en ese caso el badge sale de la posición en la tabla en vez de
quedar en `null`.

## 2026-08-15 — Panel de admin: añadir/actualizar un torneo en vivo, con estado derivado

Pedido: que el admin pueda añadir un torneo directamente desde el sitio de Mana Games
(sin pasar por el backfill + `npm run load` manuales), y que un torneo todavía sin
jugar salga como "Registration Open" y uno a medio jugar como "Ongoing" en vez de
aparecer vacío o con "No final on record".

**Nueva sección `/admin/tournaments`**: un formulario (`Trn=` suelto o URL completa
pegada, `lib/mana/trn.ts::parseTrnInput` acepta las dos formas) dispara
`lib/mana/loadTournament.ts::loadTournamentByExternalId`, que:
1. Va a buscar `OT_ViewTournament.php?Trn=<id>` EN VIVO con Playwright
   (`lib/mana/fetchLive.ts`, mismo contexto persistente `.playwright/` y misma espera
   del challenge anti-bot que `scripts/backfill.ts` — duplicado a propósito, mismo
   criterio que ya se aplicó entre `explore.ts` y `backfill.ts`).
2. Parsea con `parsers/tournamentPage.ts` (sin tocar, ya soportaba un torneo sin Main
   Draw todavía — devuelve `matches: []`, ver el test "torneo sin Main Draw todavía").
3. Da de alta o actualiza la edición y reemplaza sus partidos — reutilizando
   `ensurePlayers`/`ensureEvents`/`ensureSource`, extraídas de `scripts/load.ts` a
   `lib/mana/loaders.ts` para no mantener dos copias de esa lógica (upsert de alias,
   detección de nombre cambiado, etc.).

**Diferencia deliberada con el cargador masivo**: `scripts/load.ts::loadTournaments`
sigue descartando (como "error", sin crear la edición) cualquier HTML de archivo sin
partidos — tiene sentido para el backfill histórico, donde un torneo sin jugar carece
de interés. La carga puntual del admin hace justo lo contrario a propósito: crea la
edición IGUAL con cero partidos, porque un torneo recién abierto en el foro es
exactamente el caso que se quiere poder añadir. No se ha tocado el comportamiento del
cargador masivo para no arriesgar el pipeline de backfill ya probado.

**Estado derivado, no columna nueva** (`lib/tournamentStatus.ts`): sin partidos →
`registration`; con partidos pero sin ninguno de ronda `'F'` → `ongoing`; con la `'F'`
resuelta → `completed`. Sale directo de docs/estructura.md §3 ("sin Main Draw todavía"
= sin cuadro; el marcador de la ronda F solo existe una vez el campeón está decidido).
Se calcula al leer, no se guarda — evita una columna que se pueda desincronizar del
dato real. Insignia compartida `TournamentStatusBadge` (no pinta nada si `completed`,
el campeón ya cuenta esa historia) usada en `TournamentCard`, la ficha de torneo
(`/tournaments/[id]`, cabecera) y el propio panel de admin.

**Límite de despliegue, explícito en la UI del admin**: esto solo funciona con el panel
corriendo en local — hace falta un Chromium real y (a veces) que alguien resuelva el
challenge anti-bot a mano, igual que el resto del scraper. `playwright` vive en
`devDependencies` a propósito, nunca se pensó para una función serverless de Vercel.
No es una limitación nueva que introduzca esta función: ya era así para
`scripts/backfill.ts`; el panel de admin simplemente le da una cara más cómoda que la
CLI, con el mismo alcance real.

## 2026-08-15 — Bug real: chips de ronda mal etiquetados en un torneo a medias

Reportado con captura: Cincinnati 2026 (Trn=2092, primer torneo cargado con el nuevo
"Add tournament" del admin — draw de 96, `status: "ongoing"`) mostraba el primer chip
de ronda como "R16" en vez de "R128", con la Final ("F") aplicada a la ronda R4 en vez
de a la ronda F de verdad.

Causa real: `roundDisplayLabel` (lib/bracket.ts) calcula la etiqueta por POSICIÓN
DESDE EL FINAL de la lista de rondas que se le pasa — diseño correcto para un cuadro ya
completo, donde la última ronda de la lista SÍ es la Final. Pero `BracketColumns` le
pasaba `layout.roundOrder`, que sale de `determineRoundOrder(matches)`: solo las
rondas que YA TIENEN partidos decididos. A medio torneo (Cincinnati: R1-R4 jugados,
Q/S/F todavía sin decidir) esa lista es `["R1","R2","R3","R4"]` — la última con datos
(R4) no es ni de lejos la Final, pero la función no tiene forma de saberlo y la cuenta
como si lo fuera.

Verificado además que los datos en sí estaban bien: R1 con 14 partidos reales, R2 con
29 (topológicamente plausible porque este draw usa la convención real de Masters 1000
—las cabezas de serie top entran directas en R2, no es un solo bye por cadena—), nada
duplicado ni inventado. El bug era solo de ETIQUETA, no de parseo de partidos.

Arreglo: nueva `fullRoundLadder(drawSize)` — la escalera COMPLETA de rondas que va a
usar el cuadro (R1..Rn,Q,S,F), derivada del `drawSize` de la edición redondeado al
alza a la siguiente potencia de 2, no de qué rondas ya tienen partidos. Confirmado
contra los 5 tamaños vistos hasta ahora (8→0 rondas R, 16→1, 32→2, 64→3, 96→4 —
se comporta como un cuadro de 128). `BracketColumns` ahora recibe `drawSize` como prop
y usa `fullRoundLadder(drawSize)` en vez de `layout.roundOrder` para calcular las
etiquetas de los chips — la lista de rondas CON datos se sigue usando tal cual para
todo lo demás (navegación, qué columnas existen de verdad).

## 2026-08-15 — El bug de Cincinnati era más profundo: byes inventados + orden de ronda mal reconstruido

El arreglo de las etiquetas de ronda (entrada anterior) no era suficiente — el usuario
insistió con capturas del cuadro real de Mana Games y tenía razón: el conjunto de
jugadores que aparecía "arriba del todo" en nuestro R1 no tenía NADA que ver con el R1
real. La causa real tenía dos capas, ambas resueltas ahora capturando más del cuadro
fuente en vez de adivinar a partir de los partidos ya decididos:

**Capa 1 — byes inventados.** `findByeSlots` (ahora eliminada) adivinaba quién tuvo un
bye y en qué ronda a partir de en qué ronda reaparece cada jugador con un partido real
decidido — asunción válida solo si "reaparece en la ronda K" siempre significa "tuvo
un bye en la ronda K-1". Se rompe en un draw irregular como el de 96 de Cincinnati: los
cabezas de serie top entran DIRECTOS en R2 (convención real de Masters 1000), sin
ningún bye en R1 — indistinguible de un bye real con solo esa pista. `Franky Franchicha`
(su primer partido real es en R2) salía con una tarjeta "vs Bye" fantasma en R1 que no
existe en el cuadro fuente.

Arreglo: el parser (`extractMatchesFromTable`) ya no descarta las celdas "Bye" — las
captura como `ParsedBye` (ronda + jugador), exactamente igual que hace con los
partidos reales. Nueva tabla `byes` (migración `0008_sour_killmonger.sql`), poblada
por `lib/mana/loadTournament.ts` (carga puntual) y `scripts/load.ts` (carga masiva).
`app/tournaments/[id]/page.tsx` construye las tarjetas de bye a partir de esta tabla,
no de una inferencia.

**Capa 2 — orden de ronda destrozado en un torneo a medias.** `buildBracketLayout`
reconstruía el orden vertical expandiendo hacia atrás desde la ÚLTIMA ronda con
partidos, asumiendo que cualquier partido no alcanzable desde ahí era una anomalía
rara y lo añadía al final (ordenado por `id`, orden de inserción global — no la
posición real dentro de su ronda). Con Cincinnati (solo 1 partido decidido en R4) esa
"anomalía" era la REGLA, no la excepción: casi todo R1/R2/R3 caía ahí, mezclando
entrantes de un extremo del cuadro con el otro.

Arreglo de fondo: el parser ahora captura `sortIndex` — la posición real, de arriba
abajo, dentro de SU RONDA en la rejilla fuente (compartido entre `ParsedMatch` y
`ParsedBye`, mismo contador: un bye y un partido ocupan el mismo tipo de hueco).
Columna nueva en `matches` (nullable, para no romper filas ya importadas antes de
este cambio) y en `byes`. `buildBracketLayout` ordena cada ronda por `sortIndex` en
vez de por `id`, y el paso de expansión hacia atrás pasa a usarse SOLO para calcular
qué alimenta a qué (conectores), nunca para decidir el orden final — antes mezclaba
las dos cosas (los partidos alcanzados se insertaban primero, los "anómalos" después),
lo que en la práctica desordenaba la ronda entera en cuanto la mayoría de partidos
caía en la rama "anómala".

**Reparse completo**: `npm run load` relanzado sobre los ~600 ficheros ya archivados
en `data/raw/mana/` para que las ediciones ya importadas (todo el histórico 2021-2026)
tengan también `sortIndex` real y sus byes reales en vez de quedarse con la inferencia
vieja — el archivo local es la fuente de verdad, reparsear nunca implica volver a la
red (CLAUDE.md §5). Verificado en vivo: Cincinnati 2026 ahora muestra el R1 real
(fakefederer/Bye, wukennn/Snoowfy, Tamarindo/Bye, Sale93/Bye...) idéntico al cuadro
fuente, y Perth 2026 (torneo ya completado, para confirmar que no hay regresión) sigue
exactamente igual que antes.

## 2026-08-15 — Seeds en los byes + cuadro completo con huecos "TBD"

Dos flecos del arreglo de Cincinnati que quedaban pendientes, pedidos explícitamente:

**Seeds de los jugadores con bye**: `ParsedBye.player` ya traía el seed (viene del
mismo `PlayerRefSchema` que un partido normal), pero la tabla `byes` no tenía columna
para guardarlo y `app/tournaments/[id]/page.tsx` construía la tarjeta con `seed: null`
a fuego. Columna `seed` añadida a `byes` (migración `0009_careful_mach_iv.sql`,
junto con `pending_slots` de abajo).

**Cuadro completo desde el principio, con "TBD" en vez de tarjetas ausentes**: antes,
cualquier cruce sin resolver (ni partido decidido ni bye) se descartaba sin más —
`extractMatchesFromTable` exigía `bridge.player` (el ganador) para crear algo. Eso
tenía dos efectos: (1) un cruce ya emparejado pero sin jugar (dos jugadores reales,
resultado pendiente) desaparecía del todo, y (2) rondas enteras sin ningún partido
decidido (Q/S/F de un torneo a medias) ni siquiera aparecían como chip — `roundOrder`
solo incluía rondas con partidos reales.

Arreglo: el parser captura estos huecos como `ParsedPendingSlot` (ronda + sortIndex +
los dos lados, cada uno `PlayerRef | null` — null es "TBD", no nulo es un jugador real
emparejado sin resultado). Nueva tabla `pending_slots`. `MatchCardData.outcome` gana
`"pending"` y `winnerId` pasa a `number | null`; nuevo sentinel `TBD_PLAYER_ID` (mismo
patrón que `BYE_PLAYER_ID`) para el lado que ni se conoce. La tarjeta pendiente no
enseña marcador ni gana ningún check, y el botón de H2H del pie solo aparece cuando los
dos lados son jugadores reales (`id > 0` en los dos, no vale con "no bye").

Estos huecos pendientes se mezclan con `matches`+`byes` en el mismo array que ya
consume `buildBracketLayout` — nada nuevo que aprender ahí: un hueco pendiente nunca
tiene `winnerId` real, así que nunca alimenta a nadie (la búsqueda de alimentador ya
compara por igualdad exacta, `null`/`TBD_PLAYER_ID` no casan con ningún id real por
construcción), y su `sortIndex` lo coloca en su sitio real igual que un partido o bye.
Efecto directo: `determineRoundOrder` ahora ve las rondas futuras aunque no tengan
ningún partido decidido todavía, así que los chips QF/SF/F aparecen desde el principio
con tarjetas "TBD" en vez de no aparecer hasta que haya algo que enseñar.

Reparse completo otra vez (`npm run load`) para que el histórico ya importado tenga
también los seeds de bye y (si aplica — un torneo ya terminado no debería tener
ninguno) sus huecos pendientes. Verificado: Perth 2026 (terminado) sale con 0 filas en
`pending_slots`, ningún efecto secundario. Cincinnati 2026 muestra los 7 chips de ronda
completos (R128 a F) con tarjetas "TBD vs TBD" en las rondas futuras y seeds visibles
en las tarjetas de bye.

## 2026-08-15 — Conectores por posición para tramos sin decidir + fixture de test corregido

Tercer fleco de Cincinnati: las tarjetas "TBD" y los cruces pendientes nuevos (entrada
anterior) aparecían sueltas, sin la línea de conector hacia sus dos alimentadores —
`buildBracketLayout` solo calculaba alimentador por `winnerId`, y un hueco sin decidir
no tiene ganador que buscar.

Arreglo: si la búsqueda por `winnerId` no encuentra nada para un lado, se cae a un
alimentador por POSICIÓN — el hueco K de una ronda sale siempre de los huecos 2K y
2K+1 de la ronda anterior (misma rejilla física). Esto es fiable ahora precisamente
porque `pending` (entrada anterior) ya no deja huecos sin capturar: `roundRaw` refleja
el recuento real de huecos de la ronda, así que la aritmética de posición no es una
suposición, es la estructura real del cuadro. Verificado con Cincinnati: R1=64 huecos
(14 partidos + 50 byes), R2=32 (29+3 pending) — el doble exacto, confirma que la
rejilla real SÍ mantiene esa relación 2:1 ronda a ronda.

**De paso, se destapó que el fixture de test `PERTH_2026` (lib/bracket.test.ts) llevaba
mal desde el principio**: solo modelaba 5 partidos de R1, sin ninguno de los 11 byes
reales de esa ronda — un resto de la época de `findByeSlots` (inferencia), cuando los
byes ni se guardaban. Con el conector por posición nuevo, ese hueco hacía que el test
"un jugador que entra por bye no tiene partido que lo alimente" fallara — pero
investigando el HTML archivado real (Trn=2024) resultó que la propia PREMISA del test
era falsa: Tomico (y yasmin, y federaz...) SÍ tuvieron un bye real en R1, visible en el
cuadro fuente — el test antiguo asumía "no hay dato" en vez de comprobar el HTML.
Fixture reconstruido contra el parseo real (16 huecos en R1: 5 partidos + 11 byes,
sortIndex real) y test corregido para reflejar lo que de verdad pasa: Tomico enlaza con
su propia tarjeta de bye, no se queda sin alimentador.

## 2026-08-15 — "Registration Open" en un torneo con cuadro real ya publicado

Reportado: Winston Salem 2026 (Trn=2093) tenía un R32 real y completo (cruces como
"bencu vs Ruze") pero la insignia decía "Registration Open".

Causa: `deriveTournamentStatus` solo miraba `matches` (partidos DECIDIDOS) para
decidir si había cuadro — un Main Draw recién generado, con cruces reales pero
ninguno jugado todavía, tiene `matches.length === 0` a pesar de tener cuadro de
verdad (todo vive en `pending`, la tabla nueva de esta misma sesión). Mismo fallo
en los tres sitios que calculan el estado: `lib/mana/loadTournament.ts`,
`app/tournaments/[id]/page.tsx`, y las consultas SQL de `lib/tourQueries.ts` /
`app/admin/tournaments/actions.ts` (`has_matches` solo miraba la tabla `matches`).

Arreglo: `deriveTournamentStatus` pasa a recibir un `hasDraw: boolean` explícito,
calculado a partir de partidos + byes + huecos pendientes (nunca solo partidos). Las
consultas SQL cambian su `EXISTS` de solo `matches` a `matches OR byes OR
pending_slots`, renombrado `has_matches` → `has_draw` en los dos sitios para que el
nombre no mienta. Verificado en vivo: Winston Salem pasa a "Ongoing".

## 2026-08-15 — Torneos "Registration Open" ya no enlazan a una ficha vacía

Pedido explícito: una tarjeta de torneo en inscripción no debería llevar a
`/tournaments/[id]` (sin cuadro que enseñar, la ficha solo diría "este torneo
todavía no tiene cuadro") — en su lugar, un botón "Register now" directo al propio
torneo en el foro de Mana Games.

`TournamentCard` deja de envolver la tarjeta ENTERA en un `<Link>` cuando
`status === "registration"`: pasa a ser un `<div>` sin enlace (sin la animación de
crecida al pasar el ratón, que ya no aplica si no es clicable), con un botón
"Register now" en el sitio donde normalmente sale el campeón — `target="_blank"` a
`OT_ViewTournament.php?Trn=<externalId>` (`lib/mana/links.ts`, nuevo módulo sin
dependencias de Node/Playwright a propósito, para poder importarlo desde un
componente que puede acabar en el bundle del navegador).

`TournamentCardData` gana `externalId: string | null` (el `Trn=` real; `null` para
las Tour Finals, que no vienen de `OT_ViewTournament.php`). `lib/tourQueries.ts` pasa
a seleccionar `e.external_id` en las dos consultas que alimentan esta tarjeta.

## 2026-08-15 — Escudos de Winston Salem y Cleveland + banner de guía en Torneos

**Escudos que no salían**: dos bugs de nombre, no de fichero — los dos PNG ya estaban
copiados en `public/tournament-logos/`. `TOURNAMENT_LOGO_FOLDER` tenía la clave
`"Winston-Salem"` (con guion) pero `events.display_name` en la base de datos es
`"Winston Salem"` (con espacio) — nunca casaba. `Cleveland` directamente no tenía
entrada en la tabla. Auditado el resto de la tabla contra los nombres reales de
`events` (todas las demás claves casan, y todo lo mapeado tiene su fichero) — no hay
más bugs de este tipo ahora mismo.

**Banner "First time competing?" en `/tournaments`**: enlace entero clicable
(`target="_blank"`) a la guía de Tennis Elbow Hub
(`tenniselbowhub.live/guides/how-to-play-online-matches-the-official-tour-xkt`),
debajo de la cabecera y por encima de la primera semana — "torneos" es la página
principal de esa sección del sitio (el ítem de navegación se llama así), a diferencia
de la ficha de un torneo concreto.

## 2026-08-15 — Tarjetas de partido más anchas (nombres normales se partían en dos líneas)

Pedido con captura: "maastodontee (17)" se partía en dos líneas dentro de la fila del
cuadro principal — a 260px de ancho, el hueco real para el nombre (descontando
bandera, check de ganador y columnas de marcador) rondaba los 126px, insuficiente para
un nombre de usuario normal con seed.

`MATCH_CARD_WIDTH` (cuadro principal, `MatchCard.tsx`) sube de 260 a 300 — el resto de
la geometría del cuadro (`lib/bracketGeometry.ts::CARD_WIDTH`/`COLUMN_PITCH`,
`BracketColumns.tsx`) se recalcula sola a partir de esta constante, no hacía falta
tocar nada más ahí. `FINALS_CARD_WIDTH` (`FinalsMatchCard.tsx`) sube igual a 300 para
mantener la misma familia visual con `MatchCard` (decisión ya tomada antes: las dos
comparten medidas a propósito).

## 2026-08-15 — "Not fixed": el seed partía por la mitad, y 300px seguía sin bastar

El intento anterior (300px) no era suficiente — nombres en mayúsculas
("OOGABOOGA2808") o partidos a 3-4 sets (más columnas de marcador comiéndose el hueco
del nombre) seguían envolviendo. Y había un bug real aparte: el seed se partía POR
DENTRO del paréntesis ("JorgeCas (9" en una línea, ")" en la siguiente; "mvkmatt445" /
"7") — `break-words` rompe donde haga falta dentro de un "token" sin espacios de
verdad, y entre el nombre y el `<span>` del seed no había ningún carácter de espacio
real, solo un margen (`ml-1`, invisible para el algoritmo de saltos de línea).

Dos arreglos:
1. Espacio de verdad (`{" "}`) entre el nombre y el seed, con el `<span>` del seed en
   `whitespace-nowrap` — el salto de línea, si hace falta, cae ANTES del `(N)`, nunca
   dentro.
2. `MATCH_CARD_WIDTH` (y `FINALS_CARD_WIDTH` a la par) sube otra vez, de 300 a 340.

## 2026-08-15 — Tarjetas dinámicas: crecen solas según lo que pida el nombre, no un ancho fijo adivinado

Pedido explícito, tras dos rondas de "sube el número fijo y sigue sin bastar" (260→300→340):
que la tarjeta crezca ella sola según haga falta, no que seamos nosotros adivinando un
número cada vez más grande.

**Medición real, no aproximación por caracteres**: `lib/textMeasure.ts` mide el ancho
de un texto con un nodo real fuera de pantalla (mismas clases de Tailwind que la fila
de verdad), no contando letras — "OOGABOOGA2808" en mayúsculas no pesa lo mismo por
carácter que "gyrmik". `MatchCard.tsx::measureRequiredCardWidth` replica en números la
fila real (`px-3`, `gap-2.5`, bandera `w-6`, check `16px`, columnas de marcador `w-4`)
y mide nombre + `(seed)` de verdad, con un colchón de 12px (dos medidas independientes
sumadas se quedan un pelín cortas de la caja real cuando van pegadas en línea).

**El ancho es por RONDA, no por tarjeta suelta**: `lib/bracketGeometry.ts` ya no tiene
un `COLUMN_PITCH` fijo — cada ronda ocupa el ancho que le pida su nombre más largo
(`BracketColumns` mide todas las tarjetas de esa ronda y se queda con el máximo), para
que las tarjetas de una misma columna sigan alineadas entre sí. Rondas distintas pueden
tener anchos distintos.

**Bug real encontrado a mitad del camino, no solo falta de margen**: la primera versión
calculaba el ancho dentro de un `useMemo` normal, en el cuerpo del render. Como
`app/tournaments/[id]/page.tsx` genera la página de forma estática (`revalidate`), el
PRIMER render de `BracketColumns` (un Client Component) pasa por el servidor — donde
`document` no existe, así que `measureText` devuelve 0 y el ancho calculado ahí siempre
sale igual al mínimo. Al hidratar, React vuelve a calcular en el navegador (ahí sí sale
el valor correcto), pero como el resultado de ese `useMemo` YA no coincide con lo que
mandó el servidor, React registra el desajuste y **no lo corrige** ("This won't be
patched up", texto literal del aviso) — la tarjeta se quedaba congelada en el ancho
mínimo para siempre, sin importar lo larga que fuera la medida real. Arreglo: el
cálculo se mueve a un `useEffect` (solo corre en el cliente, después de montar) que
actualiza un `useState` — el primer pintado (servidor + hidratación) sale idéntico en
los dos lados con el ancho por defecto, y el ancho real llega en un segundo pase, ya
sin nada que hidratar. Verificado con Playwright leyendo directamente el atributo
`style` del DOM (no solo el valor "pedido" en React) para confirmar que el arreglo
funciona de verdad, no solo sobre el papel.

## 2026-08-15 — Sección "Scores": ingesta aditiva, no reemplazo, porque la fuente es una ventana rodante

`OT_LastResults.php` no es un archivo — muestra solo los últimos ~10 días de partidos
reportados, y cada refresco puede pisar total o parcialmente lo que trajo el anterior.
Todos los demás loaders (`loadTournament`, `loadRanking`) borran y reinsertan porque su
fuente es una instantánea completa de algo estable; aquí borrar-y-reemplazar habría
capado nuestro histórico acumulado al tamaño de la última foto, deshaciendo el propósito
de tener el botón "Refresh" para uso repetido. `recentResults` usa en su lugar
`onConflictDoNothing` sobre una clave natural `(reportedAt, winnerId, loserId, round)` —
idempotente, cada refresco solo añade lo que todavía no estaba.

**No hizo falta reconocimiento nuevo**: `docs/estructura.md` §4 ya documentaba esta
página desde la fase 1, y ya había una muestra archivada
(`raw/explore/last_results.html`) — se reusó tal cual como fixture del parser
(`parsers/lastResultsPage.ts`), sin volver a golpear el foro para explorar.

**El circuito (ATP Tour / Challenger / Futures) se deriva, no viene en la fuente**:
`OT_LastResults.php` no distingue circuitos — `lib/tournamentCircuit.ts` lo deriva de
`editions.category` (`"CT "...` → Challenger, `"Future"` → Futures, el resto → Tour),
verificado contra la distribución real de categorías en base de datos antes de escribir
la función (69×`250`, 50×`500`, 48×`Masters 1000`, 24×`Grand Slam`, 14×`CT 125`,
14×`Future`, 7×`CT 100`, 6×`CT 80`, 4×`CT 90`, 1×`Exhibition`).

**Resolución de `editionId` por `Trn=`, sin comparar nombres**: cada fila de
`OT_LastResults.php` trae el `Trn=` del torneo en el enlace, el mismo identificador
externo que ya usa `editions.externalId` — se resuelve con un único `inArray` por lote
en vez de repetir la heurística de nombre-más-parecido que sí hace falta en otros sitios
del proyecto donde el `Trn=` no está disponible. Una fila sin edición resuelta
(torneo fuera de nuestra ventana 2021+, o török edge case) se excluye de `/scores`
en vez de adivinar su circuito — sin edición no hay forma de saber a qué categoría
pertenece.

**Inserción fila a fila, no en lote**: `recentResultSets` depende del `id` autogenerado
de su `recentResults` padre. Un `insert().values([...]).onConflictDoNothing().returning()`
en lote no devuelve las filas que sí chocaron con el conflicto, así que el índice de la
respuesta deja de corresponder al índice del lote de entrada en cuanto hay algún
duplicado — exactamente el caso normal de un refresco repetido. Se inserta de una en una
para poder enlazar cada set con su partido de forma fiable.

**Tope de 6 partidos por bloque de torneo** (`RECENT_LIMIT` en `lib/scoresQueries.ts`):
pedido explícito ("Must show only the last 6 reported scores"), aplicado por torneo
(`editionId`), no de forma global — cada bloque enseña sus 6 más recientes aunque haya
reportado más dentro de la ventana de 10 días de la fuente.

Verificado en vivo tras un refresco real (98 resultados parseados, 98 insertados en la
carga inicial): los tres circuitos renderizan correctamente sobre datos reales — Futures
salió vacío en esa foto concreta porque, comprobado contra la base de datos, no hay
ningún resultado Futures en la ventana de 10 días de ese refresco (no es un fallo de
resolución de edición: 0 filas sin `editionId`).

## 2026-08-15 — Tarjetas de Scores: posición real del cuadro, resuelta al consultar

`ScoreMatchCard` ponía siempre al ganador arriba — no era fiel al cuadro real (el
ganador no siempre entra por la plaza de arriba). Se resuelve contra `matches`
(`editionId` + `round` + `winnerId`) en `lib/scoresQueries.ts` con un `LEFT JOIN`, no en
la carga: mismo criterio que el cuadro de torneo ("se reconstruye desde los partidos, no
se guarda su posición", más arriba en este documento) — así una fila de `recentResults`
insertada antes de cargar el cuadro de esa edición se autocorrige sola la próxima vez que
alguien visite `/scores`, sin tocarla. Sin partido resuelto (`draw: null`), la tarjeta cae
al comportamiento anterior (ganador arriba, sin seed). `ScoreMatchCard` pasó a reutilizar
`lib/matchScore.ts::scoreFromPerspective` en vez de su propio cálculo de marcador — la
misma función que ya usan el cuadro y `RecentActivity`.

## 2026-08-15 — Live Scores: live-tennis.cn, filtrado a tres criterios, sin persistencia

Pedido explícito: mostrar partidos EN VIVO del tour, sacados de un agregador chino de
partidos TE4 (`live-tennis.cn/zh/te`) que rastrea TODO TE4 en vivo, no solo nuestro tour
— hace falta distinguir un partido real del tour de cualquier otro. Reconocimiento
propio antes de escribir nada (mismo criterio que la fase 1 con Mana Games, aunque esta
fuente no está en CLAUDE.md — el principio aplica igual a cualquier fuente nueva):

- **La página es HTML servido, sin verificación JS** — un `curl` plano ya trae los
  bloques de partido completos, igual que un render real de Playwright. A diferencia de
  Mana Games, no hace falta contexto persistente de Chromium: `lib/liveTennis/fetchLive.ts`
  es un `fetch()` normal.
- **Pero `/robots.txt` del mismo dominio devolvió un challenge de Cloudflare activo** —
  no se pudo leer la política real de rastreo. Cloudflare SÍ vigila el dominio, solo que
  (todavía) no esta ruta concreta. Riesgo real de que el scraping automático empiece a
  fallar más adelante si Cloudflare decide vigilarla también — por eso
  `app/api/live-scores/route.ts` nunca lanza: cualquier fallo (fetch, parseo, challenge)
  devuelve lista vacía, la sección "Live Now" simplemente no se pinta, igual que el
  párrafo de contexto del H2H.
- **El formato del partido y la pista son atributos reales del DOM**, no solo texto en
  chino: `best-of="3"` en vez de comparar contra "三盘两胜" (mismo dato, más resistente a
  cambios de redacción), y `.cResultCourtTitle` es literalmente el nombre de la pista/skin
  ATP-WTA. Se comprobó 1:1 contra `public/surfaces.txt` (que el propietario añadió): las
  pistas reales del tour coinciden, y una pista genérica que apareció en una foto real
  ("Grass") correctamente NO está en el fichero — confirma que el filtro funciona.
- **Los nombres de jugador son el nick literal del juego**, no el nombre real —
  contrastados contra jugadores reales ya en `players` (`maastodontee`, `Dani21`,
  `javilupsi`...), así que un cruce exacto contra `players.display_name` basta, sin
  heurística difusa.
- **El tercer criterio (cruce real en un torneo nuestro en curso) usa `pending_slots`,
  no `matches`.** `matches.outcome` es un enum NOT NULL de desenlaces ya decididos —
  no hay fila "pendiente" ahí. Un partido en curso, visto desde nuestro lado, es
  exactamente una fila de `pending_slots` (pareja ya emparejada, sin marcador) en una
  edición sin ronda 'F' decidida (mismo criterio que `statusOf` en `lib/tourQueries.ts`).
  `lib/liveTennis/resolveAgainstOngoing.ts` hace esa consulta por candidato.
- **Sin tabla de persistencia ni Vercel Cron**: `vercel.json` solo tenía un cron diario
  y la granularidad mínima de Vercel Cron no encaja con algo que se quiere "en vivo" de
  verdad. Se pide en caliente en cada carga de `/scores` (vía `app/api/live-scores`) más
  un `setInterval` de 30 s en `LiveScoresStrip` (cliente) para refrescar sin recargar la
  página — más simple que un cron+tabla, y más fiel a "vivo" que una foto periódica.

**Verificado contra datos reales de verdad, no solo con fixtures**: una pasada en vivo
del pipeline completo encontró 8 partidos en curso, 3 de ellos `best-of="3"`, 2 sobre
pista real del tour ("Cincinnati ATP 1000"), pero **0 resueltos contra la base de
datos** — investigado a fondo en vez de asumido: el cruce real
("maastodontee vs Dani21") no estaba en nuestros `pending_slots` de Cincinnati (edition
2790) porque Dani21 ya había avanzado de ronda en el juego real pero esa nueva pareja
de R4 todavía no se había vuelto a scrapear desde el panel de admin — limitación real de
frescura, no un fallo del filtro (el filtro de formato+pista sí encontró exactamente los
dos partidos esperados, comprobado partido a partido). La precisión de Live Scores
depende de lo reciente que esté el cuadro de cada torneo en curso; no se ha construido
nada para refrescar automáticamente el cuadro cuando esto pasa, queda anotado como
limitación conocida.

**Bug real encontrado en la propia verificación**: la primera versión de
`LiveMatchCard` envolvía toda la tarjeta en un `<Link>` al torneo, con los nombres de
jugador (también `<Link>`, a su ficha) dentro — `<a>` anidado dentro de `<a>`, HTML
inválido, error de hidratación real capturado en la consola del navegador
(`.next/dev/logs/next-development.log`) al probar con una respuesta simulada de la API.
Arreglado quitando el enlace de tarjeta completa y añadiendo un pill "Draw" explícito al
pie, mismo patrón que ya usan `ScoreMatchCard`/`TournamentScoresBlock` para el mismo
problema (enlace secundario explícito en vez de la tarjeta entera siendo un enlace).

## 2026-08-15 — Dos bugs reales de Live Scores, encontrados con capturas del propietario

**Nombre largo cortado en "Live Now"**: `LiveMatchCard` tenía un ancho FIJO (`width: 280`)
con el nombre en `truncate` — mismo síntoma que el bug de las tarjetas del cuadro
principal (ver más arriba, "Tarjetas dinámicas"), pero aquí no hacía falta la máquina de
medición real: `LiveScoresStrip` es 100% cliente (arranca en `matches: null` y solo pinta
contenido después de que el `fetch` resuelve, nunca hay HTML de servidor con datos que
hidratar), así que no hay riesgo de desajuste servidor/cliente. Se cambió `width` fijo por
`minWidth` y `truncate` por `whitespace-nowrap` — la tarjeta simplemente crece con el
contenido, sin medir nada.

**Seeds cambiados en las tarjetas de Scores**: el propietario comparó una captura de
`/scores` contra el cuadro real y los dos seeds de cada partido salían intercambiados
("javilupsi (6)" en vez de "(7)", y viceversa con Gyrmik). Causa: en `ScoreMatchCard.tsx`,
cuando el ganador ocupaba la plaza `player2` del cuadro, el código pegaba `player2Seed`
al PERDEDOR — que en esa rama es quien realmente ocupa `player1`. El seed tiene que ir
con la PLAZA (`player1Seed` con quien sea que esté en `player1`, gane o pierda), nunca con
"ganador/perdedor". Arreglado calculando primero quién ocupa cada plaza
(`player1 = winnerIsPlayer1 ? winner : loser`) y solo después aplicando el seed que le
corresponde a esa plaza. Verificado contra el cuadro real de Cincinnati/Montreal
(Trn=2092): las tres parejas que salían mal en la captura del propietario coinciden
exactamente con el cuadro después del arreglo.

## 2026-08-15 — Live Scores, tercera vuelta: en el cuadro, en la ficha de jugador, y comentario en vivo

Petición explícita con tres partes, todas apoyadas en `/api/live-scores`
(`lib/liveTennis/resolveAgainstOngoing.ts::LiveTourMatch[]`) sin scraping nuevo:

**Sondeo compartido en un solo sitio**: `app/tournaments/[id]/page.tsx` y
`app/players/[id]/page.tsx` siguen siendo estáticas (`revalidate = 3600` +
`generateStaticParams`, cientos de páginas pregeneradas) — nada de esto las vuelve
dinámicas. `lib/liveTennis/useLiveScores.ts` (hook cliente nuevo) centraliza el
`fetch`/`setInterval` de 30 s que antes solo tenía `LiveScoresStrip`, y de paso guarda la
última foto por partido (`useRef`) para poder detectar roturas entre una petición y la
siguiente — los tres consumidores (`LiveScoresStrip`, `BracketColumns`, el nuevo
`PlayerLiveBanner`) comparten el mismo hook en vez de triplicar el sondeo y, sobre todo,
el seguimiento de la foto anterior.

**En el cuadro**: los ids de `LiveTourMatch.player1/player2` son literalmente
`pending_slots.player1_id/2_id` (se copian tal cual en `resolveAgainstOngoing.ts`), así
que coinciden 1:1 con `match.player1Id/player2Id` del propio cuadro sin falta de
reconciliar nombres — `BracketColumns` solo necesita un mapa por pareja de ids
(`pairKey`), filtrado a su propia `editionId` (prop nueva). Solo se engancha a tarjetas
`outcome === "pending"`: un bye o un cruce ya decidido nunca se sustituye.

**El ancho de columna no se vuelve a medir cuando algo se pone en vivo**: el ancho de
cada ronda se calcula una sola vez (`BracketColumns`, antes de saber qué está en vivo).
Recalcularlo cada vez que llega una respuesta de `/api/live-scores` habría movido las
columnas bajo el usuario. En vez de eso, `measureRequiredCardWidth` reserva hueco fijo
(4 columnas numéricas) para CUALQUIER tarjeta `pending`, en vivo o no — barato y evita el
reajuste.

**Comentario en vivo, solo lo que el marcador dice** (`lib/liveTennis/commentary.ts`):
deuce/punto de juego/punto de rotura a partir de la escalera de puntos
`0-15-30-40-Ad` (una etiqueta que no está en esa lista corta el comentario, no se
adivina); punto de set solo en los casos sin ambigüedad (con 6-6 en juegos no se sabe el
marcador del tie-break, así que no se dice nada); punto de partido añade que el jugador
ya tenga `SETS_TO_WIN - 1` sets completados. Las dos frases pedidas literalmente
("sirve para el partido" / "sirve para seguir en el partido") son ese mismo punto de
partido visto desde el lado que saca. **"X rompe" no sale de una sola foto** — hace falta
comparar dos peticiones (`detectBreak`): si quien saca cambió y los juegos del que dejó
de sacar no subieron mientras los del otro sí, se acaba de romper; sin foto anterior o
con el número de sets cambiado entre medias, no dice nada. Los tres consumidores llaman
al mismo `liveCommentary(match, previous)`, ninguno tiene su propia lógica de frases.

Verificado con las tres superficies reales y una respuesta simulada de `/api/live-scores`
(mismo par real Shomyleee/Dunlop, R4 de Cincinnati): tarjeta del cuadro con marcador en
vivo + insignia LIVE + "Game point, Shomyleee"; aviso en la ficha de Shomyleee
("Playing now vs Dunlop — 6-5 · 30", "Set point, Dunlop"); tira de `/scores` con la misma
frase. Cero errores de consola/hidratación en las tres.

## 2026-08-15 — Dos bugs más, reportados con capturas: contraste en modo claro y tarjetas de Finals superpuestas

**`RankingViewToggle` ilegible en modo claro**: sus pestañas inactivas ("Race to
Finals", "Next Gen Race") usaban `bg-white/10 text-white/70` — blanco translúcido
pensado para ir sobre navy. El componente en realidad NO vive dentro de
`PageMasthead` (a diferencia de `SeasonTabs`, que sí y por eso nunca dio este problema):
`app/rankings/page.tsx` lo monta suelto en el cuerpo de la página, sobre
`--paper-tint`, que en modo claro es casi blanco — blanco sobre blanco. Arreglado con
los tokens de contenido que ya usa el resto del sitio (`bg-rule/60 text-muted-label`,
sensibles al tema), verificado en los dos modos.

**Tarjetas de `FinalsMatchCard` superpuestas en la fase de grupos**: `FinalsMatchCard`
tiene un ancho fijo (`FINALS_CARD_WIDTH = 340`, a propósito, para ir a juego con
`MatchCard`). `app/finals/[id]/page.tsx` metía esa tarjeta en una rejilla
`sm:grid-cols-2` DENTRO de otra rejilla `lg:grid-cols-2` (Grupo A y Grupo B en
paralelo) — dos niveles de "a partir de tal ancho de VENTANA, dos columnas", que no
tienen en cuenta que la celda real ya está partida a la mitad por la rejilla de fuera.
Hecha la cuenta con el ancho real de `tour-container` (1200px máx, con su relleno):
la celda de un grupo nunca llega a los ~692px que hacen falta para dos tarjetas de
340px más el hueco, en ningún ancho de ventana por debajo del tope del contenedor — no
era un caso límite, la rejilla de dentro estaba condenada a desbordar siempre que la
de fuera estuviera activa. Arreglo: `grid-cols-[repeat(auto-fit,minmax(340px,1fr))]`
en vez de un número de columnas fijo — dos columnas de verdad solo cuando el ancho
disponible da para ellas, si no una. Verificado a 900/1280/1600px: nunca hay solape,
y a 900px (rejilla de fuera todavía a una columna) sí aprovecha las dos columnas de
dentro porque ahí sí que hay sitio real.

## 2026-08-16 — "Player activity": temporada completa + filtro de nivel, no un tope de 50 partidos

Pedido con referencia ATP: la sección enseñaba los últimos `MATCH_HISTORY_LIMIT = 50`
partidos del jugador sin más — para alguien con seis temporadas activas, eso podía
cortar a media temporada actual sin avisar. Se cambia a temporada completa (sin tope) +
selector de año + filtro de nivel, con los mismos criterios ya establecidos en el resto
del sitio:

- **Filtros por URL real** (`?year=&tier=`), no estado local — mismo patrón que
  `RankingFilters`/`SeasonTabs`/`CircuitTabs`: enlace compartible, botón atrás
  funciona. El año usa `Select` (como `RankingFilters`), el nivel usa pestañas-enlace
  (como `CircuitTabs`) — se combinan en un componente nuevo,
  `components/players/ActivityFilters.tsx`, porque ninguno de los dos existentes
  cubre "año + nivel a la vez" y duplicar el año no valía la pena.
- **El nivel reutiliza el mismo reparto de tres vías que `/scores`**
  (`lib/tournamentCircuit.ts`: tour/challenger/future), no una taxonomía nueva — la
  referencia ATP filtra por "Series" más fino (GS/Masters/500/250 por separado), pero
  eso habría sido una segunda forma de clasificar `editions.category` sin más beneficio
  real que la ya existente.
- **Sin Prize Money.** La referencia la trae; ya se decidió antes (ver más arriba,
  "'Recent activity' del jugador, agrupado por torneo") que el tour no mueve dinero
  real y ese dato no se inventa. La franja de resumen nueva se queda en Record (W-L) y
  Titles — agregados ya establecidos, con la misma regla de `getCareerStats` (un w.o.
  no cuenta como derrota para quien no pudo jugar) aplicada ahora sobre el
  año/nivel filtrado en vez de sobre toda la carrera.
- **Año por defecto: la temporada más reciente con partidos de verdad**, no el año
  natural en curso — un jugador puede no haber jugado esta temporada, y por defecto
  aterrizar en una vista vacía habría sido peor experiencia que aterrizar en su último
  año con actividad real.
- La consulta de partidos pasa de `ORDER BY ... LIMIT 50` a `WHERE editions.year = :año`
  sin límite — el filtro de nivel se aplica en JS sobre los grupos ya construidos
  (reutilizando `tournamentCircuit`), sin segunda consulta.

Verificado contra un jugador real con seis temporadas y niveles mixtos (Heat, id 6,
270 partidos en total): el año por defecto (2026) muestra la temporada completa sin
recortar, cambiar de año conserva el nivel elegido y viceversa (parámetros
independientes en la URL), el filtro Challenger en una temporada donde solo jugó ATP
Tour da el estado vacío correcto ("No matches recorded for 2025") en vez de una lista
en blanco sin explicación, y el filtro ATP Tour reproduce el mismo récord (32-20) que
"All" para esa temporada — confirma que no se estaba perdiendo ningún partido por el
camino.

**Nota aparte, sin relación con esta función**: durante esta sesión `docs/` apareció
movido a `db/docs/` en el árbol de trabajo, sin que nadie de esta conversación lo
hiciera a propósito — probablemente un arrastre accidental en el explorador de
ficheros del editor. Se confirmó con el propietario y se devolvió a `docs/` antes de
seguir; queda anotado por si vuelve a pasar.

## 2026-08-16 — Finals cuentan como torneos de verdad: en /tournaments, y sus partidos cuentan en todas partes

Petición explícita del propietario, en sus palabras "radical change". Hasta ahora
`finals_editions`/`finals_participants`/`finals_matches`/`finals_sets` vivían
completamente aparte de `events`/`editions`/`matches` — decisión deliberada al
construirlo (ver más arriba en este documento, la fase de Finals): sin `Trn=` externo
y con round robin + eliminatorias cruzadas, no encajaba en el esquema pensado para
cuadros de eliminación directa de Mana Games. Esa parte NO se deshace — el flujo de
admin (seeding, standings, suplencias) sigue siendo genuinamente distinto y no
compensaba reconstruirlo sobre `matches`/`pending_slots`/`byes`. Lo que sí cambia:

**Un ESPEJO, no una migración.** Cada partido de Finals ya decidido se copia a
`matches`/`sets` bajo una `editions` sintética propia (`lib/finals/mirror.ts`), en
vez de mover las tablas de Finals. `finals_matches`/`finals_sets` siguen siendo la
fuente de verdad para el panel de admin; el espejo es una proyección de solo lectura
para todo lo demás. Dos funciones:

- `ensureMirroredEdition`: idempotente (`finals_editions.mirrored_edition_id`), crea
  `events`/`editions` la primera vez que hace falta — `surface: null` (Finals no
  tiene pista real, y `editions.surface` pasó a nullable en esta misma tanda,
  `ALTER COLUMN surface DROP NOT NULL`), `category`: "Tour Finals"/"Next Gen Finals",
  `drawSize`: participantes activos de verdad. `sources` gana una fila `slug: 'xkt'`
  (creada sola, sin seed manual) — CLAUDE.md §3 ya preveía esto: "de momento solo
  mana, más adelante nuestro propio torneo".
- `syncMirroredMatch`: solo para un partido YA DECIDIDO (mismo criterio que
  `pending_slots` — un cruce sin jugar no tiene fila en `matches` tampoco para un
  torneo real). Ronda `stage`/`group` -> `RR-A`/`RR-B` (grupo) / `S` (semifinal) / `F`
  (final) — mismo vocabulario S/F que ya usa un cuadro real, así que `roundLabel()` lo
  pinta "SF"/"F" sin tocar nada más. Idempotente vía `finals_matches.mirrored_match_id`.
  Enganchado en los DOS únicos sitios donde se cierra un resultado de Finals:
  `writeMatchResult` y `forceWinMatch`, en `app/admin/finals/actions.ts`.

**Por qué "cuenta en todas partes" sale casi gratis**: career stats
(`lib/h2hStats.ts::getCareerStats`), actividad de temporada
(`app/players/[id]/page.tsx`) y la propia elegibilidad de Next Gen Race
(`getNextGenRaceRanking`) ya leen `matches` JOIN `editions`/`events` de forma
genérica, sin excluir ninguna fuente — en cuanto el espejo existe, cuentan un partido
de Finals sin tocar ni una línea de esas consultas.

**El H2H YA tenía su propio camino para Finals** (`finalsMeetings`, parámetro de
`getH2HBreakdown`, alimentado por `lib/finals/h2h.ts`) — descubierto a mitad de esta
tarea, no en el reconocimiento inicial. Sin cuidado, el espejo habría duplicado cada
partido de Finals en el H2H (una vez por el camino bespoke, otra por `matches` vía el
espejo). Se optó por NO tocar ese camino ya correcto (excluye a propósito
superficie/categoría, que Finals no tenía hasta ahora) — en vez de eso,
`getH2HMeetings` gana un filtro `editions.source_id IN (SELECT id FROM sources WHERE
slug = 'mana')` para que nunca vea las ediciones espejadas. Verificado con un caso
real (Jirafalox vs fakefederer, que se cruzaron en el Tour Finals 2025 dos veces,
grupo y final): "Every meeting" sigue enseñando exactamente esas dos filas, no cuatro.

**En `/tournaments` no se reutiliza el camino genérico**, aposta: `getTournamentsByYear`/
`getRecentTournaments` ganan el MISMO filtro por `source_id` — sin él, una edición
espejada con cero partidos decididos (Finals recién empezada) calcularía
`has_draw = false` y saldría como "Registration Open", que las Finals nunca son. En
su lugar, `app/tournaments/page.tsx` añade una sección "Season Finale" propia que
reutiliza `listFinalsEditions()` (ya devolvía el estado correcto) — se extrajo la
conversión a `TournamentCardData` que ya tenía `FinalsEditionCard.tsx`
(`finalsEditionToTournamentCard`) para no duplicarla entre `/finals` y `/tournaments`.

**Bug real encontrado en la propia verificación**: el escudo no salía en la tarjeta.
`getTournamentLogoUrl` busca por `eventName` exacto contra
`lib/tournamentLogos.ts::TOURNAMENT_LOGO_FOLDER`, y `eventName` estaba tomando
`finalsEditions.displayName` — texto libre del admin, típicamente "Tour Finals 2025"
CON el año dentro — que nunca iba a coincidir con la clave "Tour Finals" del
diccionario (ni coincidiría el año que viene, con "Tour Finals 2026"). Arreglado
calculando `eventName` a partir de `kind` ("Tour Finals" / "Next Gen Finals" a secas,
igual que cualquier otro torneo recurrente) en vez del texto libre — el año se sigue
viendo aparte (`data.year`), como en cualquier tarjeta de torneo normal. Los escudos
(`tour-finals.png`/`next-gen-finals.png`) ya estaban copiados en `public/` sin usar.

**Backfill único**: la edición "Tour Finals 2025" (y una "Tour Finals 2024" que
también tenía partidos reales) ya tenían resultados cargados — un script suelto
(no parte del código desplegado) llamó a `syncMirroredMatch` para sus 30 partidos ya
decididos entre las dos ediciones. Verificado con un caso real: los títulos de carrera
de Jirafalox subieron a 26 (6 YTD) y su Player Activity de 2025 muestra ahora un grupo
"Tour Finals" con sus 5 partidos (3 de grupo, semifinal y final).

**Dos bugs más, reportados tras ver el grupo "Tour Finals" real en Player Activity**:

1. **Orden de rondas mal en Player Activity para Finals**: dentro de un grupo de
   torneo, `RecentActivity` pinta de la ronda más avanzada a la más temprana
   (`lib/roundOrder.ts::compareByRoundProgression`, que ordena cronológicamente y la
   página invierte para pintar). Esa función usa una tabla fija `ROUND_ORDER` con los
   códigos de un cuadro normal (Q1/R1.../Q/S/F) — los códigos nuevos de Finals
   (`RR-A`/`RR-B`, `lib/finals/stageRound.ts`) no estaban en la tabla, así que
   `roundOrderRank` los mandaba a `+Infinity` (mismo criterio que cualquier código no
   reconocido) — es decir, DESPUÉS de S y F en vez de ANTES. En pantalla salía
   "RR, RR, RR, F, SF" (ronda de grupo primero por casualidad de orden estable de
   `Array.sort`, pero la semifinal DESPUÉS de la final). Arreglado añadiendo
   `RR-A`/`RR-B` a `ROUND_ORDER` con rango -2, antes que cualquier
   otra ronda (el orden entre grupos entre sí no importa, solo que la fase de grupos
   vaya siempre antes de la eliminatoria). De paso, el recuento de títulos de la
   temporada se corrigió solo (12 → 13 para Jirafalox en 2025): `tournamentSummary`
   mira el ÚLTIMO partido del array ya ordenado cronológicamente para decidir
   "Champion", y con el orden roto a veces no caía en la Final.
2. **Marcador de Finals con "-" en vez de "/" en el H2H**: `lib/finals/h2h.ts` (el
   camino aparte que ya tenía el H2H para Finals, ver más arriba) sintetizaba su
   propio `scoreRaw` a partir de `finals_sets` con guiones ("6-0 6-2") y sin marcar
   los tie-breaks — mientras que el resto de la lista "Every meeting" viene del
   `score_raw` real de Mana Games, con barras y el tie-break entre paréntesis pegado
   al perdedor del set ("6/7(3) 7/6(4) 7/5", docs/estructura.md). `H2HMatchHistory.tsx`
   pinta ese campo tal cual, sin reformatear — así que la inconsistencia se veía
   directamente en pantalla, una fila con barras y la siguiente con guiones. Arreglado
   para que la síntesis use el mismo formato que la fuente real.

## 2026-08-16 — Edición admin de Tour Finals: corregir un resultado ya jugado

Pedido: el admin tiene que poder corregir un cruce de Finals que ya tiene resultado
(nombre de la edición y marcador/ganador de cualquier partido), no solo introducir
resultados nuevos. Antes de esto, `[id]/page.tsx` solo montaba `MatchResultForm`
para partidos `scheduled` — en cuanto un cruce se jugaba, desaparecía de la página de
admin sin ninguna vía para tocarlo salvo un `UPDATE` manual en la base de datos.

**`writeMatchResult` ya soportaba reescribir un resultado** (borra+reinserta
`finals_sets`, reencadena `tryAdvanceToKnockout`/`propagateFinalWinner`/
`syncMirroredMatch` en cada llamada, decidido o no) — el único trabajo real era de UI:
`MatchResultForm` gana un modo colapsado ("X ganó 6-4 6-2" + botón "Edit") para un
partido ya decidido, que al pulsar despliega el mismo formulario de siempre
precargado con `defaultChecked`/`defaultValue`. `[id]/page.tsx` pasa ahora TODOS los
partidos de grupo y de eliminatoria (jugados y por jugar), no solo los pendientes.
Nuevo `updateFinalsEditionInfo` permite renombrar `displayName`; `kind`/`year` se
quedan de solo lectura a propósito — son la clave única de la edición y su identidad
estructural, igual que un `Trn=` de Mana Games no cambia de año una vez importado.

**Bug real, encontrado al verificar el reenvío en vivo (no por `tsc`/`vitest`)**:
reenviar el resultado de un partido de GRUPO ya jugado tiraba abajo la petición con
`"Group stage is locked: the knockout stage has already started"`. Culpable:
`assertGroupStageEditable` (`lib/finals/knockout.ts`), enganchada en `writeMatchResult`
y `forceWinMatch`, pensada en su momento para impedir tocar la fase de grupos una vez
arrancada la eliminatoria. Pero `tryAdvanceToKnockout` solo siembra semifinales cuando
`remainingPairs` está vacío en los dos grupos — es decir, es estructuralmente
imposible que quede un partido de grupo `scheduled` una vez el estado pasa a
`'knockout'`. El único caso real que el guardián bloqueaba era exactamente el que esta
función acaba de habilitar a propósito: corregir un partido de grupo YA decidido
después de que el torneo siguiera adelante. Se eliminó el guardián (las dos llamadas y
la función, sin más sitios que la usaran) en vez de relajarlo, porque no protegía
ningún caso que todavía pudiera darse.

**Límite aceptado, no resuelto aquí**: si la Final ya se jugó y luego se corrige una
semifinal, `propagateFinalWinner` resiembra bien `player1Id`/`player2Id` de la Final,
pero su `winnerId`/`outcome` viejos no se limpian solos — el admin tiene que darse
cuenta y volver a introducir el resultado de la Final. No se ha construido un sistema
de invalidación en cascada para esto: es una herramienta de corrección manual, no un
deshacer.

## 2026-08-16 — Admin de jugadores: nacionalidad mostrada + reconciliación de alias

Pedido: poder mostrar una nacionalidad distinta de la real sin tocar el dato
scrapeado, y poder mover un alias mal atribuido a otro jugador — la mitad manual de
la reconciliación de identidades que CLAUDE.md §3 deja pendiente ("semiautomática con
confirmación manual", solo se había construido la parte automática).

**`players.country` no es de solo-escritura inicial**: `scripts/load.ts::bulkUpdateCountry`
lo resincroniza contra el HTML archivado en cada `npm run load` completo. Guardar la
corrección ahí mismo se habría perdido en la siguiente carga. Se añadió una columna
nueva, `players.country_override` (migración `0013_handy_william_stryker.sql`), que el
importador no toca — confirmado leyendo `bulkUpdateCountry`, su único `UPDATE` fija
`country`, nunca `country_override`.

**Resolución en la capa de consulta, no en los componentes**: `CountryFlag` se usaba en
13 ficheros, cada uno alimentado por su propia consulta. En vez de tocar los 13, cada
`SELECT` que devolvía `country` pasa a devolver `COALESCE(country_override, country)`
con el mismo alias `country` — la forma de salida no cambia, así que ningún componente
se ha tocado. Sitios corregidos: `lib/tourQueries.ts` (ranking oficial, Next Gen Race,
listados de torneo), `lib/newsQueries.ts`, `lib/h2hPage.ts`, `lib/scoresQueries.ts`,
`lib/liveTennis/resolveAgainstOngoing.ts`, `lib/finals/queries.ts`, y las consultas
propias de `app/players/[id]/page.tsx`, `app/players/page.tsx`, `app/rankings/page.tsx`
y `app/tournaments/[id]/page.tsx`. Verificado en vivo con un caso real (Heat, id 6):
override a "Italy" cambia el escudo en `/players` de `us.svg` a `it.svg`; al vaciar el
campo vuelve a `us.svg` sin tocar el `country` real.

**Reasignar un alias NO borra el jugador que se queda sin él**: partidos ya
importados pueden apuntar a su `id` directamente (`player1Id`/`winnerId`/etc.), no
solo a través de `player_aliases` — borrar la fila de `players` rompería ese
historial. La operación es solo `UPDATE player_aliases SET player_id = ...`, un
`<select>` con todos los demás jugadores (mismo patrón que
`AlternateSubstitutionForm` de Finals) en vez de un buscador nuevo — con unos
cientos de jugadores en total (CLAUDE.md §1), un desplegable plano es suficiente.
Verificado en vivo moviendo un alias real ("Heat", externalId 7422) del jugador 6 al
73 y de vuelta — confirmado que aparece en el jugador destino y vuelve a aparecer en
el original tras revertir, sin pérdida de la fila.

## 2026-08-16 — Noticias generadas por IA (borrador, nunca se publican solas)

Pedido: que el admin pueda generar tantas noticias como sea posible a partir de
resultados, estadísticas, rachas y sorpresas — "sin inventar información". Con el
usuario ya confirmado en la fase de plan: los borradores generados aterrizan como
`status: 'draft'` en la lista de noticias de siempre, igual que uno escrito a mano;
nunca se publican solos.

**Los hechos se calculan en SQL, nunca los deduce el modelo** (`lib/newsGeneration/facts.ts`)
— mismo principio que `lib/h2hNarrative.ts`, ampliado a cinco detectores en vez de uno:
campeón coronado, hito de títulos (primer título o cifra redonda: 5º, 10º...), sorpresa
(hueco de ranking oficial esa semana ≥ 30 puestos), racha de victorias (≥5 seguidas
contra cualquier rival, no un H2H concreto) e hito de ranking (nuevo #1, primer Top 10,
nuevo mejor histórico) — este último solo mira la última semana oficial importada, no
hace falta ventana de fechas porque solo puede ser "nueva" una vez por importación.
Todo sale de `matches`/`ranking_snapshots`/`editions` ya importados, cero scraping
nuevo. Las Finals cuentan aquí tal cual (ya espejadas en `matches` desde la función
anterior) sin ningún caso especial.

**Ventana de "qué es reciente"**: `matches.played_at` casi no está relleno en el
backfill histórico (30 de 5488 filas, ver comprobación en vivo) — se usa cuando existe
(partidos recién metidos, incluida cualquier Finals) y si no, `editions.week_start_date`
(237 de 239 ediciones sí lo tiene). Ninguno de los dos se inventa cuando falta: esa
fila simplemente no puede ser "reciente".

**Deduplicación sin tocar el flujo de publicación**: columna nueva `news.auto_key`
(única, nula en todo lo escrito a mano — migración `0014_luxuriant_jubilee.sql`), con
una clave determinista por hecho (`champion-482`, `win-streak-19-9101`...). Relanzar el
generador sobre el mismo hecho hace `onConflictDoNothing` en vez de duplicar la
historia — necesario porque no hay cron: es el admin quien decide cuándo relanzarlo,
puede que varias veces sobre la misma ventana.

**Bug real, encontrado verificando en vivo con los ~100 candidatos reales de la base
de datos (no se veía con 2-3 llamadas sueltas)**: los detectores de sorpresa e hito de
título salían con "0 aceptados" sistemáticamente, mientras que campeón coronado sí
funcionaba. La causa no era el guardrail antiinvención sino el orden: al lanzar todas
las llamadas a Groq seguidas sin pausa, el límite real del plan (`30 peticiones/minuto
por modelo`, confirmado leyendo la cabecera `x-ratelimit-remaining-requests` de una
tanda de prueba) se agotaba a media lista de campeones, y todo lo que venía detrás
(sorpresas, hitos) recibía 429 — que el código trataba igual que un rechazo del
guardrail, indistinguible en el resumen. Arreglado espaciando las llamadas 2.2s entre
sí (`GROQ_CALL_SPACING_MS` en `app/admin/news/actions.ts`), ~27/min de margen real.
Verificado en vivo tras el arreglo: sorpresa e hito de título pasaron de 0/20 y 0/19
aceptados a 20/20 y 19/19.

**Segundo bug real, en el propio prompt de "sorpresa"**: se le pedía al modelo
"menciona el hueco de ranking" sin dárselo ya calculado — el modelo restaba los dos
puestos por su cuenta y el guardrail rechazaba ese número por no estar literalmente en
los hechos (mismo motivo por el que `h2hNarrative.ts` nunca le pide al modelo una
cifra que no le haya dado ya hecha). Arreglado añadiendo `rankGap` precalculado a
`UpsetCandidate`.

**Verificado en vivo con datos reales** (ventana de 90 días, ~100 candidatos, los
cinco detectores): 72 borradores aceptados de sus respectivos candidatos, leídos a
mano varios de cada tipo — ningún nombre, cifra, torneo o marcador que no viniera ya
en los hechos. Confirmado que quedan como `draft` (no aparecen en `/news`, que filtra
por `status = 'published'`) y que son indistinguibles de un post manual en el panel de
edición. Los 72 borradores de la propia verificación se borraron después: no era un
pedido real de generar contenido, era comprobar que el botón funciona.

## 2026-08-16 — Ranking en vivo (Oficial + Race), con "Current Tournament"

Pedido: una proyección del ranking que se mueva con un torneo en curso, como el Live
Rank de atptour.com, con una columna narrando en qué punto del torneo va cada
jugador. No es un baremo nuevo: Mana Games ya publica un valor de puntos por ronda en
cada cuadro (`<td class="Points">`, docs/estructura.md), nunca antes parseado — todo
lo demás son agregados sobre `matches`/`ranking_snapshots` ya importados (CLAUDE.md
§4), no una fórmula inventada.

**Regla de puntos por ronda**, derivada de la convención de desplazamiento
marcador↔ronda que ya usa `parsers/tournamentPage.ts` (no inventada): el jugador se
lleva los puntos de la columna en la que quedó ELIMINADO (perder en `S` da los puntos
de `S`), salvo quien gana la propia `F`, que se lleva los de la columna `W` (el
escalón de campeón, mayor que el de subcampeón) en vez de los de `F`. Quien sigue vivo
sin perder todavía tiene asegurados los puntos de la columna siguiente a su última
victoria. Verificado que se sostiene con cuadros partidos en varias tablas (64+
jugadores): la columna de frontera (`Q` repetida entre la tabla de rondas tempranas y
la de rondas finales) lleva el mismo valor en datos reales, así que fusionar por
ronda sin más es seguro. Implementado como función pura en
`lib/liveRanking/roundPoints.ts` (mismo criterio que `lib/finals/stageRound.ts`: sin
`@/db/client`, para poder probarla sin arrastrar `DATABASE_URL`).

**Nueva tabla `edition_round_points`** (migración `0015_chemical_mongu.sql`), rellenada
reparseando el HTML ya archivado (`npm run load`, sin volver a la red) — cobertura real
tras el reparse: 235 de 239 ediciones con partidos (las 4 restantes seguían en
inscripción, sin "Main Draw" que parsear).

**Qué semana "expira"**: por número de semana del año anterior, no por resta exacta de
52 semanas (pedido explícito). Si esa semana exacta no tiene ranking oficial
importado, se busca hacia semanas MÁS ALTAS del mismo año anterior hasta encontrar una
que sí lo tenga (`findMatchingPriorYearWeek`, `lib/liveRanking/expiringPoints.ts`); si
el año anterior no existe en absoluto en lo importado, no expira nada. La búsqueda
compara contra las semanas que tiene `ranking_snapshots` (la cadencia propia del
ranking oficial), no contra las semanas de los torneos directamente — dos torneos de
niveles distintos pueden compartir semana de ranking sin ser la misma edición.

**Qué semana está "en vivo"**: la más temprana entre las ediciones todavía en juego
(`lib/liveRanking/liveWeek.ts`, mismo criterio de "en curso" que
`lib/tournamentStatus.ts`). Si dos semanas distintas tienen torneos en curso a la vez,
solo cuenta la más temprana (pedido explícito) — la semana más nueva ni siquiera tiene
ranking oficial todavía sobre el que proyectar. Restringido a `source = 'mana'` con
`iso_week` no nulo: las ediciones espejadas de Finals (`lib/finals/mirror.ts`) no
tienen semana ISO real y quedan fuera solas, sin excluirlas a mano — las Finals no son
parte de la cadencia semanal del tour.

**Universo completo antes de recortar**: aplicar el ajuste en vivo solo al top N ya
pedido dejaría fuera a quien suba de puesto por el torneo en curso y antes estuviera
justo debajo del corte. `app/rankings/page.tsx` pide el ranking entero
(`FULL_UNIVERSE_LIMIT`, mismo patrón ya usado en `app/players/page.tsx`) cuando el
modo en vivo está activo, reordena por puntos en vivo, y recorta a top N después.

**Race no expira puntos, Oficial sí** (pedido explícito) — mismo motivo por el que
`ranking_snapshots.kind='race'` ya existía como algo aparte de `official`: la Race es
puntos de la temporada en curso sin ventana rodante. Race y Next Gen Race están
SIEMPRE en vivo, sin toggle; Oficial arranca apagado y un toggle (`?live=1`,
`components/rankings/LiveRankingToggle.tsx`) lo activa — mismo patrón de enlace real,
sin estado de cliente, que `RankingViewToggle`.

**Frescura de los datos, no un directo real**: los puntos en vivo solo se mueven
cuando el admin vuelve a cargar un torneo desde Mana Games (`addOrRefreshTournament` /
`npm run load`) — igual que cualquier otro dato de torneo en este sitio. Deliberadamente
NO se cruza con `lib/liveTennis/` (el marcador punto a punto de live-tennis.cn): es un
marcador en directo, no un resultado confirmado por Mana Games, y usarlo para otorgar
puntos significaría dar por bueno un resultado que la fuente todavía no ha confirmado.

**Bug real, no causado por esta función, que bloqueaba verificar el reparse**:
`scripts/load.ts::loadTournaments` reventaba con `"ON CONFLICT DO UPDATE command
cannot affect row a second time"` al reparsear todo el archivo. Causa: 4 torneos
(`Trn=2092..2095`) se habían archivado en más de una carpeta de fecha según iban
avanzando (reparseo incremental normal), y el UPSERT por lotes intentaba tocar la
misma fila de `editions` dos veces dentro de la misma sentencia. Arreglado ordenando
los ficheros por ruta (la carpeta `YYYY-MM-DD` ordena bien como texto) y deduplicando
por `externalId` en un `Map` antes de construir el lote — la entrada más reciente
siempre gana.

**Bug real, encontrado verificando en vivo contra el torneo real en curso
(Cincinnati, semana 33 de 2026)**: un jugador que todavía no había debutado en el
torneo (cero partidos decididos, solo un cruce ya emparejado en `pending_slots`) no
salía en absoluto en "Current Tournament" — `getSecuredPointsByPlayer` lo excluye a
propósito (0 puntos asegurados, correcto para la cifra), pero eso también lo dejaba
fuera de la narrativa. Arreglado con `getPendingParticipants`
(`lib/liveRanking/securedPoints.ts`), que cubre a cualquiera con un cruce ya
emparejado aunque no tenga puntos que sumar — produce correctamente "Will play next
in the {ronda}" (verificado con `fakefederer`, real, en Cincinnati R64).

## 2026-08-16 — Fotos de sede como fondo (tarjeta al pasar el ratón + ficha de torneo)

Pedido: usar las fotos que el propietario puso en `public/assets/headers/` (61
ficheros) como fondo de la tarjeta de torneo al pasar el ratón y en la cabecera de la
ficha de torneo, con viñeta. Tabla nueva `lib/tournamentHeaders.ts`, mismo criterio
que `lib/tournamentLogos.ts`: emparejamiento verificado a mano contra los 61 ficheros
reales, nunca adivinado en tiempo de ejecución.

**Tres ficheros del lote se dejaron fuera a propósito**: `almaty_tournimage_2024.jpg`,
`hangzhou-2024-announcement.jpg` y `hong-kong-2024-tournament-image.jpg` no
corresponden a ningún evento de este tour (no hay Almaty/Hangzhou/Hong Kong en
`events`). `houston_tournimage_2019 (1).jpg` es un duplicado exacto del que sí se usa.

**`nitto-atp-finals_tournimage_2024.jpg` NO se usó, mirado a mano antes de decidir**:
la foto entera está cubierta del lockup "Nitto ATP Finals" (marcador central,
banda del pasillo, patrocinador Intesa Sanpaolo) — exactamente lo que CLAUDE.md §6
prohíbe explícitamente por nombre ("los lockups de patrocinador... Nitto. Nada de eso
entra en el repo"). Ni "Tour Finals" ni "Next Gen Finals" tienen foto de cabecera por
este motivo — sus tarjetas y su ficha se quedan sin foto, no con una equivocada.

**Viñeta con el navy de la marca, no negro plano**: `radial-gradient` centrado
arriba, de `rgba(0,10,35,0.55)` en el centro a `rgba(0,10,35,0.96)` en los bordes —
mismo tono que `--navy-900`, para que la foto se sienta parte de la paleta del sitio
en vez de un overlay genérico pegado encima. Lo bastante oscura en todo el área (no
solo en los bordes) para que el texto blanco existente siga leyéndose sin cambiar de
color en el centro de la tarjeta.

**`PageMasthead`** (`components/layout/PageMasthead.tsx`) gana un `backgroundImageUrl`
opcional — solo lo usa `app/tournaments/[id]/page.tsx`, los otros 8 sitios que la usan
siguen exactamente igual (prop `undefined` no cambia nada).

**`TournamentCard`**: la foto y la viñeta son una capa `absolute inset-0` con
`opacity-0 group-hover:opacity-100` — invisible hasta que la tarjeta crece al pasar
el ratón (pedido explícito: "only showed when... enlarged"), con `transition-opacity`
para que aparezca junto con el resto de la animación de crecida ya existente. Todo el
texto de la tarjeta pasa a blanco en el mismo hover (mismo criterio de contraste que
los paneles navy de H2H, `text-white`/`text-white/70`) — antes del hover, con o sin
foto, la tarjeta se ve exactamente igual que siempre.

## 2026-08-16 — Sidebar de todo el sitio (Scores/H2H/Profile/News/Rankings)

Pedido: columna derecha estilo ATP con widgets compactos en todas las páginas, cada
una sin el widget de la sección en la que ya está el lector.

**Dos cosas de la captura de referencia no existen en este sitio, adaptadas en vez de
copiadas**: (1) las pestañas "All Scores/Schedule/Draw" no tienen equivalente aquí
(`/scores` usa ATP Tour/Challenger/Futures, `components/scores/CircuitTabs.tsx`) — el
widget de Scores enseña partidos EN VIVO de verdad (`lib/liveTennis/useLiveScores.ts`,
el mismo hook que ya usa `LiveScoresStrip`) en vez de imitar unas pestañas que no
llevan a ningún sitio real. (2) Las cifras de saque/aces/juegos de servicio de la
captura salen de `match_stats`, una tabla que existe en `db/schema.ts` pero que no
rellena ni lee ningún sitio del proyecto (comprobado por grep) — el widget de Profile
enseña solo lo que `getCareerStats` (lib/h2hStats.ts) calcula de verdad: rank,
puntos, mejor puesto, balance de carrera, títulos. Nada inventado para rellenar el
hueco.

**Sujetos por defecto, sin curación editorial inventada**: el widget de H2H reusa el
emparejamiento nº1-contra-nº2 que `/h2h` ya usa por defecto
(`app/h2h/page.tsx`); el de Profile usa el nº1 oficial de la semana en curso — mismo
criterio, ninguno de los dos "elige" una rivalidad o un jugador con lógica editorial
que no exista ya en el código.

**No hay un wrapper único de layout** (`app/layout.tsx` solo pone nav+`<main>`+
footer; cada página abre su propio `tour-container`) — así que esto es un cambio
página a página, no una línea en el layout. Cada página cambia su `tour-container`
de cuerpo por una rejilla `lg:grid-cols-[1fr_320px]` con el contenido de siempre a la
izquierda y `<Sidebar hide={[...]} />` a la derecha.

**`/h2h` y `/h2h/[p1]/[p2]` no llevan sidebar en absoluto** (pedido explícito). Antes
lo llevaban debajo del contenido, pegado al borde derecho — `H2HView` es varias
franjas navy A TODO LO ANCHO, y meterlo en una columna `1fr` le habría roto el fondo
a sangre completa (el patrón navy de CLAUDE.md §6 en todas las demás páginas) — pero
el propietario prefirió quitarlo del todo en vez de mantenerlo debajo.

**`/rankings` sí lo pone al lado** (pedido explícito tras un primer intento en el que
había ido debajo). El primer intento de ponerlo al lado tampoco valía: medido en vivo
contra el DOM real, la tabla necesitaba 1048px pero solo le quedaban 752px una vez
restado el sidebar, así que sacaba scroll horizontal (`overflow-x-auto`, que ya
llevaba de antes, hacía su trabajo pero el resultado — la tabla "se corta" — era
justo lo que se pedía evitar); y en modo NO vivo, el límite "medium" (1000px) que
tenía la página desde antes de tener sidebar dejaba la columna de jugador en ~80px de
ancho, sin sitio para el nombre. Dos síntomas del mismo problema: nunca se le había
quitado sitio a la tabla antes de esto, y ahora sí.

Arreglado en dos sitios a la vez, no solo recortando: (1) la página pasa a usar
siempre el ancho normal del sitio (1200px), no el "medium"; (2) `RankingTable`, en
modo en vivo, suelta las columnas que la propia referencia de ATP tampoco enseña ahí
(High/W-L/Titles) en vez de apretarlas todas — el ancho en vivo baja de 1048px a
~640px, con margen de sobra dentro de los 752px disponibles. `overflow-x-auto` se
queda puesto como red de seguridad, no como solución.

**`/finals/[id]` usa `xl:` en vez de `lg:` para el propio sidebar**, mismo motivo de
apretar que en rankings pero sin un `overflow-x-auto` de por medio: sus rejillas
internas de grupos/partidos ya usan `lg:grid-cols-2` a ancho completo, ligadas a un
solape ya arreglado una vez — competir por sitio en la misma franja `lg` lo habría
vuelto a romper.

**`/` (home) se queda sin sidebar** — ya tiene sus propias secciones de scores en
vivo, Top 10 y noticias en el cuerpo de la página (`app/page.tsx`); poner los mismos
tres widgets también al lado habría sido puro contenido duplicado. `/admin/*`,
`/login` y `/dashboard` tampoco lo llevan — no son páginas del tour.

Verificado en vivo contra las 13 rutas reales: cada página oculta exactamente su
propio widget y ninguna otra, `/` y `/login` no tienen `<aside>` en absoluto, los
cinco widgets traen datos reales (racha de #1 vs #2 real, nº1 real con sus cifras
reales, noticias publicadas reales, top 10 real), sin errores de consola.

## 2026-08-16 — Sidebar: vídeos, Profile y H2H variables; sync de YouTube con renombres

Cuatro cambios seguidos sobre lo ya construido del sidebar y de la sincronización de
YouTube.

**Widget nuevo "Videos"** (`components/layout/sidebar/FeaturedVideosWidget.tsx`):
reusa `getFeaturedVideos` (`lib/youtube/featured.ts`), ya usada por
`components/news/FeaturedVideos.tsx` en `/news`. Comparte lista de ocultación con
"news" — `/news` ya enseña los vídeos destacados en el cuerpo de la página, así que
el widget se oculta ahí para no duplicar.

**Profile deja de ser siempre el nº1**: ahora es uno cualquiera de los primeros 12
del ranking oficial, elegido al azar en cada carga de página (`Math.random()` sobre
`getTopPlayers(week, 12)`). Verificado en vivo recargando 8 veces: 6 jugadores
distintos vistos (Madferit, 3_Power, javilupsi, Jirafalox, gifu, Dani21).

**H2H deja de ser el emparejamiento fijo nº1-contra-nº2**: ahora es un cruce real ya
emparejado pero SIN JUGAR TODAVÍA (`pending_slots` — dos lados resueltos, sin
marcador), de un torneo del circuito principal (`tournamentCircuit(category) ===
"tour"`, `lib/tournamentCircuit.ts` — Grand Slam/Masters 1000/500/250/Exhibition;
nunca Challenger ni Future, pedido explícito), uno al azar de todos los que cumplan
en cada carga. Si ahora mismo no hay ninguno en el circuito principal, el widget no
sale — no cae a un emparejamiento que no sea el pedido. Verificado en vivo: de 20
cruces reales pendientes, solo 4 eran del circuito principal (el resto CT 125 o
Future), y esos 4 fueron exactamente los vistos al recargar varias veces.

**Bug real en `lib/youtube/sync.ts`**: `syncChannelVideos` marcaba un vídeo como
"visto" en cuanto su `youtube_video_id` entraba en `match_videos` una vez, y a partir
de ahí lo saltaba entero en cada sincronización siguiente — así que un vídeo
renombrado en YouTube (título corregido, etc.) nunca actualizaba el título guardado
ni se reevaluaba con el título nuevo, para siempre. Arreglado: ahora, además de
detectar vídeos nuevos (ya funcionaba), compara el título guardado contra el actual
de YouTube en cada pasada — si difiere, actualiza el título y, salvo que el admin ya
lo hubiera `confirmed` a mano (un renombre no debe pisar una decisión manual), vuelve
a pasar el título por `findMatchForVideoTitle` por si ahora resuelve a un partido
distinto (o por primera vez). Nuevo campo `renamed` en `SyncResult`, mostrado en el
botón "Sync now" del panel de admin.

## 2026-08-16 — Bug real: la flecha +/- en vivo enseñaba el movimiento oficial

Reportado con una captura real: en la vista en vivo del ranking, la columna "+/-"
(Gyrmik ▲2, Franky Franchicha ▼1...) enseñaba exactamente los mismos valores que la
vista oficial — es decir, no reflejaba nada del propio ranking en vivo.

Causa: `getLiveRanking` (`lib/liveRanking/liveRanking.ts`) reordena por puntos en
vivo y renumera `rank`, pero nunca tocaba `moved` — ese campo seguía siendo el que
trae `ranking_snapshots.moved` (semana oficial actual contra la anterior), copiado
tal cual con el resto de la fila. Dos conceptos distintos con el mismo nombre de
campo: "cuánto subió/bajó de la semana pasada a esta" (oficial) frente a "cuánto
sube/baja SI el torneo en curso termina así" (en vivo) — la tabla solo pintaba el
primero, en las dos vistas.

Arreglado calculando el movimiento en vivo de verdad: `rank` oficial (todavía sin
tocar en ese punto del código) menos el `rank` nuevo ya reordenado por puntos en
vivo, antes de sobrescribir `rank`. Sin torneo en curso (el `if (!liveWeek)` de más
arriba), el rank en vivo coincide exactamente con el oficial, así que ahí el
movimiento en vivo es 0 para todos — no el `moved` oficial de la semana pasada,
que sería la misma confusión otra vez. Verificado contra datos reales: Gyrmik
(oficial +2, en vivo 0), Franky Franchicha (oficial -1, en vivo 0) — su puesto no ha
cambiado respecto al oficial de esta semana, aunque sus puntos oficiales ya
llevaran un movimiento de la semana pasada.

## 2026-08-16 — Byes en "Player activity" y los w.o. dejan de contar como victoria (solo ahí)

Pedido: enseñar los byes en el historial de partidos de la ficha de jugador (antes
`RecentActivity` solo leía `matches`, nunca `byes`) y que un walkover ganado deje de
sumar al récord W-L de esa misma sección.

**Byes**: `app/players/[id]/page.tsx` ahora consulta también `byes` para la temporada
seleccionada y mezcla ambas fuentes por `editionId`, reordenando cada grupo con
`compareByRoundProgression` igual que ya hace con los partidos reales — un bye se
intercala en su ronda real, no se amontona al principio o al final. Se le da un
`matchId` negativo (`-byes.id`) porque `matches.id` es siempre positivo (`serial`):
así sirve de key de React sin colisionar y sin tener que inventar un jugador
"Bye" con `opponentId`/`opponentName`/`opponentCountry` falsos — en su lugar
`RecentActivityMatch.opponentId`/`opponentName` ahora aceptan `null`, y la fila
del bye es una rama estructuralmente distinta en `RecentActivity.tsx`
(`m.outcome === "bye"`), no un partido con datos inventados. `tournamentSummary`
ignora los byes al decidir "Champion"/"Lost in X": un bye nunca es la última ronda
real jugada.

**W.o. ya no cuenta como victoria, en todos los sitios que agregan récord**. Primera
pasada: solo se tocó el bucle de recuento de `app/players/[id]/page.tsx` que
alimenta el `StatStrip` de "Player activity". El propio dueño del proyecto reportó
la inconsistencia inmediata: el bloque superior de la ficha (`PlayerHeader`,
"YTD W-L"/"Career W-L") seguía contando los w.o. ganados como victoria, porque sale
de `lib/h2hStats.ts::getCareerStats`, no tocado en la primera pasada. Confirmado con
datos reales antes del segundo cambio: bencu (jugador 286), temporada 2026, "YTD
W-L" en 31-24 (con los 5 w.o. de esa temporada) frente al "W-L" de "Player
activity", en la misma página, ya en 26-24 (sin ellos).

Corregido añadiendo `AND outcome <> 'walkover'` también al `FILTER` de victorias
(antes solo estaba en el de derrotas) en:

- `lib/h2hStats.ts::getCareerStats` — `career_wins` y `year_wins` (alimenta
  `PlayerHeader`).
- `lib/tourQueries.ts::getPlayerTotals` y `getYearRecords` — alimentan la tabla de
  rankings, `app/players/page.tsx` y el `ProfileWidget` del sidebar.

Un w.o. perdido sigue sin contar como derrota para quien no pudo jugar — eso no ha
cambiado, es el criterio original. Los títulos (`career_titles`/`year_titles`) no se
tocaron: ganar la Final por w.o. sigue contando como título, igual que ya hacía
`tournamentSummary` en "Player activity" (no excluye w.o. al decidir si la última
ronda jugada fue la Final). Verificado tras el cambio: bencu pasa a "YTD W-L" 26-24
y "Career W-L" 38-45 (antes 44-45) — ambos bloques de la misma ficha coinciden ya
con el criterio de "Player activity".

Tercera pasada: el propietario reportó que la página H2H (`/h2h/[p1]/[p2]`) también
seguía contando los w.o. como victoria — el marcador central (`player1Wins`/
`player2Wins` en `lib/h2hPage.ts`, calculado aparte de `getCareerStats`, sobre los
cruces directos entre esos dos jugadores) y el desglose por superficie/categoría/
ronda/año y la racha (`getH2HBreakdown` en `lib/h2hStats.ts`) no habían recibido el
mismo tratamiento.

Corregido con el mismo criterio: un w.o. no cuenta ni a favor ni en contra de nadie
en el marcador global, y se descarta por completo (`decisiveMeetings`) antes de
calcular superficie/categoría/ronda/año/racha — no solo se le resta el punto al
ganador, se le quita el cruce entero de la cuenta. Las Finals no participan de este
filtro: `finals_matches` no guarda `outcome`, no hay concepto de w.o. ahí. Efecto
colateral cubierto: si dos jugadores solo se hubieran cruzado por w.o., la racha
viva se queda sin partido del que partir (`chronological[0]` puede ahora no
existir) — devuelve `streakPlayerId: null` en vez de reventar.

Verificado con un caso real y limpio: bishal675 (322) e Iceman (411) solo se han
cruzado una vez, un w.o. ganado por bishal675 — el marcador de `/h2h/322/411` pasó
de 1-0 a 0-0.

No se tocó `lib/finals/*` (sin concepto de w.o.) ni `lib/h2hNarrative.ts` (no
reportado); si aparece la misma inconsistencia ahí, es un cambio aparte.

## 2026-08-17 — Búsqueda global (jugadores, torneos, noticias, vídeos, partidos)

El icono de lupa de la barra de navegación (`components/nav/SiteNav.tsx`) llevaba
ahí desde el principio del sidebar de todo el sitio, pero era decorativo: sin
`onClick`, sin nada detrás. Pedido explícito de hacerlo real y que busque en todo
el sitio: torneos, jugadores, noticias, vídeos y partidos.

**Backend**: `lib/search.ts::searchSite(query)` lanza cinco consultas en paralelo,
una por categoría, todas con `ILIKE '%term%'` y recortadas a 5 resultados cada una
(esto alimenta un desplegable, no una página de resultados paginada):

- Jugadores — `players.display_name`.
- Torneos — `events.display_name`, resuelto contra `editions` (una fila por
  edición/año, no por evento recurrente: la página de torneo real es por edición,
  `/tournaments/[editionId]`, así que buscar "Madrid" devuelve sus últimas 5
  ediciones, cada una a su propia página).
- Noticias — `news.title`, solo `status = 'published'` (nunca un borrador).
- Vídeos — `match_videos.title`, solo `status IN ('auto','confirmed')` (mismo
  criterio que `getFeaturedVideos`, lib/youtube/featured.ts: nunca uno todavía en
  revisión).
- Partidos — `matches` donde el nombre de cualquiera de los dos jugadores hace
  match; sin página de partido individual en el sitio, así que enlaza a
  `/tournaments/[editionId]` (el cuadro), no a un recurso que no existe.

El input del usuario se escapa contra los comodines de `ILIKE` (`%`, `_`, `\`)
antes de construir el patrón — sin esto, buscar literalmente "50%" dispararía un
comodín que el usuario no pidió.

**Frontend**: `components/nav/SearchOverlay.tsx`, un overlay a pantalla completa
(fondo `navy-900/70`, panel `bg-paper` — sigue los mismos tokens que el resto del
sitio, así que hereda claro/oscuro sin tocar nada más) con debounce de 250 ms,
`Escape` para cerrar, clic fuera para cerrar, y cada resultado como
`Link`/`<a>` que cierra el overlay al navegar (`onNavigate`, para no dejarlo
abierto encima de la página nueva).

Verificado con datos reales: `q=gyr` devuelve el jugador, 5 noticias/vídeos/partidos
suyos con "Gyrmik" en el nombre de alguno de los dos rivales, `q=madrid` devuelve
sus 5 últimas ediciones (2022-2026), `q=a` (menos de 2 caracteres) y `q=50%25` no
disparan ninguna consulta ni comodín. Navegación de un resultado confirmada por
Playwright: clic en el jugador de los resultados cierra el overlay y lleva a
`/players/359` (la transición de App Router tarda su segundo, no es instantánea:
un primer intento de verificación comprobó la URL demasiado pronto y pareció que
no navegaba — no era un bug, era leer el resultado antes de que terminara la
transición).

## 2026-08-17 — Búsqueda: de overlay modal a expansión inline

Pedido explícito de cambiar el patrón: no un overlay a pantalla completa, sino que
el propio icono de lupa se "expanda" en la barra de navegación. Sustituido
`components/nav/SearchOverlay.tsx` por `components/nav/SearchBar.tsx`, autocontenido
(ya no depende de estado en `SiteNav.tsx`):

- Colapsado: la píldora mide `w-9` (justo el botón). Al pulsar, crece a `w-56`/`w-72`
  (`transition-[width]`) y el icono de lupa rota 90° mientras cambia a una `×` — no es
  un morph real de trazado SVG, pero el giro simultáneo al cambio de icono y al
  ensanchado de la píldora lee como una sola transformación, no un corte.
  `prefers-reduced-motion` seguirá aplicando aquí igual que en todo lo demás (ver la
  entrada de más abajo).
- El desplegable de resultados cuelga de la propia píldora (`absolute right-0 top-full`),
  no centrado en la pantalla — coherente con que ya no hay fondo oscuro de overlay.
- Cierra con `Escape`, clic fuera (listener de `pointerdown` en el documento, filtrado
  por si el clic cae dentro del contenedor) o al navegar a un resultado.

## 2026-08-17 — Animación en todo el sitio (antes solo en el cuadro)

CLAUDE.md §6 decía explícitamente "la animación se concentra en un sitio: la
navegación entre rondas del cuadro. Nada de efectos repartidos por toda la web".
Pedido del propietario de invertir esa regla — "add as many animation as possible
on the whole website" — señalado como conflicto directo con lo ya escrito antes de
tocar nada; confirmado que quería anular la regla, no solo un par de sitios
concretos. CLAUDE.md §6 queda actualizado con la nueva política.

**La única restricción que se mantiene intacta, y a propósito**:
`prefers-reduced-motion` sigue neutralizando todo, sin excepción — el bloque
`@media (prefers-reduced-motion: reduce)` de `app/globals.css` ya cubría todo el
sitio con selectores universales (`*, *::before, *::after`), así que cualquier
`transition-*`/`animate-*` nuevo queda cubierto automáticamente sin tener que
acordarse de un modificador `motion-safe:` en cada componente nuevo — verificado
tras el cambio con Playwright (`reducedMotion: "reduce"`): tanto la entrada de
`PageMasthead` como el `.row-reveal` de la tabla de rankings caen a
`animation-duration: 0.01ms` bajo esa preferencia.

Piezas nuevas en `app/globals.css` (reutilizables, no una animación por componente
inventada cada vez):

- `.hover-lift` — tarjeta que se eleva con sombra al pasar el ratón.
- `.tap-scale` — botón que se "hunde" al pulsar (no solo al soltar).
- `.row-reveal` + `--reveal-delay` — fila/tarjeta que entra con deslizamiento,
  escalonada por índice (capado a ~20 elementos de retraso creciente para que una
  lista larga no tarde una eternidad en terminar de aparecer).
- `.bar-grow` + `--bar-pct` — barra que crece desde 0 al montarse (una `transition`
  normal no vale para esto: en el primer pintado no hay un valor "anterior" del que
  partir, así que nunca se ve crecer, solo aparece ya llena).
- `.arc-draw` — trazo de arco SVG que se dibuja en vez de aparecer completo,
  usando `pathLength="100"` para no complicar el cálculo del dasharray con la
  geometría real del arco.
- `app/template.tsx` (nuevo) — a diferencia de `layout.tsx`, se remonta en cada
  cambio de ruta: cada página entra con un fundido+deslizamiento sin JS ninguno,
  cubre el sitio entero de una sola vez.

Aplicado, entre otros: tabla de rankings (filas escalonadas, flecha de movimiento
con una pequeña entrada), indicador "Live" con pulso (`animate-ping`), toggle de
tema (el icono sol/luna rota y cambia con fundido en vez de saltar), pestañas de
navegación (`SiteNav`, `AdminTabs`, `CircuitTabs`, `SeasonTabs` — antes cambiaban
de color de golpe, ahora con `transition-colors`), rejilla de jugadores
(`PlayerIndex`, entrada escalonada + elevación al pasar el ratón), paneles del
sidebar (entrada + elevación), cabecera de H2H (aro que se dibuja, paneles de
jugador que entran desde los lados, barras comparativas que crecen desde 0),
"Player activity" del perfil (cada torneo entra escalonado), cabecera de página
(`PageMasthead`, usada en casi toda la web) con el título/subtítulo entrando en
cascada.

No tocado a propósito: `TournamentCard` ya llevaba una interacción de hover muy
elaborada desde antes de esta sesión (crecida, escudo que agranda, panel de
finalista que se despliega) — añadir más encima habría sido ruido, no mejora.
`components/ui/select.tsx` (shadcn) ya trae sus propias animaciones de apertura de
fábrica, tampoco se tocó.

Verificado: `npx tsc --noEmit` y `npx vitest run` (143 tests) limpios tras cada
tanda de cambios; recorrido con Playwright por `/`, `/rankings`, `/rankings?live=1`,
`/players`, `/players/6`, `/h2h`, `/tournaments`, `/scores` sin errores de consola
ni de página.

## 2026-08-17 — Tres roturas reales de la tanda de animación anterior

Reportadas con una captura real, las tres en el mismo mensaje:

1. **Barra de scroll horizontal fantasma en la navegación al abrir la búsqueda.**
   Causa: `SearchBar.tsx` hacía crecer la píldora DENTRO del flujo normal
   (`w-9` → `w-56`/`w-72` como ancho real del contenedor), así que al expandirse
   empujaba al resto de la fila (`justify-between`) y el `<nav>` de la izquierda
   (que ya lleva `overflow-x-auto` a propósito para el caso de pantallas
   estrechas) se quedaba sin sitio y sacaba su propia barra de scroll. Arreglado
   fijando el contenedor a `w-9 h-9` siempre y haciendo crecer la píldora en
   `absolute` (`top-0 right-0 z-20`) por encima del resto — visualmente tapa el
   toggle de tema al expandirse, pero ya no reserva ni empuja espacio de verdad.
   Verificado: `nav.scrollWidth === nav.clientWidth` con la búsqueda abierta.

2. **Las animaciones de Torneos se notaban "más raras" que antes.** No se había
   tocado `TournamentCard` (ver la entrada anterior: a propósito, ya tenía su
   propio hover elaborado), pero sí dos cosas que la tocaban indirectamente: el
   `fade-in`+`slide` de `app/template.tsx` en cada cambio de ruta chocaba con el
   propio `transform` del hover de la tarjeta si el cursor llegaba mientras la
   página todavía estaba entrando, y `SeasonTabs` (usado solo en
   `/tournaments`) había ganado `scale-105`+`tap-scale`. Revertido `SeasonTabs`
   a sus clases originales; `app/template.tsx` se elimina por completo (ver
   punto 3), así que Torneos vuelve a animarse exactamente como antes de esta
   tanda.

3. **"Flash" de colores molesto al cambiar de página, en todo el sitio.**
   Causa: `app/template.tsx` (nuevo en la tanda anterior) envolvía cada página en
   `fade-in` desde `opacity: 0` — como se REMONTA en cada navegación, había un
   instante real en el que el contenido entero (incluida cualquier banda navy)
   era invisible y se veía el fondo plano de `body` (`--paper-tint`) por debajo,
   antes de que el fundido terminara. Con secciones de color fuerte de por medio
   (hero navy oscuro contra un `--paper-tint` mucho más claro en modo oscuro,
   sección de un color contra otra al navegar entre páginas distintas), ese
   instante se leía como un parpadeo de color, no como una transición suave.

   No se ha sustituido por una versión "más sutil" sin preguntar: se ha
   eliminado del todo. Las animaciones de entrada por componente que ya existían
   antes de esta tanda (filas de tabla, tarjetas, aro de H2H, cabecera de
   página...) no tienen este problema porque nunca dejan el viewport en blanco —
   solo el envoltorio de página entera, que oscurecía TODO a la vez, causaba el
   parpadeo. Si se quiere algo de movimiento al cambiar de ruta más adelante,
   habría que hacerlo sin pasar por opacidad 0 en ningún punto (por ejemplo,
   moviendo unos pocos píxeles sin tocar la opacidad).

Verificado: `npx tsc --noEmit` y `npx vitest run` (143 tests) limpios; Playwright
confirma que el `<nav>` ya no desborda con la búsqueda abierta, capturas sin la
barra de scroll fantasma.

## 2026-08-17 — El "arreglo" de Torneos no arregló nada: causa real, capas CSS

El propietario insistió: las tarjetas de Torneos seguían agrandándose "demasiado
rápido" al pasar el ratón, y el síntoma solo aparecía en las que SÍ tienen ficha
propia (enlace `<a>` vía `next/link`) — las que están en inscripción (sin ficha,
`<div>` normal, ver `TournamentCard.tsx`) se veían bien. Esa pista — se rompe en
`<a>`/`<button>`, no en `<div>` — señala directo a la regla `a, button { transition:
... 150ms ... }` añadida el mismo día como "suelo por defecto".

**Causa real, no la que se diagnosticó la primera vez**: esa regla vivía suelta en
`app/globals.css`, fuera de cualquier `@layer`. En Tailwind v4 las utilidades
(`transition-all`, `duration-300`...) viven dentro de la capa `utilities` — y en CSS
moderno, **cualquier regla sin capa gana siempre a cualquier regla con capa,
sin importar la especificidad**. La media de la sesión anterior ("una utilidad de
Tailwind con clase siempre gana a un selector de elemento") solo es cierta cuando
las dos reglas están en la misma capa o ninguna lo está — aquí no era el caso. El
resultado: CUALQUIER `<a>`/`<button>` del sitio con `transition-all duration-300`
puesto a mano (como el hover de `TournamentCard`) se quedaba animando a 150ms de
verdad, sin que ninguna clase de Tailwind pudiera arreglarlo desde el componente.
El primer intento de arreglo (revertir `SeasonTabs`, quitar `app/template.tsx`) no
tocaba esto para nada — atacaba síntomas distintos que sí eran reales (la barra de
scroll y el parpadeo), pero dejó el problema de fondo intacto.

**Arreglo real**: la regla `a, button {...}` se mete dentro de `@layer base {}` —
la misma capa donde ya vive el reset de shadcn un poco más abajo en el fichero.
Con las dos reglas dentro de capas con nombre, gana la última capa declarada
(`utilities`, después de `base`), así que `transition-all duration-300` puesto a
mano en un componente vuelve a ganar como toca; mi regla queda de verdad como
"suelo por defecto" solo para lo que no lleva nada explícito, que es lo que
pretendía ser desde el principio.

Verificado con el propio navegador, no solo leyendo CSS: `getComputedStyle(...)`
sobre una tarjeta de torneo decidida (`<a>`) y una en inscripción (`<div>`) — las
dos en `transitionDuration: "0.3s"` ahora, antes la del enlace estaba en `0.15s`
mientras la del div ya estaba bien en `0.3s` (esto último es justo lo que había
delatado el bug: mismo componente, mismas clases, comportamiento distinto según
la etiqueta HTML). `npx tsc --noEmit` y `npx vitest run` (143 tests) limpios.

**Lección para el futuro**: cualquier CSS nuevo en `app/globals.css` que use un
selector de ELEMENTO plano (no una clase con nombre propio) y pueda coincidir con
algo que Tailwind también controla por clase (`a`, `button`, `input`, `img`...)
tiene que ir dentro de `@layer base {}` — nunca suelto. Las clases con nombre
propio inventadas esta sesión (`.hover-lift`, `.tap-scale`, `.row-reveal`,
`.bar-grow`, `.arc-draw`) no tienen este problema porque no coinciden con ningún
selector de Tailwind, pero la próxima regla de elemento plano si no lleva capa
puede volver a colarse por encima de una utilidad puesta a mano sin que nada avise.

## 2026-08-17 — Torneos y Scores se refrescan solos, pero solo si hay algo en juego

Pedido explícito: `/tournaments`, `/tournaments/[id]` y `/scores` tenían que
ponerse al día solas cada 10 minutos como mucho, sin que alguien tenga que recargar
a mano. Segunda vuelta del pedido, más precisa: **solo mientras haya algo
realmente en curso** — un torneo de 2022 ya terminado, o una temporada entera sin
ningún torneo en juego ahora mismo, no tiene ningún dato nuevo que pueda llegar;
refrescarlo cada 10 minutos igualmente sería tráfico de balde contra la base de
datos por nada.

Dos piezas, una por cada mitad del problema:

- **Techo de la caché (ISR)**: `revalidate` de `/tournaments` y `/tournaments/[id]`
  baja de `3600` (1 hora) a `600` (10 min) — sin esto, una visita nueva a una
  página estática podía traer datos de hasta una hora de antigüedad, aunque el
  torneo estuviera en pleno juego. `/scores` ya iba con `dynamic = "force-dynamic"`
  desde antes (siempre fresco en cada petición), no hacía falta tocarlo.
- **`components/layout/AutoRefresh.tsx`** (nuevo, client): monta un
  `setInterval` que llama a `router.refresh()` cada 10 minutos — no
  `location.reload()`, así que no hay parpadeo ni se pierde la posición de scroll,
  solo se vuelven a ejecutar los Server Components de la ruta actual. Comprueba
  `document.visibilityState === "visible"` antes de disparar: sin sentido gastar
  una petición en una pestaña en segundo plano que nadie está mirando ahora mismo,
  se retoma sola en el siguiente intervalo en cuanto vuelve a estar visible.

Montado condicionalmente, nunca a ciegas:

- `/tournaments/[id]`: solo si `status === "ongoing"` (ya calculado en la página
  vía `deriveTournamentStatus`, lib/tournamentStatus.ts).
- `/tournaments` (índice): solo si algún torneo de los que se están enseñando en
  la temporada seleccionada tiene `status === "ongoing"` — `getTournamentsByYear`
  ya trae ese campo por torneo, así que es un `.some()` sobre lo que ya había.
  Una temporada pasada entera (`?year=2021`) no monta nada.
- `/scores`: solo si `getLiveWeek()` (lib/liveRanking/liveWeek.ts, ya existía para
  el ranking en vivo — mismo criterio de "hay algo en juego ahora mismo" reusado
  tal cual, sin inventar una segunda consulta) devuelve una semana real, no `null`.

Verificado con datos reales: edición 3262 (semana 34, 2026, con partidos pero sin
`F` resuelta) enseña la insignia "Ongoing" — `status` calculado bien, que es
justo la variable que decide si se monta `AutoRefresh`; edición 1625 (semana 32,
con `F` ya resuelta) no la enseña, tal como toca (`TournamentStatusBadge` no pinta
nada en `completed`, a propósito, ver el propio componente). Navegación de ida y
vuelta entre una edición en curso, una terminada, `/scores` y el índice sin
ningún error de consola — el `useEffect` de `AutoRefresh` limpia su intervalo al
desmontar, así que cambiar de ruta no deja temporizadores huérfanos corriendo de
fondo. `npx tsc --noEmit` y `npx vitest run` (143 tests) limpios.

## 2026-08-17 — Scraping automático de torneos en juego + scores: en pausa, código sí

Pedido de partida: que Torneos y Scores se scrapeen solos, cada 10 minutos como
mucho. Se investigaron y descartaron dos arquitecturas antes de llegar a una
tercera, que a su vez queda en pausa:

1. **VPS con Chromium headed** — técnicamente sólida (mismo enfoque anti-bot que
   ya usa el proyecto) pero infraestructura nueva que mantener. Descartada en
   cuanto se comprobó que headless funciona igual de bien (punto 3).
2. **Serverless completo en Vercel** — investigada y descartada: el Chromium de
   Playwright (~280 MB) no cabe en el límite de función de Vercel (50 MB), hace
   falta `@sparticuz/chromium` + `playwright-core`; y sobre todo, evitar que el
   challenge anti-bot (basado en Cloudflare) salte en cada invocación serverless
   con IP variable necesitaría el add-on de IP estática de Vercel, **100 $/mes**
   (solo Pro/Enterprise) — coste real por una suposición (que el challenge sea
   sensible a la IP) que ni siquiera se llegó a comprobar, más un enganche a
   Vercel que CLAUDE.md pide evitar explícitamente.
3. **PC local con Task Scheduler, headless** — comprobado en la práctica que,
   con el perfil de `.playwright/` ya resuelto una vez, peticiones headless
   posteriores pasan el challenge igual que las headed (dos peticiones reales,
   `OT_LastResults.php` y `OT_ViewTournament.php?Trn=2093`, contenido real sin
   pantalla de challenge). Sin coste nuevo, sin infraestructura nueva.

**Se construyó y se verificó de verdad** contra datos reales — no es código sin
probar:

- `lib/mana/fetchLive.ts`/`loadTournament.ts`/`loadRecentResults.ts` — parámetro
  `headless` opcional, por defecto `false` (los botones de admin siguen
  headed, sin cambio de comportamiento); solo `scripts/autoScrape.ts` pide
  `true`.
- `scripts/autoScrape.ts` — refresca los torneos ya en juego (misma consulta
  que `getRecentlyLoadedTournaments`) con el pacing de 8s de siempre, refresca
  el ticker de scores, y avisa al sitio desplegado.
- `app/api/scraper/revalidate/route.ts` — webhook protegido con
  `SCRAPER_SECRET` (secreto propio, distinto de `CRON_SECRET`: frontera de
  confianza distinta) que revalida `/`, `/tournaments`, `/tournaments/[id]`
  tocados, `/scores`, `/admin/tournaments`, `/admin/scores`.
- Ejecución real de `npm run autoscrape`: 3 torneos en juego encontrados,
  actualizados los tres, ticker de scores con 1 resultado nuevo, webhook de
  revalidación respondido 200 — todo registrado en `import_runs` como
  cualquier carga manual.

**Por qué queda en pausa pese a estar terminado y probado**: pedido explícito
del propietario ("abort... lo pensamos más adelante") después de resolver el
`SITE_URL`. Nada quedó programado de verdad — no hay tarea en Task Scheduler
creada, ni `SCRAPER_SECRET` puesto en las variables de entorno de producción de
Vercel — así que el sistema entero está inerte tal cual: `SITE_URL` vacío en
`.env` hace que `notifySiteToRevalidate` se salte sola con un aviso, y sin
`SCRAPER_SECRET` en Vercel el endpoint devuelve `501`. El código se deja tal
cual en vez de deshacerlo — es más barato retomarlo que rehacerlo, y no hace
nada mientras nadie termine de conectar esas dos piezas.

**Para retomarlo**: solo faltan `SITE_URL` en `.env` (la URL de producción),
`SCRAPER_SECRET` en las variables de entorno de Vercel (mismo valor que ya hay
en `.env` local), y crear la tarea de Task Scheduler que corra `npm run
autoscrape` cada 10 minutos.

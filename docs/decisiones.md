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

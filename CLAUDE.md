# TE4 Tour — Especificación del proyecto

Este fichero es el contexto permanente del repo. Léelo entero antes de cada tarea.

## 1. Qué estamos construyendo

Una **propuesta de imagen alternativa para el Online Tour del foro de Mana Games**: una web pública que presenta ese mismo tour —sus torneos, cuadros, partidos, resultados, estadísticas y ranking— con una interfaz a la altura de un sitio oficial de tenis.

No inventamos un circuito ni un baremo. Los datos y las reglas son los suyos; lo que aportamos es la presentación.

- Publica **torneos, cuadros, partidos, resultados y estadísticas** por jugador.
- Publica el **ranking del tour** con histórico semanal y evolución.
- Añade lo que el foro no da: fichas de jugador, head-to-head, calendario navegable, gráficas de evolución.

Referencia visual: atptour.com, ver sección 6.

Público: jugadores de la comunidad TE4 (unos cientos, muy implicados). Consultan su ranking, sus partidos, su histórico y el calendario. La página tiene que dar ganas de compartirla.

**El foro no se toca.** El foro de Mana Games sigue donde está y es de otra persona. Nosotros solo leemos sus datos.

## 2. Stack

- **Next.js (App Router) + TypeScript**
- **Tailwind CSS + shadcn/ui** como base de componentes (copiados al repo, se modifican libremente)
- **PostgreSQL + Drizzle ORM**, migraciones versionadas en el repo
- **Zod** para validación en los límites (formularios, importadores, respuestas externas)
- **Vitest** para tests
- **Playwright** para los scrapers y para tests e2e mínimos
- Gráficas: **ECharts** (datos densos). Nada de librerías de brackets: el cuadro se hace a mano en SVG.
- Despliegue: Vercel + Neon inicialmente. No introduzcas dependencias que aten el proyecto a Vercel.

Reglas: sin `any` sin justificar. Server Components por defecto, `"use client"` solo donde haga falta. Páginas de jugador y de torneo con generación estática + revalidación al importar resultados.

## 3. Modelo de dominio

Empieza por el esquema. Es la decisión que más cuesta cambiar después.

- `players` — identidad canónica del jugador. Un jugador puede aparecer con nombres distintos a lo largo del tiempo → tabla `player_aliases (source, external_id, display_name, player_id)`. La reconciliación de identidades es un problema real: prevé que sea semiautomática con confirmación manual.
- `sources` — origen de los datos. De momento solo `mana`, más adelante nuestro propio torneo. Extensible, pero no diseñes para fusionar circuitos: no es el objetivo.
- `events` — el torneo como entidad recurrente (ej. "Madrid"), con `category` (`GS`, `M1000`, `500`, `250`, `finals`).
- `editions` — instancia de un evento: año, semana ISO, superficie, estado.
- `matches` — edición, ronda, jugadores, ganador, marcador por sets, fecha.
- `sets` — marcador detallado, incluye tie-breaks.
- `match_stats` — estadísticas por partido y jugador. Campos anulables: no todo se publica siempre.
- `ranking_snapshots` — ranking congelado por semana ISO: jugador, puntos, posición, desglose de qué torneos puntúan.
- `import_runs` — trazabilidad de cada importación: fuente, hora, filas nuevas, errores.

El personaje que elige cada jugador **no** influye en el ranking. Guárdalo si viene en los datos, pero fuera del cálculo.

## 4. Ranking

**No se calcula nada.** El ranking es el de Mana Games y llega ya hecho: `OT_Rankings.php` publica un snapshot por semana. Se importa tal cual y se muestra.

- `ranking_snapshots` guarda cada semana importada. El histórico completo es lo que permite lo que el foro no ofrece: evolución de posición y puntos por jugador, mejor ranking alcanzado, movimiento semana a semana, comparativas.
- Lo que sí derivamos de los partidos importados: registro de victorias/derrotas, rachas, head-to-head, rendimiento por superficie y por categoría. Eso son agregados sobre datos ya existentes, no un baremo alternativo.
- Si algún día quisiéramos un baremo propio, entraría como un módulo aparte junto al oficial, nunca sustituyéndolo. No lo construyas ahora.

Esto elimina la parte más delicada del proyecto. Los tests van a los parsers y a los agregados, no a un motor de puntuación.

## 5. Ingesta de datos

La fuente no es nuestra. Aísla eso detrás de un adaptador, para que el dominio no sepa de dónde vienen los datos:

```ts
interface SourceAdapter {
  fetchRankingWeek(week: IsoWeek): Promise<RawRanking>
  fetchTournament(externalId: string): Promise<RawTournament>
  listTournaments(since: Date): Promise<RawTournamentRef[]>
}
```

Única implementación: `ManaAdapter`. No habrá export oficial, así que todo entra por scraping y el diseño asume que **el acceso puede cortarse en cualquier momento**.

Sobre la fuente de Mana Games:

- Su tour vive en páginas propias del foro (`OT_Rankings.php`, `OT_LastResults.php`, `OT_ViewTournament.php?Trn=<id>`), no en posts sueltos. Son tablas HTML estructuradas.
- **Enumeración de torneos**: `OnlineTournaments.php?Archive=<año>` es un índice por temporada con enlace al cuadro de cada torneo. El scraper itera de 2021 al año actual y de cada página extrae los enlaces. Nada de adivinar IDs ni de paginar el subforo.
- Referencia de escala: la temporada actual va del `Trn=2023` (Brisbane, primero del año) al `Trn=2092`, unos **70 torneos por temporada**. Sirve para validar que el parser del índice no se está dejando entradas.
- Los IDs **no son contiguos ni homogéneos**: habrá huecos, dobles, torneos cancelados y, más atrás, eventos de TE2013. El scraper guarda lo que responda y descarta lo que no encaje sin abortar el pase.
### Reconocimiento previo — hazlo tú, agente

Nadie te va a dar muestras de HTML. La estructura de estas páginas la averiguas tú antes de escribir un solo parser.

Escribe `scripts/explore.ts` con Playwright:

- Chromium **headful** con contexto persistente en `.playwright/` (el challenge se resuelve una vez y la cookie se reutiliza). Si en la primera ejecución no pasa solo, deja la ventana abierta para que el propietario haga clic una vez; a partir de ahí es automático.
- Visita esta lista corta, una petición cada 8 s, esperando a que el challenge se resuelva antes de leer el DOM:
  - `OnlineTournaments.php?Archive=2026` y `?Archive=2021`
  - `OT_Rankings.php` (semana actual, y una semana antigua del desplegable)
  - Tres cuadros de distinto tamaño y época, sacados de los índices anteriores
  - `OT_LastResults.php`
- Guarda el HTML resultante en `data/raw/explore/`. **No parsees nada en este script.**

Después lee esos ficheros del disco y escribe `docs/estructura.md` documentando lo que realmente hay:

- Selectores y estructura de tablas de cada tipo de página.
- Índice anual: qué campos da cada fila (nombre, categoría, fecha, enlace al cuadro, superficie) y cómo se construye la URL del cuadro.
- Ranking: columnas exactas, valores del desplegable de semanas, formato de los huecos.
- Cuadro: cómo se representan rondas, byes, tie-breaks, abandonos y walkovers; tamaños que aparecen; si hay estadísticas de partido o solo marcadores; si hay dobles o previa.
- Cualquier cosa que rompa el patrón.

**Párate ahí y enséñame `docs/estructura.md` antes de escribir parsers o el backfill.** Ese documento es la especificación real de la ingesta; el resto de esta sección son suposiciones mías hasta que lo confirmes.
- **El sitio está detrás de una verificación anti-bot por JavaScript**: `fetch` a secas devuelve una página de challenge. Hace falta Playwright con navegador real y contexto persistente.

Estrategia de archivo primero:

- **Alcance temporal: de 2021 en adelante.** El archivo del foro llega hasta 2011, pero las temporadas anteriores están fuera del proyecto: son de TE2013 y anteriores y sus jugadores están inactivos. No las descargues ni las parsees.
- **Backfill**: 6 temporadas, ~70 torneos por año → unos 420 cuadros más las semanas de ranking, sobre 600 páginas. A 8 s por petición, hora y media.
- Después, **incremental semanal**: solo la semana nueva y los torneos cerrados desde la última ejecución. Una decena de peticiones por semana, no cientos.
- El **archivo local de HTML crudo es la fuente de verdad**, no el sitio remoto. `data/raw/<fuente>/<YYYY-MM-DD>/<url-slug>.html`, versionado fuera de git (es grande) pero con copia de seguridad. Reparsear nunca debe implicar volver a la red.
- Scraper reanudable: cola de URLs pendientes en base de datos con estado, para poder parar y continuar.
- `robots.txt`: léelo y regístralo en `docs/decisiones.md`. Un `User-Agent` identificable con URL de contacto reduce la probabilidad de bloqueo silencioso.
- Los parsers son funciones puras HTML → objetos, con fixtures guardados y tests. Nada de red en los tests.
- Un cambio de plantilla del foro romperá el parser sin avisar. Cada importación valida con Zod y falla ruidosamente; nunca escribe datos parciales o degradados en base de datos.

En la web publicamos **datos derivados** (nuestro ranking unificado, nuestro análisis), con atribución visible y enlace a la fuente en cada ficha de torneo. No replicamos sus páginas.

## 6. Dirección visual

**Referencia principal: atptour.com. La consigna es réplica, no inspiración.** El público objetivo es la comunidad de TE4 y el objetivo explícito es que la web se lea como el sitio oficial de la ATP aplicado a nuestro tour. Layout, densidad, jerarquía, paleta, comportamiento de tablas y componentes: se replican lo más fielmente posible a partir de las capturas de referencia en `docs/referencias/`.

Un clon a medias es el peor resultado posible: si se parece un 70% parece una copia barata, si se parece un 95% parece oficial. Cuando dudes entre "hacerlo como la ATP" y "mejorarlo", hazlo como la ATP.

### Límite: marcas y fotos

Lo único que no se replica, porque es lo único que sí puede generar un problema real independientemente de que no haya ánimo de lucro:

- **Logotipo y wordmark de la ATP**, y los lockups de patrocinador (`PIF ATP Rankings`, `Lexus ATP Head2Head`, la barra de Infosys, Nitto). Nada de eso entra en el repo. Nuestro tour necesita su propio logotipo en la misma posición y con el mismo peso visual.
- **Fotografías reales de jugadores** de atptour.com: son material licenciado. Los avatares salen de los personajes de TE4, de imágenes generadas o de un placeholder propio, con el mismo tratamiento circular y borde.
- Nombres de patrocinadores reales en cualquier parte de la interfaz.

Una paleta y una retícula no son propiedad de nadie. Un logotipo sí.

### Paleta

Muestreada de las capturas de referencia. Ajústala con cuentagotas sobre las imágenes antes de fijarla.

```
--navy-900   #001E5A   barra de navegación, hero
--navy-800   #0A2159   fondo oscuro de secciones tipo H2H
--navy-700   #16306B   tarjetas y paneles sobre fondo oscuro
--lime       #E1FF00   acento: activo, aros, resaltados sobre oscuro
--blue-500   #0057B8   enlaces y pestaña activa sobre fondo claro
--paper      #FFFFFF   fondo de tablas de ranking y cuadros
--rule       #E5E7EB   separadores de fila
--muted      #6B7280   etiquetas secundarias
--up         #0A9B4E   sube en el ranking
--down       #D6293E   baja en el ranking
```

**Dos modos de superficie, como en la referencia**: fondo claro para tablas densas (rankings, cuadros, calendario) y fondo navy para las páginas de enfrentamiento y las cabeceras. No es una preferencia, es parte del patrón.

### Componentes a replicar

- **Barra de navegación**: navy a ancho completo, logotipo a la izquierda, secciones en horizontal (Marcadores, Reciente, H2H, Estadísticas, Rankings, Jugadores, Torneos, More), subrayado en la activa. Buscador y carrito a la derecha (el carrito lo omitimos). Subnavegación por pestañas debajo, con subrayado azul en la activa.
- **Ranking**: barra de filtros con desplegables tipo píldora (Top N, país, fecha del ranking), toggle "Directo" y botón de recarga. Tabla con cabecera fija, columnas ordenables con doble cursor, filas altas separadas por filete inferior: posición en negrita a la izquierda, flecha +/- coloreada bajo ella, avatar circular con bandera solapada, nombre en peso fuerte, y a la derecha Edad, Puntos, +/-, Torneos jugados, Pts a perder, Siguiente mejor. Los valores vacíos son un guion, no una celda en blanco.
- **H2H**: fondo navy, layout espejado. Fichas de jugador a izquierda y derecha (Ranking, Edad, Peso, Estatura, Mano, Revés, Profesional desde) en panel translúcido; en el centro un aro con borde lima y el marcador de enfrentamientos a cada lado. Debajo, filas de estadísticas comparadas con barra que crece desde el centro hacia cada lado, cada mitad con el color de su jugador (uno azul, otro lima). Sección "Desglose de torneo" a continuación.
- **Cuadro**: fondo claro, chips circulares de ronda (R128, R64, R32, R16, QF, SF, F) con flecha de desplazamiento, y columnas por ronda en horizontal con las llaves dibujadas entre ellas. Cada partido es una tarjeta con borde y esquinas redondeadas de dos filas: bandera, nombre abreviado (`M. Arnaldi`), cabeza de serie entre paréntesis `(30)`, check de ganador, y los sets en columnas a la derecha. **Tie-breaks en superíndice** (`6³`), nunca entre paréntesis. Byes con fila propia y marcador en guiones. Botones `H2H` y `Estadísticas` al pie de cada tarjeta.

Cada superficie de pista tiene su color derivado (dura, tierra, hierba, indoor) como filete en la tarjeta de torneo. Es un dato, no una decoración.

### Tipografía

**Inter** para todo. El fichero estará en el workspace (`/public/fonts` o `/assets/fonts`) — cárgala como variable con `next/font/local`, con `font-display: swap`.

- Titulares y nombres de jugador: **ExtraBold (800)**, `letter-spacing: -0.02em`. Los pesos altos de Inter con tracking negativo son lo que da el aspecto ancho y compacto que buscamos.
- Etiquetas de columna, chips de ronda, eyebrows: **SemiBold (600)**, mayúsculas, `letter-spacing: 0.06em`, tamaño pequeño.
- Cuerpo y celdas de texto: **Medium (500)** sobre fondo navy, **Regular (400)** sobre fondo claro. El 400 sobre oscuro se ve anémico.
- **Toda cifra lleva `font-variant-numeric: tabular-nums`.** Sin excepción: rankings, marcadores, puntos, estadísticas. Una columna de números que baila lo arruina todo.
- Nota: Inter no tiene eje de anchura. Si en algún titular hace falta algo más ancho de lo que da el peso 800, se resuelve con tamaño y tracking, no metiendo una segunda familia.

### Restricciones no negociables

Tablas densas legibles en móvil (la de ranking es la prueba de fuego: prioriza posición, jugador y puntos, el resto se pliega). Foco de teclado visible. `prefers-reduced-motion` respetado. Contraste AA sobre el fondo oscuro.

**Animación (revisado 2026-08-17, pedido explícito del propietario)**: ya no se concentra solo en la navegación del cuadro — se anima el sitio entero: entradas escalonadas de filas/tarjetas (`.row-reveal`), tarjetas que se elevan al pasar el ratón (`.hover-lift`), botones con respuesta táctil (`.tap-scale`), barras y aros que se dibujan en vez de aparecer ya llenos (`.bar-grow`, `.arc-draw` en `app/globals.css`), indicador "Live" con pulso, etc. **Excepción a propósito: nada de transición de página completa** (`app/template.tsx` se probó y se quitó el mismo día — al remontarse en cada navegación, el fundido desde opacidad 0 dejaba ver el fondo plano de `body` un instante, y con secciones de color fuerte de por medio eso se leía como un parpadeo de color, no como una transición). Cualquier animación de cambio de ruta que se intente en el futuro no puede pasar por opacidad 0 en ningún punto. Sigue habiendo una única regla no negociable de verdad: **todo pasa por `prefers-reduced-motion` sin excepción** — la desactivación es global (`app/globals.css`, el bloque `@media (prefers-reduced-motion: reduce)`), así que cualquier `transition-*`/`animate-*` nuevo queda cubierto automáticamente sin tener que acordarse de nada por componente. Sutil y consistente con el resto del sitio, nunca el protagonista: nada de rebotes exagerados, confeti ni parallax.

## 7. Fases

No intentes hacerlo todo de golpe. Al terminar cada fase, párate y espera revisión.

1. **Reconocimiento** (sección 5): script de exploración, HTML de muestra descargado por ti mismo y `docs/estructura.md`. Parada obligatoria para revisión.
2. **Backfill 2021-2026.** Scraper reanudable, HTML crudo archivado, sin parsear todavía.
3. **Esquema + parsers + carga.** Parsers con fixtures sobre el HTML ya archivado, validación Zod, `import_runs`, reconciliación de alias.
4. **Frontend público**: ranking, ficha de jugador con histórico y gráfica, torneo con cuadro, H2H, calendario. Es la fase que justifica el proyecto entero: aquí se juega todo.
5. **Agregados**: rachas, rendimiento por superficie y categoría, head-to-head.
6. **Panel de administración**: corrección manual, reconciliación de alias, relanzar importaciones.
7. **Incremental semanal** automatizado.

## 8. Cómo trabajar

- Antes de cada tarea grande, expón el plan y espera. No refactorices por tu cuenta lo que ya está aprobado.
- Commits pequeños y descriptivos.
- Los tests del motor de ranking se escriben antes que el código.
- Si una regla del ranking te resulta ambigua, **pregunta**; no la inventes ni la dejes implícita en el código.
- Documenta en `docs/decisiones.md` cada decisión de diseño no obvia, con su motivo.

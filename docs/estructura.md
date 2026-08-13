# Estructura de las páginas del Online Tour (Mana Games)

Documento de reconocimiento (fase 1, CLAUDE.md sección 5). Escrito a partir del HTML
archivado por `scripts/explore.ts` en `data/raw/explore/` el 2026-08-13. Es la
especificación real de la ingesta: lo que sigue son hechos observados en el HTML, no
suposiciones.

Motor: **phpBB3** (estilo "Artodia Phantom"). Todas las páginas del tour son scripts PHP
dentro del mismo foro (`https://www.managames.com/Forum/`), no posts — son tablas HTML
generadas por plantilla, consistentes entre sí.

El challenge anti-bot mencionado en CLAUDE.md **no bloqueó ninguna de las 8 peticiones**
de esta sesión de reconocimiento (todas se sirvieron directamente, sin pantalla de
verificación). No hace falta intervención manual por ahora, pero el scraper de backfill
debe seguir manteniendo el contexto persistente y el manejo de challenge por si aparece
con volumen mayor de tráfico o desde otra IP.

---

## 1. Índice anual — `OnlineTournaments.php?Archive=<año>`

Muestras: `Archive=2026` (63 enlaces a cuadros), `Archive=2021` (28 enlaces a cuadros).

Una única tabla `<table class="Ot">` con cabecera:

```
Name | Competition | Draw | Surface | Category | Queue | Winner | Runner Up
```

(hay dos `<th class="Hidden">` iniciales sin etiqueta, para las columnas de semana/marca de fila — ver más abajo).

Cada torneo es una fila `<tr>` dentro de `<tbody>`. Estructura real de una fila:

```html
<tr>
  <td class="Hidden">&nbsp;</td>                 <!-- siempre vacío -->
  <td class="Title">Week 35:</td>                <!-- SOLO en la 1ª fila de cada semana -->
  <!-- las filas siguientes de la misma semana traen <td class="Hidden">&nbsp;</td> aquí en su lugar -->
  <td><a href="OT_ViewTournament.php?Trn=2095"><strong>US Open</strong></a></td>
  <td>Singles</td>            <!-- Competition -->
  <td>128</td>                <!-- Draw (tamaño de cuadro) -->
  <td>Blue-Green Cement</td>  <!-- Surface -->
  <td>Grand Slam</td>         <!-- Category -->
  <td>53 / 240</td>           <!-- Queue: inscritos / aforo máximo -->
  <td><a href="OT_Player.php?p=58950&d=0">Gyrmik</a></td>      <!-- Winner, solo si ya se jugó -->
  <td><a href="OT_Player.php?p=60373&d=0">TheTinkerman_</a></td> <!-- Runner Up, solo si ya se jugó -->
</tr>
```

**Reglas observadas:**

- La celda `Week N:` solo aparece en la primera fila de cada semana (a veces una semana
  trae más de un torneo, p. ej. Week 30 de 2026 trae Los Cabos + Atlanta + Prague). Las
  filas siguientes de esa misma semana traen `<td class="Hidden">&nbsp;</td>` en su lugar.
  **El scraper debe "arrastrar" el número de semana hacia abajo hasta la siguiente
  celda `Title`.**
- Las columnas **Winner / Runner Up solo existen si el torneo ya terminó**. Si el torneo
  está en curso o en registro, esas dos `<td>` no se emiten (la fila tiene menos columnas
  — el HTML no rellena con vacío, directamente omite las celdas). Un parser que indexe
  por posición fija de columna se romperá; hay que contar celdas o usarlas como
  opcionales al final de la fila.
- La tabla se divide en bloques marcados por filas separadoras
  `<tr><td colspan="2" class="Title">Registration Open</td></tr>`,
  `In Progress`, y `Archives of Year <año>`. Solo el último bloque corresponde
  al año pedido en `?Archive=`.
- **"Registration Open" e "In Progress" son idénticos en todas las páginas de índice**,
  sea cual sea el `Archive=` consultado — comprobado byte a byte entre `Archive=2026` y
  `Archive=2021`: ambos traen los mismos `Trn=2095, 2093, 2094, 2092, 2091`. Es el estado
  actual del tour, no depende del año histórico. **El scraper de archivo debe ignorar
  estos dos bloques** (se cubren aparte, vía el índice del año en curso o
  `OT_LastResults.php`), y quedarse solo con `Archives of Year <año>`.
- Dentro de "Archives of Year", las semanas van en orden descendente pero **con huecos**:
  en 2021 aparecen semanas 44, 43, 42, 41, 40, 39, 38, 35, 34, 33, 32, 31, 30, 29, 27, 26,
  25, 24, 22, 10, 3, 2, 1 — faltan p. ej. 36, 37, 23, 21-11, 9-4. Semanas sin torneo
  simplemente no tienen fila. Confirma lo que decía CLAUDE.md: IDs y semanas no son
  contiguos.
- 2021 tuvo ~28 torneos y cuadros pequeños (8, 16, 32 jugadores); 2026 tiene ~63 torneos
  (a fecha de la captura, semana 32, con el año sin terminar) y cuadros de hasta 128.
  Encaja con la cifra de referencia de CLAUDE.md (~70/temporada).
- El enlace al cuadro es siempre `OT_ViewTournament.php?Trn=<id>`, `id` numérico.
- Bloque fijo de navegación (idéntico en toda la web) con enlaces a
  `OnlineTournaments.php?Archive=2009..2026` — confirma que el archivo del foro no baja
  de 2009, aunque nuestro alcance empieza en 2021 según CLAUDE.md.
- No hay paginación en esta tabla: todas las semanas del año salen en una sola página.

---

## 2. Ranking — `OT_Rankings.php`

Muestras: semana actual sin parámetros (`2026 - Week 32`) y semana antigua explícita
(`?Week=2011-26&Doubles=0&Race=0`).

### Selector de semana

Formulario GET (`name="ChooseWeek"`) con:

- `<select name="Week">`: **538 opciones**, valor `AAAA-WW` (p. ej. `2026-32`,
  `2011-26`), texto `"2026 - Week 32 (Monday August 3rd)"` — incluye el lunes de
  inicio de esa semana ISO. La opción más reciente es la primera (orden
  descendente). Llega hasta `2011-26`, no más atrás — coincide con el límite de
  edición del `<select>` de "Saltar a" (that`s otro control) pero conviene no asumir
  que ambos límites son el mismo dato; **el desplegable de semanas de rankings en sí
  no ofrece nada anterior a 2011-26**.
- Radios `Doubles` (`0`=Singles, `1`=Doubles) y `Race` (`0`=Entry, `1`=Race,
  `2`=Challenger). Confirma los 6 enlaces que ya aparecían en `OnlineTournaments.php`
  (Singles/Doubles × Entry/Race/Challenger).
- Al enviar el formulario, la URL resultante es
  `OT_Rankings.php?Week=2011-26&Doubles=0&Race=0` — **querystring simple, sin sesión
  ni POST**, se puede construir directamente sin interactuar con el `<select>`.

### Tabla de ranking

Una sola tabla `<table class="Ot">`, **sin paginación** (273 jugadores en una sola
página para la semana de muestra), cabecera:

```
Rank | Moved | Name | Country | Points | Small Trn
```

Fila:

```html
<tr>
  <td class="even">1</td>                                        <!-- Rank -->
  <td class="even">--</td>                                       <!-- Moved -->
  <td class="even"><a href="OT_Player.php?p=48100&d=0">Jirafalox</a></td>
  <td class="even">Chile</td>                                    <!-- Country, texto libre -->
  <td class="even">13410</td>                                    <!-- Points -->
  <td class="even">4</td>                                        <!-- Small Trn -->
</tr>
```

- `Moved`: `--` (sin cambio), o `+N` / `-N` (subida/bajada de posiciones respecto a la
  semana anterior). Formato de texto simple, no hay iconos ni color en el HTML crudo.
- `Country`: texto libre, **sin bandera, sin código ISO**, y con capitalización
  inconsistente en origen (`"Chile"`, `"Uruguay"` pero también `"japan"` en minúsculas
  en la misma tabla). Habrá que normalizar en el importador, no fiarse del texto tal
  cual para agrupar/mostrar.
- `Small Trn`: columna sin leyenda ni tooltip en el HTML. Hipótesis razonable: cuenta de
  "pequeños torneos" que puntúan en ese ranking (relacionado con algún límite del
  baremo de Mana Games), pero no está confirmado — no lo necesitamos para calcular nada
  (el ranking se importa tal cual, CLAUDE.md sección 4), así que basta con guardarlo
  como campo opaco.
- No hay columna de edad, de país en forma de bandera, ni de puntos a perder — la
  interfaz rica que describe CLAUDE.md sección 6 (edad, +/-, próxima mejor puntuación
  a perder) **es una mejora nuestra sobre estos datos crudos**, no algo que venga ya
  hecho del foro.
- El mismo patrón de tabla (idéntico juego de columnas) se confirma para la semana de
  2011, así que es estable en el tiempo.

---

## 3. Cuadro de torneo — `OT_ViewTournament.php?Trn=<id>`

Tres muestras iniciales de la fase 1: `Trn=1849` (Cincinnati, 2021, cuadro de 16,
completado), `Trn=2095` (US Open, 2026, cuadro de 128, **en registro, sin cuadro
generado todavía**), `Trn=2024` (Perth, 2026, cuadro de 32, completado). Ampliado el
2026-08-13 con hallazgos de las páginas ya archivadas por el backfill (fase 2, más de
50 cuadros de 2021-2022 en el momento de escribir esto) — ver el aviso al final de la
sección 3 y el punto 5 de la sección 5.

### Cabecera de metadatos (toda página la tiene)

Tabla fija de una fila:

```
Competition | Draw | Queue | Seeds | Surface | Category | Week | Year | Game
```

Ejemplo (Cincinnati): `Singles | 16 | 11 / 30 | 4 | Blue-Green Cement | Masters 1000 | 33 - Monday August 16th | 2021 | TE4`.

- `Queue` = inscritos reales / aforo máximo permitido para inscripción — **no tiene
  por qué coincidir con `Draw`** (tamaño del cuadro). Cuando `Queue` < `Draw`, el
  cuadro rellena las plazas sobrantes con **Bye**: en Cincinnati (`Draw=16`,
  `Queue=11/30`) hay 5 Byes; en Perth (`Draw=32`, `Queue=21/60`) hay 11 Byes. La
  aritmética cuadra exacto: `Draw − nº inscritos reales = nº de Byes`. Importante para
  el parser: el número de Byes no es un dato aparte, se deriva.
- `Game`: siempre `TE4` en las muestras (no hemos visto `TE2013`, fuera de alcance
  igualmente).
- Cuando el torneo aún está en fase de inscripción (`Trn=2095`, US Open), **no existe
  ninguna tabla "Main Draw"**. En su lugar hay un bloque `Users in Registration Queue`
  con otra tabla: `Name | Rank | Location | Posts`, y un aviso
  `"You need to login to be able to Enter/Leave this Tournament Queue."`. El scraper
  de backfill debe tratar esto como "sin resultados todavía" y no como un error de
  parseo — probablemente lo más simple sea no visitar (o descartar sin abortar el pase)
  los torneos que en el índice anual caen bajo "Registration Open" / "In Progress".

### Cuadro (`Main Draw`), cuando existe

Una tabla `<table class="Ot">` con **dos `<thead>`**: el primero son las etiquetas de
ronda, el segundo es una fila de puntos otorgados por ronda.

Etiquetas de ronda observadas:

- Cuadro de 8 (varios Future de 2021, p. ej. `Trn=1825`): `Q, S, F, W` — 4 columnas,
  **sin `R1`**: con solo 8 jugadores el primer partido ya se etiqueta `Q`.
- Cuadro de 16 (Cincinnati): `R1, Q, S, F, W` — 5 columnas.
- Cuadro de 32 (Perth): `R1, R2, Q, S, F, W` — 6 columnas.
- **Cuadro de 64, confirmado con datos reales el 2026-08-13** (Wimbledon 2022,
  `Trn=1888`, archivado por el backfill): la hipótesis de la fase 1 era correcta en las
  etiquetas (`R1, R2, R3, Q, S, F, W`, 7 rondas), pero **el "Main Draw" no es una sola
  tabla — son dos `<table class="Ot">` independientes bajo el mismo `<dt>Main Draw</dt>`**:
  1. Una tabla con cabecera `R1, R2, R3, Q` (rondas tempranas, muchas filas).
  2. Justo debajo, otra tabla con cabecera `Q, S, F, W` (rondas finales, pocas filas).
  La columna `Q` **se repite a propósito** como puente entre ambas: en la tabla de rondas
  tempranas es la columna real con el marcador de octavos (la que tiene `rowspan` más
  grande, aquí 8); en la tabla de rondas finales es solo la casilla de entrada (mismo
  jugador, marcador vacío) que engancha con la primera columna real de esa tabla (`S`).
  **Corrección tras implementar el parser (2026-08-13): no hace falta fusionar nada.**
  Cada `<table>` es autosuficiente para sus propias rondas si se procesa con la
  convención de desplazamiento del punto siguiente: la tabla de rondas tempranas
  (`R1,R2,R3,Q`) da los resultados de `R1`, `R2` y `R3` usando *su propia* última
  columna (`Q`) como marcador — no hace falta ir a buscarlo a la otra tabla. La tabla de
  rondas finales (`Q,S,F,W`) da `Q`, `S` y `F` de la misma forma, con su propia primera
  columna (`Q`) sirviendo solo de "quién entra" (marcador vacío, como es de esperar
  porque no hay ronda anterior dentro de esa tabla). La columna `Q` duplicada entre
  ambas tablas no es un dato a conciliar, es simplemente la misma etiqueta de ronda
  apareciendo en el borde de dos tablas distintas por razones de maquetación. Un parser
  que trate cada `<table>` de forma independiente y genere una ronda por cada transición
  de columna (usando la etiqueta de la columna izquierda como nombre de ronda y el
  marcador de la columna derecha como resultado) reconstruye el cuadro completo sin
  fusión alguna. Validado con test real contra `Trn=1888` (Wimbledon 2022, cuadro de 64):
  produce exactamente las 6 rondas esperadas (`R1,R2,R3,Q,S,F`) y el número correcto de
  partidos. Sigue sin confirmarse si 128 usa 2 tablas o más (no ha aparecido un cuadro de
  128 ya jugado en el backfill), pero el mismo algoritmo por-tabla debería bastar
  igualmente si aparecen más de dos.
- **Convención de desplazamiento marcador↔ronda** (no explícita en la redacción original
  de esta sección, deducida ahora de forma inequívoca con el ejemplo de Wimbledon 2022):
  el marcador que aparece en la columna de una ronda **no es el resultado de esa ronda**,
  es el resultado de la ronda **anterior** — el partido que hizo falta ganar para entrar
  en la casilla que se está mirando. La columna más a la izquierda de cada tabla (la de
  "entrada") siempre sale con el marcador vacío por eso mismo: no hay ronda anterior
  dentro de esa tabla. Aplica igual en los cuadros de 16 y 32 ya vistos en la fase 1, solo
  que ahí pasaba desapercibido porque coincidía casi siempre con un bye.
- `W` es una columna "resumen": repite el nombre del campeón con `rowspan` igual al
  cuadro completo.
- Fila de puntos: una celda `<td class="Points">` por ronda con el valor de puntos que
  otorga alcanzar esa ronda (Cincinnati: `10, 200, 400, 650, 1000`). Estos puntos **no
  son el ranking** (CLAUDE.md sección 4 ya avisa: el ranking no se calcula, se importa),
  pero confirman que sí hay un baremo interno de Mana Games detrás — no es cosa nuestra
  replicarlo, solo mostrarlo si aparece.

### Celda de partido

Estructura por celda (una por jugador y ronda, con `rowspan = 2^(nº de rondas ya
superadas)` para que las líneas de bracket cuadren):

```html
<td rowspan="4">
  <a href="OT_Player.php?p=10904&d=0">JiJo</a> (1)
  <br><span class="score">
    6/7(5) 6/4 7/6(3)
  </span>
</td>
```

- El link a `OT_Player.php?p=<id>&d=0` es el identificador externo del jugador
  (candidato directo a `player_aliases.external_id`). El parámetro `d=` solo se ha
  observado en `0` en todas las muestras; por analogía con los radios `Doubles=0/1`
  de `OT_Rankings.php`, es razonable asumir que es el flag de dobles, pero no hay
  ninguna muestra con `d=1` que lo confirme (no hemos visto torneos de dobles en los
  índices muestreados — ver más abajo).
- **Confirmado el 2026-08-13**: `OT_Player.php?p=<id>` y `memberlist.php?...u=<id>`
  **son el mismo espacio de IDs** (el `p=` es directamente el ID de usuario de phpBB).
  Comprobado con el jugador `CaptainCrazy`: aparece como `OT_Player.php?p=24675` en el
  cuadro de `Trn=1849` (fase 1) y como `memberlist.php?mode=viewprofile&u=24675` en la
  cola de inscripción de `Trn=1888` (mismo `24675` en ambos sitios). Un solo campo
  `external_id` en `player_aliases` basta para los dos; no hace falta mapeo adicional.
- El **seed** va como sufijo `" (N)"` pegado al nombre, texto plano, no en una columna
  aparte.
- El **marcador** (`<span class="score">`) usa formato `6/X` (no `6-X`) para cada set,
  separados por espacio, y **el tie-break va entre paréntesis pegado al número de
  juegos del set** (`6/7(5)`, `7/6(3)`) — no en superíndice. El superíndice que pide
  CLAUDE.md sección 6 para el cuadro (`6³`) es una transformación nuestra en el
  frontend, el dato fuente no lo trae así.
- Valores especiales vistos en `<span class="score">`, en vez de un marcador de sets:
  - `Bye` — plaza vacía, sin jugador ni marcador (aparece como celda propia sin `<a>`,
    tal como anticipaba CLAUDE.md).
  - `w.o.` — walkover, sin marcador de sets.
  - `"5/1 ret."` / `"4/6 6/4 2/0 ret."` — abandono, con el marcador parcial jugado
    seguido de `ret.`
  - `DISQ` — descalificación, sin marcador.
  - Celda vacía (ni marcador ni palabra clave) cuando el ganador avanzó por bye en la
    ronda anterior: el marcador de **esa** ronda concreta no existe todavía visualmente
    en la columna de la ronda saltada, aparece en la columna de la ronda donde sí jugó.
- No hay estadísticas de partido (aces, dobles faltas, etc.) en esta página, en ninguna
  de las tres muestras — confirma la sospecha de CLAUDE.md ("si hay estadísticas de
  partido o solo marcadores"): **solo marcadores**, no hay tabla de stats por partido en
  ningún sitio del HTML explorado. Si existen en algún otro sitio del foro no lo hemos
  encontrado en esta pasada.
- No hay dobles en ninguno de los cuadros vistos hasta ahora (ni en la fase 1 ni en lo
  que lleva archivado el backfill). El menú de `OnlineTournaments.php` sí ofrece rankings
  de dobles como opción, así que el concepto existe en el sistema, pero sigue sin
  aparecer un torneo de dobles real. Pendiente de confirmar cuando aparezca uno.
- **La previa/clasificación sí existe, confirmado el 2026-08-13** (`Trn=1864`, Rio de
  Janeiro): es una sección aparte, `<dt>Qualifications</dt>`, con su propia mini-tabla de
  cuadro — cabecera `Q1, Q2, Qualified` (3 columnas) y su propia fila de puntos, mucho
  más baja que la del cuadro principal (`0, 3, 6` frente a los cientos/miles del Main
  Draw). Misma estructura de celda que el Main Draw (seed entre paréntesis, `<span
  class="score">`, Bye). Todavía no se ha confirmado cómo se referencia, dentro del Main
  Draw, al jugador que entra por haber ganado la clasificación (¿aparece directamente en
  `R1` del Main Draw como cualquier otro entrante, sin marca distintiva?) — a revisar
  cuando haga falta enlazar ambas tablas en el parser.
- **Aviso nuevo (2026-08-13): "Users in Registration Queue" puede aparecer incluso en
  un torneo ya completado con campeón decidido** (visto en `Trn=1888`, Wimbledon 2022,
  que sí tiene `Main Draw` completo y aun así trae una cola de inscripción al final,
  con jugadores que aparentemente no llegaron a entrar en el cuadro). No sirve como señal
  de "torneo todavía abierto" por sí sola — lo fiable para eso es la **ausencia de
  `Main Draw`** (sección "Cuadro (Main Draw), cuando existe" más arriba), no la presencia
  o ausencia de la cola de inscripción.
- Torneo con enlace a "Official Topic" del foro
  (`http://www.managames.com/Forum/topic23-<id>.php`) cuando existe hilo asociado;
  ausente en el torneo sin cuadro (`Trn=2095`, aún en registro).

---

## 4. Últimos resultados — `OT_LastResults.php`

Una tabla `<table class="Ot">`, agrupada por fecha con filas separadoras
`<td class="Title">2026-08-12</td>` (formato `YYYY-MM-DD`). Cabecera:

```
Day | Time | Tournament | Competition | Round | Winner | Loser | Score | Reporter
```

- Igual que en el índice anual, la celda de fecha (`Day`) solo aparece en la primera
  fila de ese día; las siguientes filas del mismo día traen `<td class="Hidden">&nbsp;</td>`.
  Mismo patrón de "arrastrar hacia abajo" que en la sección 1.
- `Round` usa el mismo código corto que las columnas del cuadro: `R1`, `R2`, `R3`, `S`
  (no hemos visto `Q` ni `F` en esta muestra concreta, pero por consistencia con el
  cuadro es de esperar que aparezcan igual).
- `Winner` / `Loser` enlazan a `memberlist.php?mode=viewprofile&u=<id>` — **un
  identificador de usuario de foro (`u=`), distinto del `p=` que usa
  `OT_Player.php`**. Habrá que decidir en la fase de esquema si son el mismo espacio de
  IDs o si hace falta un mapeo adicional; con los datos de esta muestra no se puede
  confirmar si `u=` y `p=` coinciden numéricamente para el mismo jugador.
- `Score` usa el mismo formato que en el cuadro (`6/2 6/3`, tie-break entre paréntesis,
  `w.o.`, `"4/6 6/4 2/0 ret."`).
- `Reporter`: el usuario que introdujo el resultado en el sistema — no siempre coincide
  con el ganador (en la muestra, casi siempre es el ganador o un tercero, pero no hay
  garantía; no asumir que `Reporter == Winner`).
- Sin paginación visible en la muestra (un día con volumen normal cabe entero); no
  confirmado qué pasa si hay muchísimos resultados — a vigilar durante el backfill.

---

## 5. Cosas que no encajan con el patrón / avisos para el parser

1. **Las columnas de una fila son condicionales, no fijas.** Tanto en el índice anual
   como en "Últimos resultados", una fila puede tener menos `<td>` de los que sugiere
   la cabecera (sin Winner/Runner Up si el torneo no ha acabado; sin celda de
   semana/fecha si no es la primera fila del grupo). Cualquier parser por índice de
   columna fijo se romperá. Hay que parsear por *rol* de celda (texto, `<a>`, clase
   CSS), no por posición.
2. **"Registration Open" / "In Progress" en el índice anual son globales, no del año
   consultado.** Un backfill ingenuo que parsee todo lo que hay en la tabla de cada
   `Archive=<año>` duplicaría esos torneos una vez por cada año descargado. Filtrar por
   el bloque `Archives of Year <año>` explícitamente.
3. **`Queue` (inscritos) puede ser menor que `Draw` (tamaño del cuadro).** Los Byes no
   son un dato explícito en la cabecera, se derivan de la diferencia y se confirman
   contando las celdas `Bye` del cuadro.
4. ~~Dos espacios de identificadores de jugador distintos y sin confirmar relación~~ —
   **resuelto el 2026-08-13**: `OT_Player.php?p=<id>` y `memberlist.php?...u=<id>` son
   el mismo ID (ver sección 3, celda de partido). Un solo `external_id` en
   `player_aliases` basta.
5. **Los cuadros grandes (64+) reparten el `Main Draw` en varias `<table>`** —
   confirmado con un cuadro de 64 ya jugado (ver sección 3). No hace falta fusionarlas:
   cada tabla se procesa por separado y da sus propias rondas completas (corrección del
   2026-08-13, validada con test real en `parsers/tournamentPage.ts`). Sigue sin
   confirmar el caso de 128 (el backfill aún no ha llegado a uno jugado); revisar cuando
   aparezca, aunque el mismo algoritmo por-tabla debería bastar.
6. ~~No se ha visto ningún torneo de dobles ni de clasificación/previa~~ — **la previa sí
   está confirmada** (sección "Celda de partido" / "Qualifications"), con su propia
   mini-tabla y escala de puntos. **Los dobles siguen sin aparecer** en ningún cuadro
   archivado hasta ahora; revisar si cambia la estructura cuando aparezca uno.
7. **`Country` en el ranking es texto libre con capitalización inconsistente en
   origen** (`japan` en minúsculas junto a `Chile`, `Uruguay` capitalizados en la misma
   tabla). Normalizar en el importador, no en la vista.
8. **El challenge anti-bot no aparece de forma fiable en cada sesión.** No dar por
   sentado que nunca aparecerá: el manejo de espera/reintento del scraper de backfill
   debe mantenerse tal como está en `scripts/explore.ts`, con contexto persistente y
   ventana headful, por si aparece con otro patrón de tráfico.
9. **"Users in Registration Queue" no es señal fiable de "torneo sin jugar todavía"** —
   puede convivir con un `Main Draw` completo (ver sección 3). Para decidir si un torneo
   tiene resultados, comprobar la presencia de `Main Draw`, no la ausencia de la cola de
   inscripción.

---

## 6. Ficheros de muestra archivados

Todos en `data/raw/explore/` (no versionados en git, ver `.gitignore`):

| Fichero | Página | Nota |
|---|---|---|
| `archive_2026.html` | `OnlineTournaments.php?Archive=2026` | 63 torneos, año en curso |
| `archive_2021.html` | `OnlineTournaments.php?Archive=2021` | 28 torneos, cuadros pequeños |
| `rankings_current.html` | `OT_Rankings.php` | Semana 2026-32, 273 jugadores |
| `rankings_old_week.html` | `OT_Rankings.php?Week=2011-26&Doubles=0&Race=0` | Semana más antigua del desplegable |
| `rankings_week_select.json` | — | Volcado de las 538 opciones del `<select>` de semana |
| `bracket_1.html` | `OT_ViewTournament.php?Trn=1849` | Cincinnati 2021, cuadro de 16, completo |
| `bracket_2.html` | `OT_ViewTournament.php?Trn=2095` | US Open 2026, cuadro de 128, sin generar (en registro) |
| `bracket_3.html` | `OT_ViewTournament.php?Trn=2024` | Perth 2026, cuadro de 32, completo, con w.o./ret./DISQ |
| `last_results.html` | `OT_LastResults.php` | ~10 días de resultados recientes |

# TE4 Tour

Web pública del Online Tour de Mana Games: torneos, cuadros, resultados, ranking
semanal con histórico, fichas de jugador y head-to-head.

Los datos y las reglas son del foro de Mana Games; nosotros solo los leemos y los
presentamos. **El foro no se toca.**

La especificación completa del proyecto está en [CLAUDE.md](CLAUDE.md). Las decisiones
de diseño no obvias, en [docs/decisiones.md](docs/decisiones.md). La estructura real de
las páginas que scrapeamos, en [docs/estructura.md](docs/estructura.md).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Drizzle ORM sobre Postgres (Neon) ·
Zod · Vitest · Playwright para el scraping · ECharts para las gráficas.

## Puesta en marcha

Necesitas **Node 20.9 o superior**.

### 1. Instalar

```bash
git clone <url-del-repo>
cd "Tour Web TE4"
npm install
```

### 2. Tu propia base de datos

Cada persona usa **su propio proyecto de Neon**, gratis. No compartimos base de datos en
desarrollo: así puedes romper lo que quieras sin afectar a los demás.

1. Crea una cuenta en [neon.tech](https://neon.tech) y un proyecto nuevo (plan gratuito).
2. Copia la cadena de conexión que te da.

> No sirve un Postgres local en Docker: [db/client.ts](db/client.ts) usa el driver
> `@neondatabase/serverless`, que habla el protocolo HTTP de Neon, no el de Postgres.

### 3. Variables de entorno

```bash
cp .env.example .env
```

Rellena `DATABASE_URL` con tu cadena de Neon. `ADMIN_PASSWORD` y `ADMIN_SECRET` ponles
lo que quieras en local. `GROQ_API_KEY` puede quedarse vacía (solo afecta al texto
generado del H2H).

El fichero tiene que llamarse `.env` exactamente — los scripts lo cargan con
`--env-file=.env`.

### 4. Crear las tablas

```bash
npm run db:migrate
```

### 5. Meter los datos

Tu base está vacía. **No la llenes scrapeando** (ver más abajo). Pide el zip de
`data/raw/` (unos 23 MB), descomprímelo en la raíz del proyecto y ejecuta:

```bash
npm run load
```

Eso parsea el HTML archivado y lo carga en tu base. Tarda un rato y deja rastro en la
tabla `import_runs`.

### 6. Arrancar

```bash
npm run dev
```

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests (Vitest) |
| `npm run lint` | ESLint |
| `npm run db:generate` | Genera una migración a partir de cambios en `db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones pendientes |
| `npm run load` | Parsea `data/raw/` y carga en la base |
| `npm run backfill` | **Solo el responsable del scraping.** Descarga HTML del foro |
| `npm run explore` | Reconocimiento puntual de páginas del foro |

## El scraping tiene un solo responsable

`npm run backfill` y `npm run explore` **no los ejecuta cualquiera**. Motivos:

- El acceso va con un Chromium real y un perfil persistente en `.playwright/`, con las
  cookies del challenge anti-bot. Ese perfil es de una máquina concreta y no está en git.
- Son cientos de peticiones contra el foro de otra persona, a una cada 8 segundos. Si
  varios lanzamos pases a la vez, nos bloquean y se acaba el proyecto.

Si necesitas datos nuevos, pídelos. Quien scrapea vuelve a pasar el zip de `data/raw/` y
cada uno corre `npm run load`.

## Cómo trabajamos

- `main` es la rama estable y **está conectada a Vercel**: lo que se mergea ahí se
  despliega a producción automáticamente.
- Nadie hace push directo a `main`. Rama por tarea (`feature/lo-que-sea`) y Pull Request.
- Cada PR genera su propio preview desplegado en Vercel; ahí se revisa antes de mergear.
- Commits pequeños y descriptivos.
- Antes de una tarea grande, se expone el plan y se espera. No refactorices por tu
  cuenta lo que ya está aprobado.
- Las decisiones de diseño no obvias se anotan en [docs/decisiones.md](docs/decisiones.md)
  con su motivo.

## Producción

Desplegado en Vercel (proyecto `te4-tour`). Las variables de entorno de producción viven
en el dashboard de Vercel, **nunca en el repo**. La base de datos de producción es un
proyecto de Neon aparte, al que solo se conecta la app desplegada.

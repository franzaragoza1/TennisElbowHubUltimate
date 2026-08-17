/**
 * Cabecera navy de sección. Existe para que ninguna página entre directa en blanco:
 * el patrón de CLAUDE.md §6 son dos superficies (oscura arriba, clara para las tablas
 * densas) y hasta ahora rankings y torneos abrían en hoja en blanco.
 *
 * `accentColor` pinta el filete inferior — lo usa la ficha de torneo con el color de la
 * superficie de pista, que ahí es un dato, no decoración.
 *
 * `backgroundImageUrl` (ficha de torneo, `lib/tournamentHeaders.ts`) pone la foto de
 * sede detrás del navy con viñeta — oscuro real en los bordes y en el centro también
 * lo bastante para que el texto blanco de siempre siga leyéndose sin necesidad de
 * cambiar ningún color de texto.
 */
export function PageMasthead({
  eyebrow,
  title,
  subtitle,
  accentColor,
  backgroundImageUrl,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  accentColor?: string;
  backgroundImageUrl?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="relative overflow-hidden bg-navy-900"
      style={accentColor ? { borderBottom: `4px solid ${accentColor}` } : undefined}
    >
      {backgroundImageUrl && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${backgroundImageUrl})` }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(120% 140% at 50% 30%, rgba(0,30,90,0.55) 0%, rgba(0,15,50,0.82) 65%, rgba(0,10,35,0.95) 100%)",
            }}
          />
        </>
      )}
      <div className="tour-container relative py-8 sm:py-10">
        {eyebrow && (
          <p className="text-eyebrow animate-in fade-in slide-in-from-bottom-1 mb-2 text-xs text-accent-500 duration-500">
            {eyebrow}
          </p>
        )}
        <h1 className="text-headline animate-in fade-in slide-in-from-bottom-1 text-2xl text-white delay-75 duration-500 sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <p className="animate-in fade-in slide-in-from-bottom-1 mt-2 flex items-center gap-2 text-sm text-white/60 delay-150 duration-500">
            {subtitle}
          </p>
        )}
        {children && (
          <div className="animate-in fade-in slide-in-from-bottom-1 mt-6 delay-200 duration-500">{children}</div>
        )}
      </div>
    </div>
  );
}

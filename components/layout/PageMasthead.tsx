/**
 * Cabecera navy de sección. Existe para que ninguna página entre directa en blanco:
 * el patrón de CLAUDE.md §6 son dos superficies (oscura arriba, clara para las tablas
 * densas) y hasta ahora rankings y torneos abrían en hoja en blanco.
 *
 * `accentColor` pinta el filete inferior — lo usa la ficha de torneo con el color de la
 * superficie de pista, que ahí es un dato, no decoración.
 */
export function PageMasthead({
  eyebrow,
  title,
  subtitle,
  accentColor,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: React.ReactNode;
  accentColor?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="bg-navy-900"
      style={accentColor ? { borderBottom: `4px solid ${accentColor}` } : undefined}
    >
      <div className="tour-container py-8 sm:py-10">
        {eyebrow && <p className="text-eyebrow mb-2 text-xs text-accent-500">{eyebrow}</p>}
        <h1 className="text-headline text-2xl text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 flex items-center gap-2 text-sm text-white/60">{subtitle}</p>}
        {children && <div className="mt-6">{children}</div>}
      </div>
    </div>
  );
}

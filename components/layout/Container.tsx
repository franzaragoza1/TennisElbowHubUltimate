/**
 * Retícula única del sitio. Antes cada página elegía su propio ancho (1280, 1100, 1000,
 * 900, 760) y sus propios márgenes, así que la cabecera y la tabla de debajo no
 * compartían borde izquierdo y todo se leía descuadrado.
 *
 * Ahora hay un solo ancho por defecto y tres anchuras de lectura para contenido que no
 * debe estirarse (un artículo a 1200 px es ilegible). El margen lateral es generoso a
 * propósito: es la "sangría" que le faltaba.
 */
const WIDTHS = {
  /** Por defecto: tablas, cuadros, rejillas de tarjetas. */
  wide: "max-w-[1200px]",
  /** Rankings, comparativas: densas pero no deben ocupar todo. */
  medium: "max-w-[1000px]",
  /** Texto corrido: artículos de noticia. */
  reading: "max-w-[720px]",
} as const;

export function Container({
  width = "wide",
  className = "",
  children,
}: {
  width?: keyof typeof WIDTHS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`mx-auto w-full px-5 sm:px-8 lg:px-12 ${WIDTHS[width]} ${className}`}>
      {children}
    </div>
  );
}

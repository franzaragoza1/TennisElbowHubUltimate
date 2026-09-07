/**
 * Foto + velo navy detrás de una sección oscura — mismo tratamiento que
 * PageMasthead.tsx ya usaba para la foto de sede de un torneo
 * (lib/tournamentHeaders.ts), ahora como fondo por defecto del resto de bandas
 * navy-900 a ancho completo del sitio (pedido explícito del propietario: "can we try
 * using this image as a general background"). Deliberadamente NO se aplica a la
 * barra de navegación, el pie de página, ni a ningún botón/píldora — esos son cromado
 * persistente o controles pequeños, no "secciones", y una foto ahí en cada página se
 * sentiría repetitivo/cargado en vez de una textura de fondo puntual.
 *
 * El elemento que envuelve esto necesita `relative overflow-hidden`, y el contenido
 * real de la sección necesita `relative` también — un hermano en `position: absolute`
 * (esto) se pinta POR ENCIMA de contenido sin posicionar sin importar el orden del
 * DOM, así que sin eso el fondo taparía el texto en vez de quedar detrás.
 */
export const DEFAULT_SECTION_BACKGROUND = "/assets/backgrounds/court-beam.jpg";

export function CourtBackdrop({ url = DEFAULT_SECTION_BACKGROUND }: { url?: string }) {
  return (
    <>
      <div aria-hidden="true" className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${url})` }} />
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 140% at 50% 30%, rgba(0,30,90,0.55) 0%, rgba(0,15,50,0.82) 65%, rgba(0,10,35,0.95) 100%)",
        }}
      />
    </>
  );
}

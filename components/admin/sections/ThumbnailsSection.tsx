import { ThumbnailGenerator } from "@/components/admin/thumbnails/ThumbnailGenerator";

/** Wrapper de servidor por paridad con el resto de secciones de /account
 * (VideosSection, ScoresSection...) — toda la interactividad real vive en el
 * componente de cliente, esto no necesita traer ningún dato de antemano. */
export function ThumbnailsSection() {
  return <ThumbnailGenerator />;
}

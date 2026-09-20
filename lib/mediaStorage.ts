/**
 * Sube una imagen a Cloudflare R2 (compatible con S3, sin coste de salida — ver
 * .env.example) y devuelve su URL pública real. Reemplaza el patrón anterior de
 * guardar la imagen como `data:<tipo>;base64,<...>` directamente en una columna de
 * la base de datos (`lib/newsImage.ts`, `app/account/actions.ts::uploadAvatar`) — un
 * bug real de ancho de banda encontrado el 2026-09-20: un data URI no tiene URL
 * propia que un navegador pueda cachear, así que se retransmitía entero en CADA
 * página que lo mostrara, para siempre, sin importar cuántas veces ya se hubiera
 * visto. Una URL real se descarga una vez por navegador y se reutiliza.
 *
 * Sin las credenciales configuradas (`R2_ACCOUNT_ID`/etc. sin poner en local antes de
 * tener el bucket listo), `uploadImageToMediaStorage` lanza — a diferencia del resto
 * de `lib/newsGeneration/*` esto NUNCA debe fallar en silencio: guardar una noticia
 * o un avatar sin imagen real porque la subida "simplemente no pasó nada" sería peor
 * que un error visible que el propio admin pueda reportar.
 */
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";

function getClient(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 no está configurado (faltan R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY)");
  }
  return new S3Client({
    region: "auto", // exigido por R2, no es una región real de AWS
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

const EXTENSION_BY_CONTENT_TYPE: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * `folder` separa noticias de avatares dentro del mismo bucket (`news/`, `avatars/`)
 * — un solo bucket para las dos cosas es suficiente a esta escala, no hace falta uno
 * por tipo. El nombre del fichero es siempre un UUID propio, nunca derivado del
 * nombre original: evita colisiones y no filtra nada del origen de la imagen.
 */
export async function uploadImageToMediaStorage(buffer: Buffer, contentType: string, folder: "news" | "avatars"): Promise<string> {
  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL;
  if (!bucket || !publicUrl) {
    throw new Error("R2 no está configurado (faltan R2_BUCKET_NAME/R2_PUBLIC_URL)");
  }

  const extension = EXTENSION_BY_CONTENT_TYPE[contentType] ?? "jpg";
  const key = `${folder}/${randomUUID()}.${extension}`;

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // Un año — el fichero nunca se sobreescribe (siempre un UUID nuevo), así que no
      // hay ningún riesgo de servir una versión vieja tras "cambiar" la imagen: eso
      // sencillamente sube un fichero distinto y actualiza la URL guardada.
      CacheControl: "public, max-age=31536000, immutable",
    }),
  );

  return `${publicUrl.replace(/\/$/, "")}/${key}`;
}

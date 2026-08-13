/**
 * Derivados de los assets de marca (uso único, se ejecuta a mano).
 *
 * `public/assets/header.png` es la banda de cabecera tal y como se diseñó: 1920x300 de
 * lime sólido con la bola TE4 a la izquierda y el wordmark a la derecha. Para poder
 * montar esa misma banda de forma responsive (y no estirar un PNG de 1920 de ancho en
 * cualquier viewport) hace falta la bola suelta y con fondo transparente.
 *
 * El wordmark no se recorta: `public/assets/logo.png` ya viene aislado y con alpha.
 *
 * Uso: npx tsx scripts/brand-assets.ts
 */
import sharp from "sharp";

const HEADER = "public/assets/header.png";
const BALL_OUT = "public/assets/ball.png";

/** Lime del fondo de la banda, muestreado del propio PNG. */
const LIME: [number, number, number] = [189, 231, 0];
const TOLERANCE = 24;

function isLime(r: number, g: number, b: number): boolean {
  return (
    Math.abs(r - LIME[0]) <= TOLERANCE &&
    Math.abs(g - LIME[1]) <= TOLERANCE &&
    Math.abs(b - LIME[2]) <= TOLERANCE
  );
}

/**
 * Caja del contenido no-lime dentro de una franja horizontal del header. Se acota por
 * `maxX` para quedarse solo con la bola y no arrastrar el wordmark del otro extremo.
 */
function contentBox(
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  maxX: number,
) {
  let minX = width;
  let minY = height;
  let maxFoundX = 0;
  let maxFoundY = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < maxX; x++) {
      const o = (y * width + x) * channels;
      if (isLime(data[o], data[o + 1], data[o + 2])) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxFoundX) maxFoundX = x;
      if (y > maxFoundY) maxFoundY = y;
    }
  }
  return { left: minX, top: minY, width: maxFoundX - minX + 1, height: maxFoundY - minY + 1 };
}

async function main() {
  const { data, info } = await sharp(HEADER).raw().toBuffer({ resolveWithObject: true });
  // La bola vive en el tercio izquierdo; el wordmark en el derecho.
  const box = contentBox(data, info.width, info.height, info.channels, Math.floor(info.width / 3));
  console.log("Bola encontrada en", box);

  // Recorte cuadrado centrado en la bola, con un punto de aire, para que al pintarla
  // como círculo no quede descentrada.
  const size = Math.max(box.width, box.height) + 4;
  const cx = box.left + box.width / 2;
  const cy = box.top + box.height / 2;
  const left = Math.max(0, Math.round(cx - size / 2));
  const top = Math.max(0, Math.round(cy - size / 2));

  await sharp(HEADER)
    .extract({
      left,
      top,
      width: Math.min(size, info.width - left),
      height: Math.min(size, info.height - top),
    })
    .png()
    .toFile(BALL_OUT);

  const out = await sharp(BALL_OUT).metadata();
  console.log(`Escrito ${BALL_OUT} (${out.width}x${out.height})`);
}

main();

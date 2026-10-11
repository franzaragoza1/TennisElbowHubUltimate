import { afterEach, describe, expect, it, vi } from "vitest";
import { rehostImageIfExternal } from "./newsImage";

const { uploadImageToMediaStorage } = vi.hoisted(() => ({ uploadImageToMediaStorage: vi.fn() }));
vi.mock("./mediaStorage", () => ({ uploadImageToMediaStorage }));

function mockFetchOnce(response: Partial<Response> & { arrayBuffer?: () => Promise<ArrayBuffer> }): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers(),
      arrayBuffer: async () => new ArrayBuffer(0),
      ...response,
    }),
  );
}

describe("rehostImageIfExternal", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    uploadImageToMediaStorage.mockReset();
  });

  it("null se queda null", async () => {
    expect(await rehostImageIfExternal(null)).toBeNull();
  });

  it("una ruta ya propia (empieza por /) se deja tal cual, sin llamar a fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await rehostImageIfExternal("/assets/news/foo.jpg")).toBe("/assets/news/foo.jpg");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("un data URI ya alojado se deja tal cual, sin llamar a fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const dataUri = "data:image/png;base64,AAAA";
    expect(await rehostImageIfExternal(dataUri)).toBe(dataUri);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("una URL externa de verdad se descarga y se sube a R2, devolviendo su URL real", async () => {
    const bytes = new TextEncoder().encode("fake-image-bytes").buffer;
    mockFetchOnce({
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(bytes.byteLength) }),
      arrayBuffer: async () => bytes,
    });
    uploadImageToMediaStorage.mockResolvedValue("https://pub-test.r2.dev/news/some-uuid.jpg");

    const result = await rehostImageIfExternal("https://example.com/photo.jpg");

    expect(uploadImageToMediaStorage).toHaveBeenCalledWith(Buffer.from(bytes), "image/jpeg", "news");
    expect(result).toBe("https://pub-test.r2.dev/news/some-uuid.jpg");
  });

  it("ya alojada en R2 (empieza por R2_PUBLIC_URL) se deja tal cual, sin llamar a fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
    const url = "https://pub-test.r2.dev/news/already-hosted.jpg";
    expect(await rehostImageIfExternal(url)).toBe(url);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("un fallo subiendo a R2 cae de vuelta a la URL original", async () => {
    const bytes = new TextEncoder().encode("fake-image-bytes").buffer;
    mockFetchOnce({
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(bytes.byteLength) }),
      arrayBuffer: async () => bytes,
    });
    uploadImageToMediaStorage.mockRejectedValue(new Error("R2 no está configurado"));

    expect(await rehostImageIfExternal("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });

  it("una respuesta que no es 'ok' cae de vuelta a la URL original", async () => {
    mockFetchOnce({ ok: false });
    expect(await rehostImageIfExternal("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });

  it("un content-type que no es imagen cae de vuelta a la URL original", async () => {
    mockFetchOnce({ headers: new Headers({ "content-type": "text/html" }) });
    expect(await rehostImageIfExternal("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });

  it("una imagen demasiado grande para descargar (por content-length) cae de vuelta a la URL original", async () => {
    mockFetchOnce({ headers: new Headers({ "content-type": "image/jpeg", "content-length": "20000000" }) });
    expect(await rehostImageIfExternal("https://example.com/huge.jpg")).toBe("https://example.com/huge.jpg");
  });

  it("una imagen grande (p.ej. una captura de Discord de varios MB) se reduce a WebP y se sube igual", async () => {
    const { default: sharp } = await import("sharp");
    const raw = Buffer.alloc(2400 * 1400 * 3);
    let seed = 1;
    for (let i = 0; i < raw.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      raw[i] = ((i / 3) % 2400) / 12 + (seed >> 27); // degradado + ruido: un PNG que no comprime, como una captura
    }
    const png = await sharp(raw, { raw: { width: 2400, height: 1400, channels: 3 } }).png().toBuffer();
    expect(png.byteLength).toBeGreaterThan(600_000);
    mockFetchOnce({
      headers: new Headers({ "content-type": "image/png", "content-length": String(png.byteLength) }),
      arrayBuffer: async () => png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength) as ArrayBuffer,
    });
    uploadImageToMediaStorage.mockResolvedValue("https://pub-test.r2.dev/news/small.webp");

    expect(await rehostImageIfExternal("https://cdn.discordapp.com/attachments/1/2/shot.png")).toBe("https://pub-test.r2.dev/news/small.webp");
    const [uploaded, type] = uploadImageToMediaStorage.mock.calls[0];
    expect(type).toBe("image/webp");
    expect((uploaded as Buffer).byteLength).toBeLessThanOrEqual(600_000);
    expect((await sharp(uploaded as Buffer).metadata()).width).toBeLessThanOrEqual(1600);
  });

  it("un fallo de red (fetch que lanza) cae de vuelta a la URL original", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );
    expect(await rehostImageIfExternal("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });

  it("una URL que ni siquiera es válida se deja tal cual", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await rehostImageIfExternal("not a url")).toBe("not a url");
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

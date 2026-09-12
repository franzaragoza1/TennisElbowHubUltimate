import { afterEach, describe, expect, it, vi } from "vitest";
import { rehostImageIfExternal } from "./newsImage";

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

  it("una URL externa de verdad se descarga y se convierte en data URI", async () => {
    const bytes = new TextEncoder().encode("fake-image-bytes").buffer;
    mockFetchOnce({
      headers: new Headers({ "content-type": "image/jpeg", "content-length": String(bytes.byteLength) }),
      arrayBuffer: async () => bytes,
    });
    const result = await rehostImageIfExternal("https://example.com/photo.jpg");
    expect(result).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("una respuesta que no es 'ok' cae de vuelta a la URL original", async () => {
    mockFetchOnce({ ok: false });
    expect(await rehostImageIfExternal("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });

  it("un content-type que no es imagen cae de vuelta a la URL original", async () => {
    mockFetchOnce({ headers: new Headers({ "content-type": "text/html" }) });
    expect(await rehostImageIfExternal("https://example.com/photo.jpg")).toBe("https://example.com/photo.jpg");
  });

  it("una imagen demasiado grande (por content-length) cae de vuelta a la URL original", async () => {
    mockFetchOnce({ headers: new Headers({ "content-type": "image/jpeg", "content-length": "10000000" }) });
    expect(await rehostImageIfExternal("https://example.com/huge.jpg")).toBe("https://example.com/huge.jpg");
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

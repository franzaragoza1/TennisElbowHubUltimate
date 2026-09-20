import { afterEach, describe, expect, it, vi } from "vitest";

class FakePutObjectCommand {
  input: unknown;
  constructor(input: unknown) {
    this.input = input;
  }
}
const { send } = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({}) }));
class FakeS3Client {
  send = send;
}
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: FakeS3Client,
  PutObjectCommand: FakePutObjectCommand,
}));

const ENV_KEYS = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"] as const;

function stubFullEnv(): void {
  vi.stubEnv("R2_ACCOUNT_ID", "acct123");
  vi.stubEnv("R2_ACCESS_KEY_ID", "key123");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret123");
  vi.stubEnv("R2_BUCKET_NAME", "test-bucket");
  vi.stubEnv("R2_PUBLIC_URL", "https://pub-test.r2.dev");
}

describe("uploadImageToMediaStorage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) vi.stubEnv(key, "");
    send.mockClear();
  });

  it("sube el buffer con el content-type y una caché de un año, y devuelve la URL pública real", async () => {
    stubFullEnv();
    const { uploadImageToMediaStorage } = await import("./mediaStorage");
    const buffer = Buffer.from("fake-bytes");

    const url = await uploadImageToMediaStorage(buffer, "image/png", "news");

    expect(send).toHaveBeenCalledTimes(1);
    const command = send.mock.calls[0][0] as FakePutObjectCommand;
    const input = command.input as { Bucket: string; Body: unknown; ContentType: string; CacheControl: string; Key: string };
    expect(input.Bucket).toBe("test-bucket");
    expect(input.Body).toBe(buffer);
    expect(input.ContentType).toBe("image/png");
    expect(input.CacheControl).toBe("public, max-age=31536000, immutable");
    expect(input.Key).toMatch(/^news\/[0-9a-f-]{36}\.png$/);
    expect(url).toBe(`https://pub-test.r2.dev/${input.Key}`);
  });

  it("usa el subdirectorio correcto según el folder pedido", async () => {
    stubFullEnv();
    const { uploadImageToMediaStorage } = await import("./mediaStorage");
    const url = await uploadImageToMediaStorage(Buffer.from("x"), "image/jpeg", "avatars");
    expect(url).toMatch(/^https:\/\/pub-test\.r2\.dev\/avatars\/[0-9a-f-]{36}\.jpg$/);
  });

  it("sin R2_ACCOUNT_ID/etc. configurado, lanza en vez de fallar en silencio", async () => {
    for (const key of ENV_KEYS) vi.stubEnv(key, "");
    const { uploadImageToMediaStorage } = await import("./mediaStorage");
    await expect(uploadImageToMediaStorage(Buffer.from("x"), "image/png", "news")).rejects.toThrow();
  });
});

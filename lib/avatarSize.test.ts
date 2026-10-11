import { describe, expect, it } from "vitest";
import { sizedAvatarUrl } from "./avatarSize";

describe("sizedAvatarUrl", () => {
  it("pide en WebP el tamaño de Discord que cubre el doble del tamaño en CSS", () => {
    expect(sizedAvatarUrl("https://cdn.discordapp.com/avatars/1/abc.png", 44)).toBe("https://cdn.discordapp.com/avatars/1/abc.webp?size=128");
    expect(sizedAvatarUrl("https://cdn.discordapp.com/avatars/1/abc.png", 96)).toBe("https://cdn.discordapp.com/avatars/1/abc.webp?size=256");
    expect(sizedAvatarUrl("https://cdn.discordapp.com/avatars/1/abc.png", 8)).toBe("https://cdn.discordapp.com/avatars/1/abc.webp?size=16");
  });

  it("sustituye un ?size= que ya traiga la URL", () => {
    expect(sizedAvatarUrl("https://cdn.discordapp.com/avatars/1/abc.png?size=512", 32)).toBe("https://cdn.discordapp.com/avatars/1/abc.webp?size=64");
  });

  it("los animados pequeños pasan a un WebP fijo, los grandes siguen siendo GIF", () => {
    expect(sizedAvatarUrl("https://cdn.discordapp.com/avatars/1/a_abc.gif", 44)).toBe("https://cdn.discordapp.com/avatars/1/a_abc.webp?size=128");
    expect(sizedAvatarUrl("https://cdn.discordapp.com/avatars/1/a_abc.gif", 96)).toBe("https://cdn.discordapp.com/avatars/1/a_abc.gif?size=256");
  });

  it("no toca lo que no es un avatar de Discord", () => {
    const r2 = "https://pub-658ce18d59b2429f9f0f721d4c8d6b47.r2.dev/avatars/x.jpg";
    expect(sizedAvatarUrl(r2, 44)).toBe(r2);
    expect(sizedAvatarUrl("https://cdn.discordapp.com/embed/avatars/3.png", 44)).toBe("https://cdn.discordapp.com/embed/avatars/3.png");
  });
});

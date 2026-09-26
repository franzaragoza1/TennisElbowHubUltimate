import { describe, expect, it } from "vitest";
import { discordAvatarUrl } from "./discordAvatar";

describe("discordAvatarUrl", () => {
  it("uses the user's own avatar as png, or gif when animated", () => {
    expect(discordAvatarUrl({ id: "1", avatar: "abc" })).toBe("https://cdn.discordapp.com/avatars/1/abc.png");
    expect(discordAvatarUrl({ id: "1", avatar: "a_abc" })).toBe("https://cdn.discordapp.com/avatars/1/a_abc.gif");
  });

  it("falls back to a default embed avatar, from the id for new-style usernames", () => {
    const url = discordAvatarUrl({ id: "396270322825035777", avatar: null, discriminator: "0" });
    expect(url).toMatch(/^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
    expect(discordAvatarUrl({ id: "396270322825035777", avatar: null })).toBe(url);
  });

  it("uses the discriminator for legacy usernames", () => {
    expect(discordAvatarUrl({ id: "1", avatar: null, discriminator: "1234" })).toBe("https://cdn.discordapp.com/embed/avatars/4.png");
  });
});

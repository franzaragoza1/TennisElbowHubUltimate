import { describe, expect, it } from "vitest";
import { REMIND_AFTER_DAYS, isUploadOverdue } from "./uploadReminder";

describe("isUploadOverdue", () => {
  const now = new Date("2026-09-05T00:00:00Z");

  it("is overdue when the user has never uploaded", () => {
    expect(isUploadOverdue(null, now)).toBe(true);
  });

  it("is not overdue right after uploading", () => {
    expect(isUploadOverdue(new Date("2026-09-04T00:00:00Z"), now)).toBe(false);
  });

  it("is not overdue just under the threshold", () => {
    const justUnder = new Date(now.getTime() - (REMIND_AFTER_DAYS - 1) * 24 * 60 * 60 * 1000);
    expect(isUploadOverdue(justUnder, now)).toBe(false);
  });

  it("is overdue exactly at the threshold", () => {
    const atThreshold = new Date(now.getTime() - REMIND_AFTER_DAYS * 24 * 60 * 60 * 1000);
    expect(isUploadOverdue(atThreshold, now)).toBe(true);
  });

  it("is overdue well past the threshold", () => {
    const wayBack = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    expect(isUploadOverdue(wayBack, now)).toBe(true);
  });
});

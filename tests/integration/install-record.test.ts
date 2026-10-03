import { beforeEach, describe, expect, it } from "vitest";
import { getInstallRecord, recordDismiss, recordInstalled } from "../../src/pwa/installPrompt";
import { resetDbForTests } from "../../src/storage/db";

beforeEach(async () => {
  await resetDbForTests();
});

describe("install prompt record (data-model.md)", () => {
  it("starts empty", async () => {
    expect(await getInstallRecord()).toEqual({
      dismissCount: 0,
      lastDismissedAt: null,
      installed: false,
    });
  });

  it("counts closes up to 2 and remembers the last one", async () => {
    await recordDismiss(Date.parse("2026-10-01T00:00:00.000Z"));
    expect(await getInstallRecord()).toMatchObject({
      dismissCount: 1,
      lastDismissedAt: "2026-10-01T00:00:00.000Z",
    });
    await recordDismiss(Date.parse("2026-11-01T00:00:00.000Z"));
    await recordDismiss(Date.parse("2026-12-01T00:00:00.000Z"));
    expect(await getInstallRecord()).toMatchObject({
      dismissCount: 2,
      lastDismissedAt: "2026-12-01T00:00:00.000Z",
    });
  });

  it("remembers that the app was installed", async () => {
    await recordInstalled();
    expect((await getInstallRecord()).installed).toBe(true);
  });
});

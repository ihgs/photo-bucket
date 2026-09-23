import { describe, expect, it } from "vitest";
import { exportFileName } from "../../src/media/renderBoard";

describe("exportFileName", () => {
  const date = new Date(2026, 8, 3, 10, 0, 0);
  it("uses <title>-<YYYYMMDD>.jpg", () => {
    expect(exportFileName("2026年やりたいこと", date)).toBe("2026年やりたいこと-20260903.jpg");
  });
  it("replaces characters that cannot be used in file names", () => {
    expect(exportFileName('a\\b/c:d*e?f"g<h>i|j', date)).toBe("a_b_c_d_e_f_g_h_i_j-20260903.jpg");
  });
});

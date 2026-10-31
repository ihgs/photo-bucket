import { readFileSync } from "node:fs";
import type { IndexHtmlTransformContext } from "vite";
import { describe, expect, it } from "vitest";
import { injectAnalytics, landingAnalytics } from "../../scripts/landingAnalytics";

const landing = readFileSync("index.html", "utf8");
const app = readFileSync("app/index.html", "utf8");

const transform = (id: string | undefined, html: string, path: string) => {
  const hook = landingAnalytics(id).transformIndexHtml as {
    handler: (html: string, ctx: IndexHtmlTransformContext) => string;
  };
  return hook.handler(html, { path } as IndexHtmlTransformContext);
};

describe("Google Analytics on the introduction page only (constitution I v1.4.0)", () => {
  it("adds the tag and the notice to the introduction page", () => {
    const html = transform("G-ABC123XYZ", landing, "/index.html");
    expect(html).toContain('gtag("config", "G-ABC123XYZ")');
    expect(html).toContain("https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ");
    expect(html).toContain("アプリ本体では使っていません");
    // The tag runs after the redirect for installed apps, and skips them.
    expect(html.indexOf('location.replace("app/"')).toBeLessThan(html.indexOf("gtag("));
    expect(html).toMatch(/if \(!\(matchMedia\("\(display-mode: standalone\)"\)/);
  });

  it("never touches the app", () => {
    expect(transform("G-ABC123XYZ", app, "/app/index.html")).toBe(app);
  });

  it("adds nothing without a measurement ID", () => {
    expect(transform(undefined, landing, "/index.html")).toBe(landing);
  });

  it("refuses anything but a GA4 ID", () => {
    for (const id of ["UA-12345-1", 'G-1");alert(1);("', "g-abc123", "G-"])
      expect(() => injectAnalytics(landing, id)).toThrow();
  });
});

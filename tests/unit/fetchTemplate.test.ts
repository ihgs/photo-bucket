import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchTemplateText } from "../../src/net/fetchTemplate";

const URL_OK = "https://templates.example/seasons.json";

const respond = (body: BodyInit | null, init: ResponseInit = {}) =>
  vi.fn<typeof fetch>(async () => new Response(body, init));

afterEach(() => vi.restoreAllMocks());

describe("fetchTemplateText (research.md R3)", () => {
  it("returns the text, sending a plain GET without credentials or referrer", async () => {
    const fetch = respond('{"format":"bucket-grid-template"}');
    expect(await fetchTemplateText(URL_OK, { fetch })).toEqual({
      ok: true,
      text: '{"format":"bucket-grid-template"}',
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(URL_OK);
    expect(init).toMatchObject({
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
    });
    expect(init?.method ?? "GET").toBe("GET");
    expect(init?.body).toBeUndefined();
    expect(init?.headers).toBeUndefined();
  });

  it("refuses anything but https without sending a request", async () => {
    for (const url of [
      "http://templates.example/a.json",
      "data:application/json,{}",
      "javascript:alert(1)",
      "ftp://templates.example/a.json",
      "templates.example/a.json",
      "",
    ]) {
      const fetch = respond("{}");
      expect(await fetchTemplateText(url, { fetch })).toEqual({ ok: false, reason: "invalid-url" });
      expect(fetch).not.toHaveBeenCalled();
    }
  });

  it("does not try while offline", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    const fetch = respond("{}");
    expect(await fetchTemplateText(URL_OK, { fetch })).toEqual({ ok: false, reason: "offline" });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("tells blocked, missing and failing URLs apart", async () => {
    const blocked = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await fetchTemplateText(URL_OK, { fetch: blocked })).toEqual({
      ok: false,
      reason: "blocked",
    });
    expect(await fetchTemplateText(URL_OK, { fetch: respond("", { status: 404 }) })).toEqual({
      ok: false,
      reason: "not-found",
    });
    expect(await fetchTemplateText(URL_OK, { fetch: respond("", { status: 500 }) })).toEqual({
      ok: false,
      reason: "http-error",
      status: 500,
    });
  });

  const never = vi.fn<typeof fetch>(
    (_url, init) =>
      new Promise((_resolve, reject) =>
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        ),
      ),
  );

  it("gives up after the time limit", async () => {
    expect(await fetchTemplateText(URL_OK, { fetch: never, timeoutMs: 50 })).toEqual({
      ok: false,
      reason: "timeout",
    });
  });

  it("stops when the user cancels", async () => {
    const controller = new AbortController();
    const result = fetchTemplateText(URL_OK, { fetch: never, signal: controller.signal });
    controller.abort();
    expect(await result).toEqual({ ok: false, reason: "aborted" });
  });

  it("refuses more than 100 KB", async () => {
    const declared = respond("{}", { headers: { "Content-Length": "200000" } });
    expect(await fetchTemplateText(URL_OK, { fetch: declared })).toEqual({
      ok: false,
      reason: "too-large",
    });
    const chunk = new TextEncoder().encode("x".repeat(1024));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(c) {
        if (sent > 200) return c.close();
        sent++;
        c.enqueue(chunk);
      },
    });
    expect(await fetchTemplateText(URL_OK, { fetch: respond(stream) })).toEqual({
      ok: false,
      reason: "too-large",
    });
    expect(sent).toBeLessThan(150); // stopped reading early
    const exact = respond("x".repeat(102_400));
    expect(await fetchTemplateText(URL_OK, { fetch: exact })).toMatchObject({ ok: true });
    const over = respond("x".repeat(102_401));
    expect(await fetchTemplateText(URL_OK, { fetch: over })).toEqual({
      ok: false,
      reason: "too-large",
    });
  });

  it("recognises a web page instead of a template file", async () => {
    const page = respond("\n  <!doctype html><html></html>", {
      headers: { "Content-Type": "text/html" },
    });
    expect(await fetchTemplateText(URL_OK, { fetch: page })).toEqual({ ok: false, reason: "html" });
  });
});

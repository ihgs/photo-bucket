// The only place the app talks to another site on its own code path (constitution I, v1.3.0):
// it fetches a template from a URL the user typed, and sends nothing but that GET.
import { TEMPLATE_MAX_BYTES } from "../domain/templateFormat";

export type FetchFailure =
  | "invalid-url"
  | "offline"
  | "blocked"
  | "not-found"
  | "http-error"
  | "timeout"
  | "too-large"
  | "html"
  | "aborted";

export type FetchResult =
  { ok: true; text: string } | { ok: false; reason: FetchFailure; status?: number };

const TIMEOUT_MS = 10_000;

const failure = (reason: FetchFailure, status?: number): FetchResult =>
  status === undefined ? { ok: false, reason } : { ok: false, reason, status };

const isHttps = (url: string) => {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};

/** Reads at most TEMPLATE_MAX_BYTES of the body; null when it is longer. */
const readLimited = async (res: Response): Promise<string | null> => {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > TEMPLATE_MAX_BYTES) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

/** Fetches the text of a template from an https URL (specs/006-template-import research R3). */
export const fetchTemplateText = async (
  url: string,
  opts: { signal?: AbortSignal; fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<FetchResult> => {
  if (!isHttps(url)) return failure("invalid-url");
  if (navigator.onLine === false) return failure("offline");

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, opts.timeoutMs ?? TIMEOUT_MS);
  const cancel = () => controller.abort();
  opts.signal?.addEventListener("abort", cancel);
  if (opts.signal?.aborted) cancel();

  try {
    const res = await (opts.fetch ?? fetch)(url, {
      mode: "cors",
      credentials: "omit",
      referrerPolicy: "no-referrer",
      cache: "no-store",
      redirect: "follow",
      signal: controller.signal,
    });
    if (res.status === 404) return failure("not-found");
    if (!res.ok) return failure("http-error", res.status);
    if (Number(res.headers.get("Content-Length")) > TEMPLATE_MAX_BYTES) {
      void res.body?.cancel().catch(() => undefined);
      return failure("too-large");
    }
    const text = await readLimited(res);
    if (text === null) return failure("too-large");
    if (text.trimStart().startsWith("<")) return failure("html");
    return { ok: true, text };
  } catch (err) {
    if (controller.signal.aborted) return failure(timedOut ? "timeout" : "aborted");
    if (err instanceof TypeError) return failure("blocked");
    throw err;
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", cancel);
  }
};

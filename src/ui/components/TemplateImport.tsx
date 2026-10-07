import { ArrowLeft } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { online } from "../../app/AppBanners";
import type { BoardTemplate } from "../../domain/templates";
import { parseTemplate, TOO_LARGE } from "../../domain/templateFormat";
import { fetchTemplateText, type FetchFailure, type FetchResult } from "../../net/fetchTemplate";

export const IMPORT_HEADING_ID = "template-import-title";

const FORMAT_HELP_URL = "https://github.com/ihgs/photo-bucket#テンプレートを作る";

const PASTE_HINT = "中身をコピーして、下の「中身を貼り付け」で取り込むこともできます。";

/** What to show when a URL could not be read (contracts/import-ui.md). */
const fetchMessage = (reason: FetchFailure, status?: number): string => {
  switch (reason) {
    case "invalid-url":
      return "https で始まる URL を入れてください";
    case "offline":
      return "通信できないため読み込めませんでした";
    case "blocked":
      return "この URL からは読み込めませんでした（公開先が読み込みを許可していないか、つながりません）";
    case "not-found":
      return "ファイルが見つかりませんでした";
    case "http-error":
      return `この URL からは読み込めませんでした（エラー ${status}）`;
    case "timeout":
      return "時間内に読み込めませんでした";
    case "too-large":
      return TOO_LARGE;
    case "html":
      return "テンプレートのファイルではなく Web ページのようです。GitHub なら「Raw」の URL を使ってください";
    case "aborted":
      return "";
  }
};

/** Reads a template from a URL or pasted text (specs/006-template-import/contracts/import-ui.md). */
export const TemplateImport = ({
  onImported,
  onBack,
}: {
  onImported: (template: BoardTemplate) => void;
  onBack: () => void;
}) => {
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState<AbortController | null>(null);
  // Stop loading when the sheet closes or goes back to the list.
  const current = useRef<AbortController | null>(null);
  current.current = loading;
  useEffect(() => () => current.current?.abort(), []);

  const importText = (input: string) => {
    const result = parseTemplate(input);
    if (result.ok) onImported(result.template);
    else setErrors(result.errors);
  };

  const load = async () => {
    const controller = new AbortController();
    setErrors([]);
    setLoading(controller);
    const result = await fetchTemplateText(url.trim(), { signal: controller.signal }).catch(
      (): FetchResult => ({ ok: false, reason: "blocked" }),
    );
    // Cancelled by the user, or the sheet was closed: nothing to show.
    if (!result.ok && result.reason === "aborted") return;
    setLoading(null);
    if (result.ok) importText(result.text);
    else setErrors([fetchMessage(result.reason, result.status), PASTE_HINT]);
  };

  return (
    <div class="template-import">
      <div class="top-bar">
        <button type="button" class="btn" onClick={onBack}>
          <ArrowLeft size={18} aria-hidden="true" />
          戻る
        </button>
        <h2 id={IMPORT_HEADING_ID} style={{ flex: 1, margin: 0 }}>
          テンプレートを取り込む
        </h2>
      </div>

      <section
        class="template-import-part"
        aria-labelledby="template-import-url"
        aria-busy={loading !== null}
      >
        <h3 id="template-import-url">URL から</h3>
        <label class="field">
          <span class="field-label">テンプレートの URL</span>
          <input
            type="url"
            inputMode="url"
            autoComplete="off"
            placeholder="https://"
            value={url}
            onInput={(e) => setUrl(e.currentTarget.value)}
          />
          {!online.value && (
            <span class="field-hint">オフラインのため URL からは読み込めません</span>
          )}
        </label>
        {loading ? (
          <div class="template-import-loading">
            <span>読み込み中…</span>
            <button
              type="button"
              class="btn"
              onClick={() => {
                loading.abort();
                setLoading(null);
              }}
            >
              やめる
            </button>
          </div>
        ) : (
          <button type="button" class="btn btn-primary" onClick={load}>
            読み込む
          </button>
        )}
      </section>

      <section class="template-import-part" aria-labelledby="template-import-paste">
        <h3 id="template-import-paste">中身を貼り付け</h3>
        <label class="field">
          <span class="field-label">テンプレートの中身</span>
          <textarea
            rows={8}
            spellcheck={false}
            value={text}
            placeholder={'{ "format": "bucket-grid-template", … }'}
            onInput={(e) => setText(e.currentTarget.value)}
          />
        </label>
        <button
          type="button"
          class="btn btn-primary"
          disabled={loading !== null}
          onClick={() => importText(text)}
        >
          取り込む
        </button>
      </section>

      {errors.length > 0 && (
        <div role="alert">
          <ul class="template-import-errors">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      <p class="template-import-help">
        <a href={FORMAT_HELP_URL} target="_blank" rel="noopener noreferrer">
          テンプレートの作り方
        </a>
      </p>
    </div>
  );
};

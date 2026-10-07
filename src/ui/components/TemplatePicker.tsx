import { Download } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { gridLabel } from "../../domain/grid";
import { TEMPLATES, type BoardTemplate } from "../../domain/templates";
import { IMPORT_HEADING_ID, TemplateImport } from "./TemplateImport";

/**
 * Sheet listing the templates; choosing one closes it (005 contracts/new-board-templates.md).
 * It can switch to reading a template from outside (006 contracts/import-ui.md).
 */
export const TemplateSheet = ({
  value,
  onChoose,
  onImported,
  onClose,
}: {
  /** The chosen template's id, or null. */
  value: string | null;
  onChoose: (id: string) => void;
  onImported: (template: BoardTemplate) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLElement>(null);
  const [view, setView] = useState<"list" | "import">("list");
  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>(".template-option")?.focus();
    return () => restore?.focus?.();
  }, []);
  // After switching views, focus the first field of the import view, or the button that opened it.
  const switched = useRef(false);
  useEffect(() => {
    if (!switched.current) return;
    const target =
      view === "import" ? ".template-import :is(input, textarea)" : ".template-import-open";
    ref.current?.querySelector<HTMLElement>(target)?.focus();
  }, [view]);
  const show = (next: "list" | "import") => {
    switched.current = true;
    setView(next);
  };

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={view === "list" ? "template-sheet-title" : IMPORT_HEADING_ID}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
        {view === "import" ? (
          <TemplateImport onImported={onImported} onBack={() => show("list")} />
        ) : (
          <>
            <div class="top-bar">
              <h2 id="template-sheet-title" style={{ flex: 1, margin: 0 }}>
                テンプレートを選ぶ
              </h2>
              <button type="button" class="btn" onClick={onClose}>
                閉じる
              </button>
            </div>
            <ul class="template-options">
              {TEMPLATES.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    class="template-option"
                    aria-current={value === t.id || undefined}
                    onClick={() => onChoose(t.id)}
                  >
                    <strong>{t.name}</strong>
                    <span class="template-size">{gridLabel(t.size)}</span>
                    <small>{t.description}</small>
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" class="btn template-import-open" onClick={() => show("import")}>
              <Download size={18} aria-hidden="true" />
              テンプレートを取り込む
            </button>
          </>
        )}
      </section>
    </div>
  );
};

/** The chosen template and the items it will put in, laid out like the grid (empty cells too). */
export const TemplatePreview = ({
  template,
  onClear,
}: {
  template: BoardTemplate;
  onClear: () => void;
}) => (
  <section class="field template-preview" aria-labelledby="template-preview-heading">
    <div class="template-chosen">
      <span>
        {template.imported ? "取り込んだテンプレート" : "テンプレート"}:{" "}
        <strong>{template.name}</strong>
      </span>
      <button type="button" class="btn" onClick={onClear}>
        やめる
      </button>
    </div>
    <h2 id="template-preview-heading" class="field-label">
      入る項目
    </h2>
    <ol style={{ gridTemplateColumns: `repeat(${template.size.cols}, 1fr)` }}>
      {Array.from({ length: template.size.rows * template.size.cols }, (_, n) => {
        const row = Math.floor(n / template.size.cols);
        const col = n % template.size.cols;
        const item = template.items.find((i) => i.row === row && i.col === col);
        return item ? (
          <li key={n}>{item.title}</li>
        ) : (
          <li key={n} class="empty">
            （空き）
          </li>
        );
      })}
    </ol>
  </section>
);

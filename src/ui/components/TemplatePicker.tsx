import { useEffect, useRef } from "preact/hooks";
import { gridLabel } from "../../domain/grid";
import { TEMPLATES, type BoardTemplate } from "../../domain/templates";

/** Sheet listing the templates; choosing one closes it (contracts/new-board-templates.md). */
export const TemplateSheet = ({
  value,
  onChoose,
  onClose,
}: {
  /** The chosen template's id, or null. */
  value: string | null;
  onChoose: (id: string) => void;
  onClose: () => void;
}) => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const restore = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>(".template-option")?.focus();
    return () => restore?.focus?.();
  }, []);

  return (
    <div class="modal-backdrop" onClick={onClose}>
      <section
        ref={ref}
        class="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      >
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
      </section>
    </div>
  );
};

/** The chosen template and the items it will put in, laid out like the grid. */
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
        テンプレート: <strong>{template.name}</strong>
      </span>
      <button type="button" class="btn" onClick={onClear}>
        やめる
      </button>
    </div>
    <h2 id="template-preview-heading" class="field-label">
      入る項目
    </h2>
    <ol style={{ gridTemplateColumns: `repeat(${template.size.cols}, 1fr)` }}>
      {[...template.items]
        .sort((a, b) => a.row - b.row || a.col - b.col)
        .map((i) => (
          <li key={`${i.row}-${i.col}`}>{i.title}</li>
        ))}
    </ol>
  </section>
);

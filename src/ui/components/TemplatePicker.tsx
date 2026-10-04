import { gridLabel } from "../../domain/grid";
import { TEMPLATES, findTemplate } from "../../domain/templates";

interface Props {
  /** The chosen template's id, or null for an empty board. */
  value: string | null;
  onChange: (id: string | null) => void;
}

/** Chooses a template for a new board and previews its items (contracts/new-board-templates.md). */
export const TemplatePicker = ({ value, onChange }: Props) => {
  const chosen = findTemplate(value);
  const option = (id: string | null, name: string, detail?: [string, string]) => (
    <button
      key={id ?? "none"}
      type="button"
      role="radio"
      aria-checked={value === id}
      class="template-option"
      onClick={() => onChange(id)}
    >
      <strong>{name}</strong>
      {detail && (
        <>
          <span class="template-size">{detail[0]}</span>
          <small>{detail[1]}</small>
        </>
      )}
    </button>
  );
  return (
    <div class="field">
      <h2 id="template-heading" class="field-label">
        テンプレート
      </h2>
      <div class="template-options" role="radiogroup" aria-labelledby="template-heading">
        {option(null, "使わない（空のボード）")}
        {TEMPLATES.map((t) => option(t.id, t.name, [gridLabel(t.size), t.description]))}
      </div>
      {chosen && (
        <section class="template-preview" aria-labelledby="template-preview-heading">
          <h3 id="template-preview-heading" class="field-label">
            入る項目
          </h3>
          <ol style={{ gridTemplateColumns: `repeat(${chosen.size.cols}, 1fr)` }}>
            {[...chosen.items]
              .sort((a, b) => a.row - b.row || a.col - b.col)
              .map((i) => (
                <li key={`${i.row}-${i.col}`}>{i.title}</li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
};

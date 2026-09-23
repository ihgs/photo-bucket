import { Plus } from "lucide-preact";
import type { CellLayout, TextBlock } from "../../domain/layout";

/** One line-positioned text block, drawn exactly where the canvas renderer draws it. */
export const TextLines = ({
  t,
  originX,
  originY,
}: {
  t: TextBlock;
  originX: number;
  originY: number;
}) => (
  <>
    {t.lines.map((line, i) => (
      <div
        key={i}
        class="line"
        aria-hidden="true"
        style={{
          left: `${t.x - originX}px`,
          top: `${t.y - originY + i * t.lineHeight}px`,
          width: `${t.maxWidth}px`,
          height: `${t.lineHeight}px`,
          lineHeight: `${t.lineHeight}px`,
          fontSize: `${t.fontPx}px`,
          fontWeight: t.bold ? 700 : 400,
          color: t.color,
        }}
      >
        {line}
      </div>
    ))}
  </>
);

export const cellLabel = (c: CellLayout) => {
  const pos = `${c.row + 1}行${c.col + 1}列`;
  if (!c.cell) return `${pos} 空きマス`;
  return `${pos} ${c.cell.title} ${c.kind === "done" ? "達成済み" : "未達成"}`;
};

interface Props {
  layout: CellLayout;
  selected?: boolean;
  onClick: () => void;
  photo?: preact.ComponentChildren;
}

export const CellTile = ({ layout: c, selected, onClick, photo }: Props) => (
  <button
    type="button"
    class={`grid-cell ${c.kind}${selected ? " selected" : ""}`}
    data-row={c.row}
    data-col={c.col}
    aria-label={cellLabel(c)}
    aria-pressed={selected || undefined}
    onClick={onClick}
    style={{
      left: `${c.x}px`,
      top: `${c.y}px`,
      width: `${c.size}px`,
      height: `${c.size}px`,
      borderRadius: `${c.radius}px`,
    }}
  >
    {c.kind === "empty" && (
      <span class="plus" aria-hidden="true">
        <Plus size={c.size * 0.3} />
      </span>
    )}
    {c.band && (
      <>
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            right: 0,
            height: `${c.band.height}px`,
            background: c.band.color,
          }}
        />
        <TextLines t={c.band.labelText} originX={c.x} originY={c.y} />
      </>
    )}
    {c.kind === "done" && photo}
    {c.caption && (
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: `${c.caption.y - c.y}px`,
          height: `${c.caption.height}px`,
          background: c.caption.color,
        }}
      />
    )}
    {c.text && <TextLines t={c.text} originX={c.x} originY={c.y} />}
  </button>
);

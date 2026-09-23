import { useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { layoutBoard, type CellLayout } from "../../domain/layout";
import { createCanvasMeasure } from "../../domain/measure";
import type { Board } from "../../domain/types";
import { CellTile, TextLines } from "./CellTile";

interface Props {
  board: Board;
  onCellClick: (row: number, col: number) => void;
  selected?: { row: number; col: number } | null;
  includeTitle?: boolean;
  renderPhoto?: (c: CellLayout) => preact.ComponentChildren;
  /** Fixed width in px (tests); otherwise fits the container and the viewport height. */
  width?: number;
}

const HEADER_ALLOWANCE = 200;

const fitWidth = (container: number, cols: number, rows: number) => {
  const byHeight = ((window.innerHeight || 800) - HEADER_ALLOWANCE) * (cols / rows);
  return Math.floor(Math.max(Math.min(260, container), Math.min(container, byHeight)));
};

export const GridView = ({
  board,
  onCellClick,
  selected,
  includeTitle = false,
  renderPhoto,
  width,
}: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState(width ?? 360);

  useLayoutEffect(() => {
    if (width !== undefined) return;
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const update = () => {
      const cs = getComputedStyle(parent);
      const inner =
        parent.clientWidth - parseFloat(cs.paddingLeft || "0") - parseFloat(cs.paddingRight || "0");
      setMeasured(fitWidth(inner > 0 ? inner : 360, board.size.cols, board.size.rows));
    };
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(parent);
    window.addEventListener("resize", update);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [width, board.size.cols, board.size.rows]);

  const w = width ?? measured;
  const layout = useMemo(
    () => layoutBoard(board, { width: w, includeTitle, measure: createCanvasMeasure() }),
    [board, w, includeTitle],
  );

  return (
    <div
      ref={ref}
      class="grid"
      role="group"
      aria-label={`${board.title}のマス目`}
      data-width={layout.width}
      style={{
        width: `${layout.width}px`,
        height: `${layout.height}px`,
        background: layout.background,
        margin: "0 auto",
      }}
    >
      {layout.cells.map((c) => (
        <CellTile
          key={`${c.row}-${c.col}`}
          layout={c}
          selected={selected?.row === c.row && selected?.col === c.col}
          onClick={() => onCellClick(c.row, c.col)}
          photo={renderPhoto?.(c)}
        />
      ))}
      {layout.titleBand && (
        <div
          class="grid-title-band"
          aria-hidden="true"
          style={{
            left: 0,
            top: 0,
            width: `${layout.titleBand.width}px`,
            height: `${layout.titleBand.height}px`,
            background: layout.titleBand.color,
          }}
        >
          <TextLines t={layout.titleBand.textBlock} originX={0} originY={0} />
        </div>
      )}
    </div>
  );
};

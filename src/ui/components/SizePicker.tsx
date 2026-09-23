import { GRID_SIZES, gridLabel } from "../../domain/grid";
import type { GridSize } from "../../domain/types";

const shapeName = (s: GridSize) =>
  s.cols === s.rows ? "正方形" : s.cols < s.rows ? "縦長 3:4" : "横長 4:3";

export const SizePicker = ({
  value,
  onChange,
}: {
  value: GridSize;
  onChange: (s: GridSize) => void;
}) => (
  <div class="size-options" role="radiogroup" aria-label="マス目のサイズ">
    {GRID_SIZES.map((s) => {
      const checked = s.cols === value.cols && s.rows === value.rows;
      return (
        <button
          key={gridLabel(s)}
          type="button"
          role="radio"
          aria-checked={checked}
          class="size-option"
          onClick={() => onChange(s)}
        >
          <span
            class="size-preview"
            aria-hidden="true"
            style={{ gridTemplateColumns: `repeat(${s.cols}, 10px)` }}
          >
            {Array.from({ length: s.cols * s.rows }, (_, i) => (
              <span key={i} />
            ))}
          </span>
          <strong>{gridLabel(s)}</strong>
          <small>{shapeName(s)}</small>
        </button>
      );
    })}
  </div>
);

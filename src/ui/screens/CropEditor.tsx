import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import {
  DEFAULT_CROP,
  MAX_ZOOM,
  MIN_ZOOM,
  clampCrop,
  imageBox,
  sourceRect,
} from "../../domain/crop";
import { findCell } from "../../domain/grid";
import type { Board, Crop } from "../../domain/types";
import { setCrop } from "../state/boardStore";
import { usePhotoUrl } from "../usePhotoUrl";

interface Props {
  board: Board;
  row: number;
  col: number;
}

export const CropEditor = ({ board, row, col }: Props) => {
  const cell = findCell(board, row, col);
  const photo = usePhotoUrl(cell?.photoId, "full");
  const [crop, setCropState] = useState<Crop>(cell?.crop ?? DEFAULT_CROP);
  const frame = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState(0);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el) return;
    const update = () => setFrameSize(el.clientWidth);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);

  const back = () => navigate({ name: "cell", boardId: board.id, row, col }, { replace: true });

  if (!cell?.photoId) {
    queueMicrotask(back);
    return null;
  }

  const w = photo?.width ?? 1;
  const h = photo?.height ?? 1;
  const update = (next: Crop) => setCropState(clampCrop(next, w, h));

  /** Moves the visible area by a drag of (dx, dy) screen pixels. */
  const panBy = (dx: number, dy: number) => {
    const side = sourceRect(w, h, crop).side;
    const perPx = side / (frameSize || 1);
    update({ ...crop, cx: crop.cx - (dx * perPx) / w, cy: crop.cy - (dy * perPx) / h });
  };

  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom: crop.zoom };
    }
  };
  const onPointerMove = (e: PointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      update({ ...crop, zoom: pinch.current.zoom * (dist / (pinch.current.dist || 1)) });
    } else if (pointers.current.size === 1) {
      panBy(e.clientX - prev.x, e.clientY - prev.y);
    }
  };
  const onPointerUp = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = (frameSize || 300) * 0.05;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    if (moves[e.key]) {
      e.preventDefault();
      panBy(...moves[e.key]);
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      update({ ...crop, zoom: crop.zoom + 0.1 });
    } else if (e.key === "-") {
      e.preventDefault();
      update({ ...crop, zoom: crop.zoom - 0.1 });
    }
  };

  const done = async () => {
    await setCrop(row, col, clampCrop(crop, w, h));
    back();
  };

  const box = photo && frameSize ? imageBox(w, h, crop, frameSize) : null;

  return (
    <>
      <div class="top-bar">
        <button type="button" class="btn btn-ghost" aria-label="キャンセル" onClick={back}>
          ←
        </button>
        <h1>表示範囲を調整</h1>
      </div>
      <p class="muted">ドラッグで位置、ピンチまたはスライダーで拡大率を変えられます。</p>
      <div
        ref={frame}
        class="crop-frame"
        tabIndex={0}
        role="application"
        aria-label={`${cell.title}の写真。矢印キーで位置、プラスとマイナスで拡大率を変更`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={onKeyDown}
      >
        {photo && box && (
          <img
            src={photo.url}
            alt=""
            draggable={false}
            style={{
              left: `${box.left}px`,
              top: `${box.top}px`,
              width: `${box.width}px`,
              height: `${box.height}px`,
            }}
          />
        )}
      </div>
      <label class="field">
        <span class="field-label">拡大率（{crop.zoom.toFixed(1)}倍）</span>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onInput={(e) => update({ ...crop, zoom: Number(e.currentTarget.value) })}
        />
      </label>
      <div class="btn-row">
        <button type="button" class="btn" onClick={() => update(DEFAULT_CROP)}>
          中央に戻す
        </button>
        <span style={{ flex: 1 }} />
        <button type="button" class="btn" onClick={back}>
          キャンセル
        </button>
        <button type="button" class="btn btn-primary" onClick={done} disabled={!photo}>
          完了
        </button>
      </div>
    </>
  );
};

import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { reportError } from "../../app/errors";
import { DEFAULT_CROP, rotateCrop } from "../../domain/crop";
import type { Board, Cell } from "../../domain/types";
import { confirm } from "../components/ConfirmDialog";
import { PhotoInCell } from "../components/PhotoInCell";
import { formatDate } from "../format";
import { attachPhoto, detachPhoto, setCrop } from "../state/boardStore";
import { usePhotoUrl } from "../usePhotoUrl";

const FileButton = ({
  label,
  capture,
  onFile,
  disabled,
  primary,
}: {
  label: string;
  capture?: boolean;
  onFile: (f: File) => void;
  disabled: boolean;
  primary?: boolean;
}) => (
  <label class={`btn${primary ? " btn-primary" : ""}`} aria-disabled={disabled}>
    {label}
    <input
      type="file"
      accept="image/*"
      class="visually-hidden"
      capture={capture ? "environment" : undefined}
      disabled={disabled}
      onChange={(e) => {
        const input = e.currentTarget;
        const file = input.files?.[0];
        input.value = "";
        if (file) onFile(file);
      }}
    />
  </label>
);

export const PhotoSection = ({ board, cell }: { board: Board; cell: Cell }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      await attachPhoto(cell.row, cell.col, file);
    } catch (e) {
      if (e instanceof Error && e.name === "UserFacingError") setError(e.message);
      else reportError(e);
    } finally {
      setBusy(false);
    }
  };

  const photo = usePhotoUrl(cell.photoId, "thumb");
  const onRotate = () => {
    if (!photo) return;
    void setCrop(
      cell.row,
      cell.col,
      rotateCrop(cell.crop ?? DEFAULT_CROP, photo.width, photo.height),
    ).catch(reportError);
  };

  const onDetach = async () => {
    const ok = await confirm({
      title: "写真を外しますか？",
      message: "このマスは未達成に戻ります。",
      confirmLabel: "外す",
      danger: true,
    });
    if (ok) await detachPhoto(cell.row, cell.col);
  };

  return (
    <div class="section" aria-busy={busy}>
      <h3 class="field-label">達成の写真</h3>
      {cell.photoId ? (
        <>
          <div class="cell-photo-preview">
            <PhotoPreview cell={cell} />
          </div>
          {cell.achievedAt && <p>{formatDate(cell.achievedAt)} 達成</p>}
          <div class="btn-row">
            <button
              type="button"
              class="btn"
              disabled={busy}
              onClick={() =>
                navigate({ name: "crop", boardId: board.id, row: cell.row, col: cell.col })
              }
            >
              表示範囲を調整
            </button>
            <button type="button" class="btn" disabled={busy || !photo} onClick={onRotate}>
              90°回転
            </button>
            <FileButton label="写真を差し替える" onFile={onFile} disabled={busy} />
            <FileButton label="撮影して差し替える" capture onFile={onFile} disabled={busy} />
            <button type="button" class="btn" disabled={busy} onClick={onDetach}>
              写真を外す
            </button>
          </div>
        </>
      ) : (
        <>
          <p class="muted">達成したら写真を貼りましょう。</p>
          <div class="btn-row">
            <FileButton label="撮影する" capture primary onFile={onFile} disabled={busy} />
            <FileButton label="ライブラリから選ぶ" onFile={onFile} disabled={busy} />
          </div>
        </>
      )}
      {busy && (
        <p role="status">
          <span class="spinner" aria-hidden="true" /> 写真を取り込んでいます…
        </p>
      )}
      {error && (
        <p class="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/** Large square preview that uses the same crop as the grid. */
const PhotoPreview = ({ cell }: { cell: Cell }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setSize(el.clientWidth);
    update();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0 }}>
      {size > 0 && <PhotoInCell cell={cell} size={size} />}
    </div>
  );
};

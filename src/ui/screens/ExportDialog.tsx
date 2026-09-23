import { useEffect, useRef, useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { reportError } from "../../app/errors";
import type { Board } from "../../domain/types";
import { exportFileName, renderBoard } from "../../media/renderBoard";
import { canShareFiles, shareOrDownload } from "../../media/shareImage";
import { getPreferences, updatePreferences } from "../../storage/preferences";

export const ExportDialog = ({ board }: { board: Board }) => {
  const [includeTitle, setIncludeTitle] = useState<boolean | null>(null);
  const [image, setImage] = useState<{ blob: Blob; url: string; includeTitle: boolean } | null>(
    null,
  );
  const [rendering, setRendering] = useState(false);
  const [sharing, setSharing] = useState(false);
  const renderId = useRef(0);

  useEffect(() => {
    void getPreferences()
      .then((p) => setIncludeTitle(p.exportIncludeTitle))
      .catch(() => setIncludeTitle(true));
  }, []);

  useEffect(() => {
    if (includeTitle === null) return;
    const id = ++renderId.current;
    setRendering(true);
    renderBoard(board, { includeTitle })
      .then((blob) => {
        if (id !== renderId.current) return;
        setImage((prev) => {
          if (prev) URL.revokeObjectURL(prev.url);
          return { blob, url: URL.createObjectURL(blob), includeTitle };
        });
      })
      .catch((e) => reportError(e, "画像を作れませんでした"))
      .finally(() => id === renderId.current && setRendering(false));
  }, [board, includeTitle]);

  useEffect(() => () => image && URL.revokeObjectURL(image.url), [image]);

  const toggleTitle = (value: boolean) => {
    setIncludeTitle(value);
    void updatePreferences({ exportIncludeTitle: value }).catch(() => undefined);
  };

  const save = async () => {
    if (!image || rendering) return;
    setSharing(true);
    try {
      await shareOrDownload(image.blob, exportFileName(board.title), board.title);
    } catch (e) {
      reportError(e, "画像を保存できませんでした");
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <div class="top-bar">
        <button
          type="button"
          class="btn btn-ghost"
          aria-label="ボードへ戻る"
          onClick={() => navigate({ name: "board", boardId: board.id })}
        >
          ←
        </button>
        <h1>画像として保存</h1>
      </div>

      <label class="switch">
        <span>タイトルを入れる</span>
        <input
          type="checkbox"
          checked={includeTitle ?? true}
          disabled={includeTitle === null}
          onChange={(e) => toggleTitle(e.currentTarget.checked)}
        />
      </label>

      <div aria-busy={rendering} aria-live="polite">
        {image ? (
          <img
            class="export-preview"
            src={image.url}
            alt={`${board.title}の保存画像のプレビュー`}
            style={{ opacity: rendering ? 0.5 : 1 }}
          />
        ) : (
          <p role="status">
            <span class="spinner" aria-hidden="true" /> 画像を作っています…
          </p>
        )}
      </div>

      <button
        type="button"
        class="btn btn-primary btn-block"
        onClick={save}
        disabled={!image || rendering || sharing}
      >
        画像を保存・共有
      </button>
      {canShareFiles() && (
        <p class="muted" style={{ marginTop: "8px" }}>
          共有メニューの「画像を保存」で写真アプリに保存できます。
        </p>
      )}
    </>
  );
};

import { ArrowLeft, LayoutGrid } from "lucide-preact";
import { useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { reportError } from "../../app/errors";
import { DEFAULT_GRID_SIZE } from "../../domain/grid";
import type { GridSize } from "../../domain/types";
import { BOARD_TITLE_MAX, UNTITLED_BOARD } from "../../domain/validation";
import { createBoard } from "../../storage/boards";
import { SizePicker } from "../components/SizePicker";
import { TemplatePreview, TemplateSheet } from "../components/TemplatePicker";
import {
  cellsFromTemplate,
  findTemplate,
  resolveTemplateTitle,
  type BoardTemplate,
} from "../../domain/templates";
import { openBoard } from "../state/boardStore";
import { IconButton } from "../components/IconButton";

export const NewBoard = () => {
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<GridSize>(DEFAULT_GRID_SIZE);
  // A built-in template or one imported from outside; imported ones live only here (FR-010).
  const [template, setTemplate] = useState<BoardTemplate | null>(null);
  // What the user had typed before choosing a template, restored when they go back to none.
  const [manual, setManual] = useState<{ title: string; size: GridSize } | null>(null);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);

  const chooseTemplate = (t: BoardTemplate | null) => {
    if (!t) {
      if (manual) {
        setTitle(manual.title);
        setSize(manual.size);
      }
      setTemplate(null);
      return;
    }
    if (template === null) setManual({ title, size });
    setTitle(resolveTemplateTitle(t.title));
    setSize(t.size);
    setTemplate(t);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      const board = await createBoard(title, size, template ? cellsFromTemplate(template) : []);
      await openBoard(board.id);
      navigate({ name: "board", boardId: board.id }, { replace: true });
    } catch (err) {
      reportError(err);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <div class="top-bar">
        <IconButton icon={ArrowLeft} label="戻る" onClick={() => navigate({ name: "list" })} />
        <h1>新しいボード</h1>
        <button type="button" class="btn" onClick={() => setPicking(true)}>
          <LayoutGrid size={18} aria-hidden="true" />
          テンプレート
        </button>
      </div>
      {template && <TemplatePreview template={template} onClear={() => chooseTemplate(null)} />}
      <label class="field">
        <span class="field-label">タイトル</span>
        <input
          type="text"
          name="title"
          value={title}
          maxLength={BOARD_TITLE_MAX}
          placeholder={`例: 2026年やりたいこと（空欄なら「${UNTITLED_BOARD}」）`}
          onInput={(e) => setTitle(e.currentTarget.value)}
        />
      </label>
      <fieldset class="field" style={{ border: "none", padding: 0, margin: "0 0 24px" }}>
        <legend class="field-label">マス目のサイズ</legend>
        <SizePicker value={size} onChange={setSize} disabled={template !== null} />
      </fieldset>
      <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
        ボードを作る
      </button>
      {picking && (
        <TemplateSheet
          value={template?.id ?? null}
          onChoose={(id) => {
            chooseTemplate(findTemplate(id));
            setPicking(false);
          }}
          onImported={(t) => {
            chooseTemplate(t);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      )}
    </form>
  );
};

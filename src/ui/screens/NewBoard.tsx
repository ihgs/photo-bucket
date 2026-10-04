import { ArrowLeft } from "lucide-preact";
import { useState } from "preact/hooks";
import { navigate } from "../../app/router";
import { reportError } from "../../app/errors";
import { DEFAULT_GRID_SIZE } from "../../domain/grid";
import type { GridSize } from "../../domain/types";
import { BOARD_TITLE_MAX, UNTITLED_BOARD } from "../../domain/validation";
import { createBoard } from "../../storage/boards";
import { SizePicker } from "../components/SizePicker";
import { TemplatePicker } from "../components/TemplatePicker";
import { cellsFromTemplate, findTemplate, resolveTemplateTitle } from "../../domain/templates";
import { openBoard } from "../state/boardStore";
import { IconButton } from "../components/IconButton";

export const NewBoard = () => {
  const [title, setTitle] = useState("");
  const [size, setSize] = useState<GridSize>(DEFAULT_GRID_SIZE);
  const [templateId, setTemplateId] = useState<string | null>(null);
  // What the user had typed before choosing a template, restored when they go back to none.
  const [manual, setManual] = useState<{ title: string; size: GridSize } | null>(null);
  const [busy, setBusy] = useState(false);

  const chooseTemplate = (id: string | null) => {
    const t = findTemplate(id);
    if (!t) {
      if (manual) {
        setTitle(manual.title);
        setSize(manual.size);
      }
      setTemplateId(null);
      return;
    }
    if (templateId === null) setManual({ title, size });
    setTitle(resolveTemplateTitle(t.title));
    setSize(t.size);
    setTemplateId(t.id);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    setBusy(true);
    try {
      const t = findTemplate(templateId);
      const board = await createBoard(title, size, t ? cellsFromTemplate(t) : []);
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
      </div>
      <TemplatePicker value={templateId} onChange={chooseTemplate} />
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
        <SizePicker value={size} onChange={setSize} disabled={templateId !== null} />
      </fieldset>
      <button type="submit" class="btn btn-primary btn-block" disabled={busy}>
        ボードを作る
      </button>
    </form>
  );
};

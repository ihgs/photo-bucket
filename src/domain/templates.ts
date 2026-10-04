import type { Category, Cell, GridSize } from "./types";

/** One cell of a template. Titles are 1–60 characters and contain no counts or durations. */
export interface TemplateItem {
  row: number;
  col: number;
  title: string;
  category: Category;
}

/** A ready-made board the user can start from (specs/005-board-templates). Not stored. */
export interface BoardTemplate {
  id: string;
  name: string;
  /** Title of the new board; "{年}" becomes the current year. */
  title: string;
  description: string;
  size: GridSize;
  /** Exactly one item per cell. */
  items: TemplateItem[];
}

type Row = readonly (readonly [string, Category])[];

/** Lays rows of [title, category] out from the top left, row by row. */
const grid = (rows: readonly Row[]): TemplateItem[] =>
  rows.flatMap((r, row) => r.map(([title, category], col) => ({ row, col, title, category })));

export const TEMPLATES: readonly BoardTemplate[] = [
  {
    id: "domestic-travel",
    name: "国内旅行",
    title: "国内旅行",
    description: "日本の 12 の地方をめぐろう",
    size: { cols: 3, rows: 4 },
    items: grid([
      [
        ["北海道旅行", "go"],
        ["東北旅行", "go"],
        ["関東旅行", "go"],
      ],
      [
        ["甲信越旅行", "go"],
        ["北陸旅行", "go"],
        ["東海旅行", "go"],
      ],
      [
        ["近畿旅行", "go"],
        ["山陰旅行", "go"],
        ["山陽旅行", "go"],
      ],
      [
        ["四国旅行", "go"],
        ["九州旅行", "go"],
        ["沖縄旅行", "go"],
      ],
    ]),
  },
  {
    id: "year-goals",
    name: "一年の目標",
    title: "{年}年の目標",
    description: "一年でやりたいことをビンゴのように達成しよう",
    size: { cols: 5, rows: 5 },
    items: grid([
      [
        ["話題の本を読む", "want"],
        ["行ったことのない県に行く", "go"],
        ["ヨガ教室に行ってみる", "want"],
        ["作ったことのない料理を作る", "want"],
        ["久しぶりの友人に会う", "want"],
      ],
      [
        ["資格の試験を受ける", "want"],
        ["日帰りで温泉に行く", "go"],
        ["マラソン大会に出る", "want"],
        ["手作りのお菓子を贈る", "want"],
        ["家族と写真を撮る", "want"],
      ],
      [
        ["ワークショップに参加する", "want"],
        ["キャンプをする", "want"],
        ["今年いちばんの挑戦をする", "want"],
        ["行列のできる店に並ぶ", "eat"],
        ["誰かに手紙を書く", "want"],
      ],
      [
        ["外国語で注文してみる", "want"],
        ["美術館に行く", "go"],
        ["新しいスポーツをやってみる", "want"],
        ["ライブやコンサートに行く", "go"],
        ["ボランティアに参加する", "want"],
      ],
      [
        ["部屋の大掃除をする", "want"],
        ["ひとり旅をする", "go"],
        ["早起きして朝さんぽする", "want"],
        ["日の出を見に行く", "go"],
        ["自分へのごほうびを買う", "want"],
      ],
    ]),
  },
  {
    id: "best-food",
    name: "今年のベストごはん",
    title: "{年}年のベストごはん",
    description: "一番おいしかった一皿の写真に、どんどん入れ替えよう",
    size: { cols: 3, rows: 3 },
    items: grid([
      [
        ["ラーメン", "eat"],
        ["カレー", "eat"],
        ["ハンバーグ", "eat"],
      ],
      [
        ["寿司", "eat"],
        ["焼肉", "eat"],
        ["パスタ", "eat"],
      ],
      [
        ["餃子", "eat"],
        ["オムライス", "eat"],
        ["スイーツ", "eat"],
      ],
    ]),
  },
  {
    id: "seasons",
    name: "季節の楽しみ",
    title: "季節の楽しみ",
    description: "春夏秋冬、季節ごとの楽しみを写真に残そう",
    size: { cols: 4, rows: 4 },
    items: grid([
      [
        ["お花見をする", "want"],
        ["いちご狩りに行く", "go"],
        ["潮干狩りをする", "want"],
        ["新緑の中を散歩する", "want"],
      ],
      [
        ["海で泳ぐ", "want"],
        ["花火大会に行く", "go"],
        ["かき氷を食べる", "eat"],
        ["夏祭りに行く", "go"],
      ],
      [
        ["紅葉狩りに行く", "go"],
        ["お月見をする", "want"],
        ["栗ごはんを食べる", "eat"],
        ["ぶどう狩りに行く", "go"],
      ],
      [
        ["初詣に行く", "go"],
        ["雪遊びをする", "want"],
        ["鍋を囲む", "eat"],
        ["イルミネーションを見に行く", "go"],
      ],
    ]),
  },
];

export const findTemplate = (id: string | null) => TEMPLATES.find((t) => t.id === id) ?? null;

/** The board title for a template, with "{年}" replaced by the year of `now`. */
export const resolveTemplateTitle = (title: string, now = new Date()) =>
  title.replaceAll("{年}", String(now.getFullYear()));

/** The template's items as cells of a new board: no photo, no memo, no link to the template. */
export const cellsFromTemplate = (
  template: BoardTemplate,
  newId: () => string = () => crypto.randomUUID(),
): Cell[] =>
  template.items.map((i) => ({
    id: newId(),
    row: i.row,
    col: i.col,
    title: i.title,
    category: i.category,
    memo: "",
  }));

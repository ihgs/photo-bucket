const dateFormat = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

/** "2026年9月23日" */
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

import { signal } from "@preact/signals";

export type Route =
  | { name: "list" }
  | { name: "new" }
  | { name: "board"; boardId: string }
  | { name: "cell"; boardId: string; row: number; col: number }
  | { name: "crop"; boardId: string; row: number; col: number }
  | { name: "export"; boardId: string }
  | { name: "settings"; boardId: string };

const LIST: Route = { name: "list" };

const toIndex = (s: string | undefined) => (s !== undefined && /^\d+$/.test(s) ? Number(s) : null);

export const parseRoute = (hash: string): Route => {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length === 0) return LIST;
  if (parts[0] === "new" && parts.length === 1) return { name: "new" };
  if (parts[0] !== "boards" || !parts[1]) return LIST;
  const boardId = parts[1];
  if (parts.length === 2) return { name: "board", boardId };
  if (parts.length === 3 && parts[2] === "export") return { name: "export", boardId };
  if (parts.length === 3 && parts[2] === "settings") return { name: "settings", boardId };
  if (parts[2] === "cells" && (parts.length === 5 || (parts.length === 6 && parts[5] === "crop"))) {
    const row = toIndex(parts[3]);
    const col = toIndex(parts[4]);
    if (row === null || col === null) return LIST;
    return { name: parts.length === 6 ? "crop" : "cell", boardId, row, col };
  }
  return LIST;
};

export const routeToHash = (route: Route): string => {
  switch (route.name) {
    case "list":
      return "#/";
    case "new":
      return "#/new";
    case "board":
      return `#/boards/${encodeURIComponent(route.boardId)}`;
    case "export":
    case "settings":
      return `#/boards/${encodeURIComponent(route.boardId)}/${route.name}`;
    case "cell":
      return `#/boards/${encodeURIComponent(route.boardId)}/cells/${route.row}/${route.col}`;
    case "crop":
      return `#/boards/${encodeURIComponent(route.boardId)}/cells/${route.row}/${route.col}/crop`;
  }
};

export const currentRoute = signal<Route>(
  typeof location === "undefined" ? LIST : parseRoute(location.hash),
);

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => {
    currentRoute.value = parseRoute(location.hash);
  });
}

export const navigate = (route: Route, opts: { replace?: boolean } = {}) => {
  const hash = routeToHash(route);
  if (opts.replace) history.replaceState(null, "", hash);
  else if (location.hash !== hash) history.pushState(null, "", hash);
  currentRoute.value = route;
};

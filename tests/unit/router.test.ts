import { describe, expect, it } from "vitest";
import { parseRoute, routeToHash } from "../../src/app/router";

describe("parseRoute", () => {
  it.each([
    ["", { name: "list" }],
    ["#/", { name: "list" }],
    ["#/new", { name: "new" }],
    ["#/boards/abc", { name: "board", boardId: "abc" }],
    ["#/boards/abc/cells/2/1", { name: "cell", boardId: "abc", row: 2, col: 1 }],
    ["#/boards/abc/cells/0/0/crop", { name: "crop", boardId: "abc", row: 0, col: 0 }],
    ["#/boards/abc/export", { name: "export", boardId: "abc" }],
    ["#/boards/abc/settings", { name: "settings", boardId: "abc" }],
  ])("%s", (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
    expect(parseRoute(routeToHash(parseRoute(hash)))).toEqual(route);
  });

  it.each([
    "#/unknown",
    "#/boards",
    "#/boards/abc/cells/x/1",
    "#/boards/abc/cells/-1/0",
    "#/boards/abc/zzz",
  ])("falls back to the list for %s", (hash) => {
    expect(parseRoute(hash)).toEqual({ name: "list" });
  });
});

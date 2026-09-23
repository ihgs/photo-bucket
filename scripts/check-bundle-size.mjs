// Fails when the JavaScript loaded on first visit exceeds 60 KB gzip (plan.md Constraints).
import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const LIMIT = 60 * 1024;
const dist = "dist";
const html = readFileSync(join(dist, "index.html"), "utf8");
const scripts = [
  ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
].map((m) => m[1].replace(/^.*?assets\//, "assets/"));

let total = 0;
for (const file of new Set(scripts)) {
  const size = gzipSync(readFileSync(join(dist, file))).length;
  total += size;
  console.log(`${file}: ${(size / 1024).toFixed(1)} KB gzip`);
}
console.log(`total: ${(total / 1024).toFixed(1)} KB gzip (limit ${LIMIT / 1024} KB)`);
if (total === 0) {
  console.error("no scripts found in dist/index.html");
  process.exit(1);
}
if (total > LIMIT) process.exit(1);

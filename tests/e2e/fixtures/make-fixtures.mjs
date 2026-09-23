// Generates test photos. Run: node tests/e2e/fixtures/make-fixtures.mjs (needs ImageMagick `convert`).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = dirname(fileURLToPath(import.meta.url));

/** Minimal big-endian EXIF block with GPSLatitudeRef = N and GPSLatitude = 35/1 41/1 0/1. */
const gpsExif = () => {
  const tiff = Buffer.alloc(80);
  tiff.write("MM", 0, "ascii");
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  // IFD0: one entry, GPSInfo -> 26
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x8825, 10);
  tiff.writeUInt16BE(4, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt32BE(26, 18);
  tiff.writeUInt32BE(0, 22);
  // GPS IFD at 26: two entries
  tiff.writeUInt16BE(2, 26);
  tiff.writeUInt16BE(1, 28); // GPSLatitudeRef
  tiff.writeUInt16BE(2, 30); // ASCII
  tiff.writeUInt32BE(2, 32);
  tiff.write("N\0", 36, "ascii");
  tiff.writeUInt16BE(2, 40); // GPSLatitude
  tiff.writeUInt16BE(5, 42); // RATIONAL
  tiff.writeUInt32BE(3, 44);
  tiff.writeUInt32BE(56, 48);
  tiff.writeUInt32BE(0, 52);
  [35, 1, 41, 1, 0, 1].forEach((v, i) => tiff.writeUInt32BE(v, 56 + i * 4));
  const body = Buffer.concat([Buffer.from("Exif\0\0", "binary"), tiff]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([header, body]);
};

const make = (name, size, draw) => {
  const out = join(dir, name);
  execFileSync("convert", ["-size", size, ...draw, "-quality", "90", out]);
  return out;
};

// Portrait photo (600×900) with a red top half and blue bottom half, plus GPS EXIF.
const portrait = make("gps-photo.jpg", "600x900", [
  "xc:#2255cc",
  "-fill", "#dd3322", "-draw", "rectangle 0,0 600,450",
  "-fill", "#ffffff", "-draw", "circle 300,450 300,520",
]);
const jpg = readFileSync(portrait);
writeFileSync(portrait, Buffer.concat([jpg.subarray(0, 2), gpsExif(), jpg.subarray(2)]));

// Landscape photo (900×600) with a green left half and yellow right half.
make("landscape.jpg", "900x600", [
  "xc:#e8c020",
  "-fill", "#1f8a4c", "-draw", "rectangle 0,0 450,600",
]);

writeFileSync(join(dir, "not-an-image.txt"), "this is not an image\n");
console.log("fixtures written");

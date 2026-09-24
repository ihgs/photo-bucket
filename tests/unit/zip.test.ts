import { describe, expect, it } from "vitest";
import { ZipError, crc32, createZip, readZip } from "../../src/backup/zip";

const text = (s: string) => new TextEncoder().encode(s);
const bytesOf = async (b: Blob) => new Uint8Array(await b.arrayBuffer());

const sample = () =>
  createZip([
    { name: "backup.json", data: text('{"a":1}') },
    { name: "photos/写真.jpg", data: new Blob([Uint8Array.from([0xff, 0xd8, 0xff, 0xd9])]) },
  ]);

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(text("123456789"))).toBe(0xcbf43926);
  });
});

describe("createZip / readZip", () => {
  it("round-trips names (including Japanese) and bytes", async () => {
    const zip = await readZip(await sample());
    expect(zip.names()).toEqual(["backup.json", "photos/写真.jpg"]);
    expect(new TextDecoder().decode(await zip.read("backup.json"))).toBe('{"a":1}');
    expect([...(await zip.read("photos/写真.jpg"))!]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    expect(await zip.read("missing")).toBeUndefined();
  });

  it("starts with a local file header", async () => {
    const b = await bytesOf(await sample());
    expect([...b.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it("rejects data that is not a ZIP", async () => {
    await expect(readZip(new Blob(['{"format":"photo-bucket-backup"}']))).rejects.toThrow(ZipError);
    await expect(readZip(new Blob([]))).rejects.toThrow(ZipError);
  });

  it("rejects a truncated file", async () => {
    const b = await bytesOf(await sample());
    await expect(readZip(new Blob([b.subarray(0, b.length - 10)]))).rejects.toThrow(ZipError);
  });

  it("rejects an entry whose CRC32 does not match", async () => {
    const b = await bytesOf(await sample());
    b[30 + "backup.json".length + 1] ^= 0xff; // inside the data of the first entry
    const zip = await readZip(new Blob([b]));
    await expect(zip.read("backup.json")).rejects.toThrow(ZipError);
  });

  it("rejects compressed entries", async () => {
    const b = await bytesOf(await sample());
    const view = new DataView(b.buffer);
    // compression method in the first central directory header
    const cd = view.getUint32(b.length - 22 + 16, true);
    view.setUint16(cd + 10, 8, true);
    await expect(readZip(new Blob([b]))).rejects.toThrow(ZipError);
  });
});

/**
 * Minimal ZIP writer/reader for backups (research.md R11): stored entries only (no compression,
 * no ZIP64, no encryption), UTF-8 names. Reading slices the Blob per entry so a large backup is
 * never held in memory as a whole.
 */

export class ZipError extends Error {}

const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const END_SIG = 0x06054b50;
const LOCAL_SIZE = 30;
const CENTRAL_SIZE = 46;
const END_SIZE = 22;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const VERSION = 20;
const MAX_U16 = 0xffff;
const MAX_U32 = 0xffffffff;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export const crc32 = (bytes: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const dosDateTime = (d: Date) => ({
  time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  date: ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
});

export interface ZipEntryInput {
  name: string;
  data: Uint8Array<ArrayBuffer> | Blob;
}

/** Builds a ZIP of stored entries. Blob data is read once for its CRC and kept as a Blob. */
export const createZip = async (entries: ZipEntryInput[], now = new Date()): Promise<Blob> => {
  if (entries.length > MAX_U16) throw new ZipError("too many entries");
  const { time, date } = dosDateTime(now);
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const bytes =
      entry.data instanceof Blob ? new Uint8Array(await entry.data.arrayBuffer()) : entry.data;
    const size = bytes.length;
    if (size > MAX_U32 || offset > MAX_U32) throw new ZipError("file too large");
    const crc = crc32(bytes);

    const local = new Uint8Array(LOCAL_SIZE + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, LOCAL_SIG, true);
    lv.setUint16(4, VERSION, true);
    lv.setUint16(6, UTF8_FLAG, true);
    lv.setUint16(8, 0, true); // stored
    lv.setUint16(10, time, true);
    lv.setUint16(12, date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, name.length, true);
    local.set(name, LOCAL_SIZE);

    const cd = new Uint8Array(CENTRAL_SIZE + name.length);
    const cv = new DataView(cd.buffer);
    cv.setUint32(0, CENTRAL_SIG, true);
    cv.setUint16(4, VERSION, true);
    cv.setUint16(6, VERSION, true);
    cv.setUint16(8, UTF8_FLAG, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, time, true);
    cv.setUint16(14, date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cd.set(name, CENTRAL_SIZE);

    parts.push(local, entry.data instanceof Blob ? entry.data : bytes);
    central.push(cd);
    offset += local.length + size;
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0);
  if (offset > MAX_U32 || cdSize > MAX_U32) throw new ZipError("file too large");
  const end = new Uint8Array(END_SIZE);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, END_SIG, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end], { type: "application/zip" });
};

interface CentralEntry {
  crc: number;
  size: number;
  localOffset: number;
}

export interface ZipReader {
  names(): string[];
  /** The entry's bytes after checking its CRC32, or undefined when there is no such entry. */
  read(name: string): Promise<Uint8Array<ArrayBuffer> | undefined>;
}

const bytesAt = async (blob: Blob, start: number, end: number) =>
  new Uint8Array(await blob.slice(start, end).arrayBuffer());

/** Reads the central directory of a ZIP. Throws ZipError for anything this reader cannot handle. */
export const readZip = async (blob: Blob): Promise<ZipReader> => {
  if (blob.size < END_SIZE) throw new ZipError("not a zip file");
  const tailStart = Math.max(0, blob.size - END_SIZE - MAX_U16);
  const tail = await bytesAt(blob, tailStart, blob.size);
  const tv = new DataView(tail.buffer);
  let endPos = -1;
  for (let i = tail.length - END_SIZE; i >= 0; i--) {
    if (
      tv.getUint32(i, true) === END_SIG &&
      i + END_SIZE + tv.getUint16(i + 20, true) === tail.length
    ) {
      endPos = i;
      break;
    }
  }
  if (endPos < 0) throw new ZipError("end of central directory not found");
  const count = tv.getUint16(endPos + 10, true);
  const cdSize = tv.getUint32(endPos + 12, true);
  const cdOffset = tv.getUint32(endPos + 16, true);
  if (cdOffset + cdSize > tailStart + endPos) throw new ZipError("bad central directory");

  const cd = await bytesAt(blob, cdOffset, cdOffset + cdSize);
  const cv = new DataView(cd.buffer);
  const decoder = new TextDecoder();
  const entries = new Map<string, CentralEntry>();
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + CENTRAL_SIZE > cd.length || cv.getUint32(p, true) !== CENTRAL_SIG)
      throw new ZipError("bad central directory");
    const flags = cv.getUint16(p + 8, true);
    const method = cv.getUint16(p + 10, true);
    const compressed = cv.getUint32(p + 20, true);
    const size = cv.getUint32(p + 24, true);
    const nameLen = cv.getUint16(p + 28, true);
    const extraLen = cv.getUint16(p + 30, true);
    const commentLen = cv.getUint16(p + 32, true);
    if (method !== 0 || flags & ENCRYPTED_FLAG || compressed !== size)
      throw new ZipError("unsupported entry");
    const name = decoder.decode(cd.subarray(p + CENTRAL_SIZE, p + CENTRAL_SIZE + nameLen));
    entries.set(name, {
      crc: cv.getUint32(p + 16, true),
      size,
      localOffset: cv.getUint32(p + 42, true),
    });
    p += CENTRAL_SIZE + nameLen + extraLen + commentLen;
  }

  return {
    names: () => [...entries.keys()],
    read: async (name) => {
      const e = entries.get(name);
      if (!e) return undefined;
      const header = await bytesAt(blob, e.localOffset, e.localOffset + LOCAL_SIZE);
      if (header.length < LOCAL_SIZE) throw new ZipError("bad local header");
      const hv = new DataView(header.buffer);
      if (hv.getUint32(0, true) !== LOCAL_SIG) throw new ZipError("bad local header");
      const start = e.localOffset + LOCAL_SIZE + hv.getUint16(26, true) + hv.getUint16(28, true);
      const bytes = await bytesAt(blob, start, start + e.size);
      if (bytes.length !== e.size || crc32(bytes) !== e.crc) throw new ZipError("crc mismatch");
      return bytes;
    },
  };
};

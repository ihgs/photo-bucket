/** Reads the pixel size from a JPEG's SOF marker. */
export const jpegSize = (buf: Buffer) => {
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error("not a JPEG");
    const marker = buf[i + 1];
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error("no SOF marker");
};

export const hasExif = (buf: Buffer) => buf.includes(Buffer.from("Exif\0\0", "binary"));

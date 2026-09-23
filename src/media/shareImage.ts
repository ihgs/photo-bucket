export type ShareResult = "shared" | "downloaded" | "cancelled";

export const canShareFiles = () =>
  typeof navigator !== "undefined" && typeof navigator.canShare === "function";

const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

/** Opens the share sheet when the device can share files, otherwise downloads the file (research R8). */
export const shareOrDownload = async (
  blob: Blob,
  fileName: string,
  title?: string,
): Promise<ShareResult> => {
  const file = new File([blob], fileName, { type: blob.type });
  if (canShareFiles() && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Some browsers refuse (e.g. NotAllowedError without a user gesture): fall back to download.
    }
  }
  download(blob, fileName);
  return "downloaded";
};

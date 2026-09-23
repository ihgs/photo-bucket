import type { Board } from "../domain/types";

export const BACKUP_FORMAT = "photo-bucket-backup";
export const BACKUP_FORMAT_VERSION = 1;

export interface BackupPhotoJson {
  id: string;
  boardId: string;
  width: number;
  height: number;
  dataUrl: string;
}

export interface BackupJson {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  exportedAt: string;
  boards: Board[];
  photos: BackupPhotoJson[];
}

export const bytesToBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
};

export const base64ToBytes = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
};

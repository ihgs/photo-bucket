import type { Board } from "../domain/types";

export const BACKUP_FORMAT = "photo-bucket-backup";
export const BACKUP_FORMAT_VERSION = 1;
/** The ZIP entry holding boards and photo metadata (contracts/backup-format.md). */
export const BACKUP_MANIFEST = "backup.json";

export interface BackupPhotoJson {
  id: string;
  boardId: string;
  width: number;
  height: number;
  type: string;
  /** ZIP entry name of the photo bytes. */
  path: string;
}

export interface BackupJson {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  exportedAt: string;
  boards: Board[];
  photos: BackupPhotoJson[];
}

const PHOTO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const isPhotoType = (type: string) => type in PHOTO_EXT;

export const photoPath = (id: string, type: string) => `photos/${id}.${PHOTO_EXT[type] ?? "jpg"}`;

import { StorageFullError } from "../storage/db";
import { showToast } from "../ui/components/Toast";

/** Shows a user-facing message for an unexpected error. */
export const reportError = (
  e: unknown,
  fallback = "保存できませんでした。もう一度お試しください",
) => {
  if (e instanceof StorageFullError)
    showToast("端末の保存容量が足りません。不要な写真やボードを削除してください");
  else if (e instanceof Error && e.name === "UserFacingError") showToast(e.message);
  else {
    console.error(e);
    showToast(fallback);
  }
};

/** An error whose message can be shown to the user as is. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

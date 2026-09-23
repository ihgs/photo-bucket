import { useEffect, useState } from "preact/hooks";
import { getFullUrl, getThumbUrl, type PhotoUrl } from "../storage/photos";

export const usePhotoUrl = (photoId: string | undefined, kind: "thumb" | "full") => {
  const [value, setValue] = useState<PhotoUrl | null>(null);
  useEffect(() => {
    let alive = true;
    setValue(null);
    if (!photoId) return;
    void (kind === "thumb" ? getThumbUrl(photoId) : getFullUrl(photoId)).then(
      (u) => alive && setValue(u),
    );
    return () => {
      alive = false;
    };
  }, [photoId, kind]);
  return value;
};

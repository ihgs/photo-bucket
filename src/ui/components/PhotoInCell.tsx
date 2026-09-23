import { DEFAULT_CROP, imageBox } from "../../domain/crop";
import { THUMB_EDGE } from "../../media/importPhoto";
import type { Cell } from "../../domain/types";
import { usePhotoUrl } from "../usePhotoUrl";

/** Inline style that places a photo <img> at the box computed by `imageBox`. */
export const imageStyle = (box: ReturnType<typeof imageBox>) => ({
  left: `${box.left}px`,
  top: `${box.top}px`,
  width: `${box.width}px`,
  height: `${box.height}px`,
  transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
});

const needsFull = (cell: Cell, size: number, w: number, h: number) => {
  const thumbShort = (THUMB_EDGE * Math.min(w, h)) / Math.max(w, h);
  const dpr = typeof devicePixelRatio === "number" ? devicePixelRatio : 1;
  return size * dpr * (cell.crop?.zoom ?? 1) > thumbShort * 1.2;
};

/** The photo of a done cell, cropped exactly like the exported image (research R5). */
export const PhotoInCell = ({ cell, size }: { cell: Cell; size: number }) => {
  const thumb = usePhotoUrl(cell.photoId, "thumb");
  const full = usePhotoUrl(
    thumb && needsFull(cell, size, thumb.width, thumb.height) ? cell.photoId : undefined,
    "full",
  );
  const src = full ?? thumb;
  if (!src) return <div class="photo" style={{ background: "#ddd" }} />;
  const box = imageBox(src.width, src.height, cell.crop ?? DEFAULT_CROP, size);
  return (
    <div class="photo">
      <img src={src.url} alt="" draggable={false} style={imageStyle(box)} />
    </div>
  );
};

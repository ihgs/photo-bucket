import type { LucideIcon } from "lucide-preact";

interface Props {
  icon: LucideIcon;
  /** Accessible name; the icon itself is hidden from assistive technology. */
  label: string;
  onClick: () => void;
}

/** A 44px icon-only button. All icons come from lucide-preact so they share one style. */
export const IconButton = ({ icon: Icon, label, onClick }: Props) => (
  <button type="button" class="btn btn-ghost icon-btn" aria-label={label} onClick={onClick}>
    <Icon size={24} aria-hidden="true" />
  </button>
);

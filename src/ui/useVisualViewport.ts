import { useLayoutEffect, useRef } from "preact/hooks";

/**
 * Keeps a fixed modal backdrop inside the visible part of the screen while it is mounted.
 *
 * On iOS (especially when installed to the home screen) the on-screen keyboard shrinks only the
 * visual viewport: fixed elements stay sized to the layout viewport, and typing makes the page
 * behind scroll, so a bottom sheet slides under the keyboard (#3). This pins the backdrop to
 * `window.visualViewport`, locks the page scroll, and keeps the focused field in view.
 */
export const useVisualViewport = <T extends HTMLElement>() => {
  const ref = useRef<T>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const vv = window.visualViewport;
    const root = document.documentElement;
    root.classList.add("modal-open");
    if (!el || !vv) return () => root.classList.remove("modal-open");

    const update = () => {
      el.style.top = `${vv.offsetTop}px`;
      el.style.height = `${vv.height}px`;
      el.style.bottom = "auto";
    };
    const onResize = () => {
      update();
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && el.contains(focused))
        focused.scrollIntoView({ block: "nearest" });
    };
    update();
    vv.addEventListener("resize", onResize);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", onResize);
      vv.removeEventListener("scroll", update);
      root.classList.remove("modal-open");
    };
  }, []);

  return ref;
};

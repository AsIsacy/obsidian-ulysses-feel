import type { EditorView } from "@codemirror/view";

const NESTED_HOST_SELECTOR =
  "table, td, th, .cm-table-widget, .table-cell-wrapper, .cm-embed-block";

/**
 * Returns true when an EditorView is a nested/embedded sub-editor rather than
 * a top-level document editor (e.g. Obsidian Live Preview table cells, embeds,
 * callout widgets, or any `.cm-editor` nested inside another `.cm-editor`).
 *
 * Document-level layout behaviors (typewriter overscroll, 8ch hanging outdent,
 * baseline highlight overlay, focus dimming, list/tab hijacking) MUST skip
 * nested sub-editors to avoid breaking embedded widgets.
 */
export function isNestedSubEditor(view: EditorView): boolean {
  const dom = view.dom;
  if (!dom) return false;
  if (dom.parentElement?.closest(".cm-editor")) return true;
  if (dom.closest(NESTED_HOST_SELECTOR)) return true;
  return false;
}

/**
 * Returns true only if `scroller` behaves as a bounded vertical scroll container
 * (as opposed to an auto-height box whose clientHeight expands whenever padding
 * is added to its children, which would cause an infinite overscroll feedback loop).
 */
export function hasBoundedVerticalScroller(scroller: HTMLElement): boolean {
  if (!scroller.isConnected) return false;
  if (scroller.clientHeight <= 0) return false;
  const style = window.getComputedStyle(scroller);
  const oy = style.overflowY;
  return oy === "auto" || oy === "scroll" || oy === "overlay";
}

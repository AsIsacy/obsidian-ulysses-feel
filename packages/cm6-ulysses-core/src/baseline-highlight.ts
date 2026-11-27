import { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { BaselineHighlightConfig } from "./types.js";
import { isNestedSubEditor } from "./dom-guards.js";

/**
 * Replicates Ulysses's ULTextHighlightView:
 * Instead of shading the entire active line box (which lowers text contrast),
 * draws a subtle capsule-rounded rule beneath the active line's baseline:
 *   height = fontSize / 6   (Ulysses highlightHeight)
 *   border-radius = height / 2
 *   alpha = 0.15 (Light) / 0.20 (Dark)
 *   smoothly fades out when editor loses focus.
 */
export function baselineHighlightExtension(config: BaselineHighlightConfig): Extension {
  if (!config.enabled) return [];

  const plugin = ViewPlugin.fromClass(
    class BaselineHighlightOverlay {
      private readonly el: HTMLDivElement;
      private readonly onLayoutShifted = () => {
        this.scheduleLayout();
      };

      constructor(private readonly view: EditorView) {
        this.el = document.createElement("div");
        this.el.className = "ul-baseline-highlight";
        this.el.setAttribute("aria-hidden", "true");
        this.el.style.setProperty("--ul-hl-light-alpha", String(config.lightAlpha));
        this.el.style.setProperty("--ul-hl-dark-alpha", String(config.darkAlpha));

        this.view.scrollDOM.addEventListener("ul-layout-shifted", this.onLayoutShifted);
        // Mount lazily inside scheduleLayout once connected and confirmed non-nested
        this.scheduleLayout();
      }

      update(update: ViewUpdate) {
        if (
          update.selectionSet ||
          update.docChanged ||
          update.geometryChanged ||
          update.focusChanged ||
          update.viewportChanged
        ) {
          this.scheduleLayout();
        }
      }

      private scheduleLayout() {
        this.view.requestMeasure({
          key: "ul-baseline-highlight",
          read: (view) => {
            if (!view.dom.isConnected || isNestedSubEditor(view)) {
              return { visible: false as const, remove: true as const };
            }

            const focused = view.hasFocus;
            if (config.fadeOnBlur && !focused) {
              return { visible: false as const, remove: false as const };
            }

            const sel = view.state.selection.main;
            // Hide when user has a multi-line selection (clean UX)
            if (!sel.empty) {
              const fromLine = view.state.doc.lineAt(sel.from).number;
              const toLine = view.state.doc.lineAt(sel.to).number;
              if (fromLine !== toLine) {
                return { visible: false as const };
              }
            }

            const coords = view.coordsAtPos(sel.head);
            if (!coords) return { visible: false as const };

            const scroller = view.scrollDOM;
            const scrollerRect = scroller.getBoundingClientRect();

            // Align horizontal span to the actual writing column (`.cm-line`), not full-pane
            // `.cm-content` which spans the whole window width in Obsidian Minimal / Default themes!
            let columnRect = view.contentDOM.getBoundingClientRect();
            try {
              const domAt = view.domAtPos(sel.head);
              const node = domAt.node;
              const el =
                node.nodeType === Node.ELEMENT_NODE
                  ? (node as HTMLElement)
                  : node.parentElement;
              const lineEl = el?.closest(".cm-line");
              if (lineEl) {
                const lr = lineEl.getBoundingClientRect();
                if (lr.width > 0) columnRect = lr;
              }
            } catch {
              // Fallback to contentDOM rect
            }

            // Font size of current line (fallback to computed content font size)
            const computed = window.getComputedStyle(view.contentDOM);
            const baseFontSize = parseFloat(computed.fontSize) || 16;
            const height = Math.max(2, Math.round((baseFontSize / config.heightDivisor) * 2) / 2);

            // Position just below the baseline/bottom of the visual line
            const top =
              coords.bottom - scrollerRect.top + scroller.scrollTop + 1;

            // Horizontal span aligned strictly to the writing column
            const columnLeftInScroller =
              columnRect.left - scrollerRect.left + scroller.scrollLeft;
            const columnWidth = columnRect.width;

            // Detect dark theme via body class or background luminance
            const isDark =
              document.body.classList.contains("theme-dark") ||
              view.dom.classList.contains("cm-dark");

            return {
              visible: true as const,
              top,
              left: columnLeftInScroller,
              width: columnWidth,
              height,
              isDark,
            };
          },
          write: (m, view) => {
            if (!m || !m.visible) {
              this.el.classList.remove("ul-baseline-highlight-visible");
              if (m && "remove" in m && m.remove && this.el.isConnected) {
                this.el.remove();
              }
              return;
            }
            if (!this.el.isConnected) {
              view.scrollDOM.appendChild(this.el);
            }
            this.el.style.transform = `translate3d(${Math.round(m.left)}px, ${Math.round(m.top)}px, 0)`;
            this.el.style.width = `${Math.max(0, Math.round(m.width))}px`;
            this.el.style.height = `${m.height}px`;
            this.el.style.borderRadius = `${m.height / 2}px`;
            this.el.classList.toggle("ul-baseline-dark", m.isDark);
            this.el.classList.add("ul-baseline-highlight-visible");
          },
        });
      }

      destroy() {
        this.view.scrollDOM.removeEventListener("ul-layout-shifted", this.onLayoutShifted);
        this.el.remove();
      }
    },
  );

  return [plugin];
}

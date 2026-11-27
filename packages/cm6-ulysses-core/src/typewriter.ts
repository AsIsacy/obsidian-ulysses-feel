import { Extension } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { cursorLineDown, cursorLineUp } from "@codemirror/commands";
import type { TypewriterConfig, TypewriterScrollMode } from "./types.js";
import { isNestedSubEditor } from "./dom-guards.js";

/**
 * Compute Ulysses perceptual typewriter scroll animation duration:
 *   duration = factorMs * sqrt(|deltaY|)
 * Reverse-engineered from ULSheetContainerView(TypewriterMode):
 *   0.015s * sqrt(|deltaY|) = 15ms * sqrt(|deltaY|)
 */
export function computeSqrtScrollDurationMs(
  deltaY: number,
  factorMs = 15,
  maxDurationMs = 650,
): number {
  const absDelta = Math.abs(deltaY);
  if (absDelta < 0.5) return 0;
  return Math.min(maxDurationMs, factorMs * Math.sqrt(absDelta));
}

/**
 * Snap scroll coordinate to physical backing-store pixels (equivalent to convertSizeToBacking).
 */
export function snapToDevicePixel(value: number, dpr = 1): number {
  const scale = dpr > 0 ? dpr : 1;
  return Math.round(value * scale) / scale;
}

/**
 * Compute target scrollTop for a caret baseline Y (in document/content coordinates).
 * Returns null if no scrolling is needed (e.g. already inside variable comfort band).
 */
export function computeTypewriterTargetScrollTop(params: {
  mode: TypewriterScrollMode;
  currentScrollTop: number;
  viewportHeight: number;
  caretBaselineDocY: number;
  variableBandTop: number;
  variableBandBottom: number;
  fixedFractions: { top: number; middle: number; bottom: number };
  dpr?: number;
}): number | null {
  const {
    mode,
    currentScrollTop,
    viewportHeight,
    caretBaselineDocY,
    variableBandTop,
    variableBandBottom,
    fixedFractions,
    dpr = 1,
  } = params;

  if (mode === "off" || viewportHeight <= 0) return null;

  let rawTarget: number | null = null;

  if (mode === "variable") {
    // Caret Y relative to visible viewport top
    const relY = caretBaselineDocY - currentScrollTop;
    const topLimit = viewportHeight * variableBandTop;
    const bottomLimit = viewportHeight * variableBandBottom;

    if (relY < topLimit) {
      rawTarget = caretBaselineDocY - topLimit;
    } else if (relY > bottomLimit) {
      rawTarget = caretBaselineDocY - bottomLimit;
    } else {
      return null;
    }
  } else {
    const fraction =
      mode === "top"
        ? fixedFractions.top
        : mode === "bottom"
          ? fixedFractions.bottom
          : fixedFractions.middle;
    rawTarget = caretBaselineDocY - viewportHeight * fraction;
  }

  const clamped = Math.max(0, rawTarget);
  return snapToDevicePixel(clamped, dpr);
}

/** Cubic ease-in-ease-out matching kCAMediaTimingFunctionEaseInEaseOut */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function isFixedMode(mode: TypewriterScrollMode): boolean {
  return mode === "top" || mode === "middle" || mode === "bottom";
}

export function typewriterExtension(config: TypewriterConfig): Extension {
  if (!config.enabled || config.mode === "off") return [];

  // Compute exact Ulysses vertical overscroll fractions in native CSS viewport units (`vh`):
  // - Variable mode rests line 1 gracefully at the upper 1/3 (~33.3vh) with 55vh bottom room.
  // - Fixed modes match their exact anchor fraction (30%/50%/70%).
  // Provided via official CM6 `EditorView.editorAttributes` so it applies synchronously on Frame 0,
  // scales at 120fps on window resize, and automatically skips nested sub-editors (table cells!).
  let topVh = Math.round(config.variableTopMargin * 1000) / 10;
  let bottomVh = Math.max(55, Math.round((1 - config.variableBandBottom) * 100) + 10);
  if (isFixedMode(config.mode)) {
    const frac =
      config.mode === "top"
        ? config.fixedFractions.top
        : config.mode === "bottom"
          ? config.fixedFractions.bottom
          : config.fixedFractions.middle;
    topVh = Math.round(frac * 1000) / 10;
    bottomVh = Math.round((1 - frac) * 1000) / 10;
  }

  const overscrollAttrs = config.overscrollPadding
    ? EditorView.editorAttributes.of((view) => {
        if (isNestedSubEditor(view)) return null;
        return {
          class: "ul-typewriter-overscroll-top ul-typewriter-overscroll-bottom",
          style: `--ul-overscroll-top: ${topVh}vh; --ul-overscroll-bottom: ${bottomVh}vh`,
        };
      })
    : [];

  const plugin = ViewPlugin.fromClass(
    class TypewriterController {
      private rafId: number | null = null;
      private isPointerDown = false;
      private wheelAccum = 0;
      private pendingWheelReset: number | null = null;
      private scrollAnimStart = 0;
      private scrollAnimDuration = 0;
      private scrollAnimFrom = 0;
      private scrollAnimTo = 0;

      private readonly onPointerDown = () => {
        this.isPointerDown = true;
        this.cancelAnimation();
      };

      private readonly onPointerUp = () => {
        this.isPointerDown = false;
      };

      private readonly onWheel = (event: WheelEvent) => {
        if (!config.enabled || config.mode === "off") return;
        if (isNestedSubEditor(this.view)) return;
        this.cancelAnimation();

        // In Fixed modes, replicate Ulysses managedScrolling_scrollWheel:
        // wheel moves caret up/down line-by-line instead of fighting the anchor.
        if (config.wheelMovesCaretInFixed && isFixedMode(config.mode)) {
          if (Math.abs(event.deltaY) < 0.5) return;
          // Ignore pinch-zoom or horizontal scroll
          if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

          event.preventDefault();
          const lineStepPx = Math.max(18, this.view.defaultLineHeight || 24);
          this.wheelAccum += event.deltaY;

          const steps = Math.trunc(this.wheelAccum / lineStepPx);
          if (steps !== 0) {
            this.wheelAccum -= steps * lineStepPx;
            const count = Math.min(Math.abs(steps), 5);
            const cmd = steps > 0 ? cursorLineDown : cursorLineUp;
            for (let i = 0; i < count; i++) {
              cmd(this.view);
            }
          }

          if (this.pendingWheelReset !== null) {
            window.clearTimeout(this.pendingWheelReset);
          }
          this.pendingWheelReset = window.setTimeout(() => {
            this.wheelAccum = 0;
            this.pendingWheelReset = null;
          }, 160);
        }
      };

      constructor(private readonly view: EditorView) {
        this.view.dom.addEventListener("pointerdown", this.onPointerDown, { passive: true });
        window.addEventListener("pointerup", this.onPointerUp, { passive: true });
        this.view.scrollDOM.addEventListener("wheel", this.onWheel, { passive: false });
      }

      update(update: ViewUpdate) {
        if (isNestedSubEditor(this.view)) return;

        if (!update.selectionSet && !update.docChanged) return;
        // Do not yank viewport while user is dragging mouse to select text
        if (this.isPointerDown) return;
        // Skip during IME composition commit churn if selection didn't move
        if (this.view.composing && !update.selectionSet) return;

        // Only scroll the active focused editor
        if (!this.view.hasFocus) return;

        // Avoid fighting non-user programmatic state refreshes
        const isUserOrEdit =
          update.docChanged ||
          update.transactions.some(
            (tr) =>
              tr.isUserEvent("select") ||
              tr.isUserEvent("input") ||
              tr.isUserEvent("delete") ||
              tr.isUserEvent("undo") ||
              tr.isUserEvent("redo") ||
              tr.isUserEvent("move"),
          );

        // Always allow cursor navigation / edits; also handle wheel-triggered cursorLineUp/Down
        if (!isUserOrEdit && !update.selectionSet) return;

        this.scheduleCenterCaret();
      }

      private scheduleCenterCaret() {
        this.view.requestMeasure({
          key: "ul-typewriter-scroll",
          read: (view) => {
            const head = view.state.selection.main.head;
            const scroller = view.scrollDOM;
            const viewportHeight = scroller.clientHeight;
            if (viewportHeight <= 0) return null;

            const coords = view.coordsAtPos(head);
            if (!coords) return null;

            const scrollerRect = scroller.getBoundingClientRect();
            const currentScrollTop = scroller.scrollTop;
            // Caret baseline in scrollDOM content coordinates
            const caretBaselineDocY =
              coords.bottom - scrollerRect.top + currentScrollTop;

            const targetScrollTop = computeTypewriterTargetScrollTop({
              mode: config.mode,
              currentScrollTop,
              viewportHeight,
              caretBaselineDocY,
              variableBandTop: config.variableBandTop,
              variableBandBottom: config.variableBandBottom,
              fixedFractions: config.fixedFractions,
              dpr: window.devicePixelRatio || 1,
            });

            if (targetScrollTop === null) return null;
            const maxScrollTop = Math.max(0, scroller.scrollHeight - viewportHeight);
            const clampedTarget = Math.min(maxScrollTop, Math.max(0, targetScrollTop));
            const deltaY = clampedTarget - currentScrollTop;
            if (Math.abs(deltaY) < 1) return null;

            return { currentScrollTop, targetScrollTop: clampedTarget, deltaY };
          },
          write: (measure, view) => {
            if (!measure) return;
            const { currentScrollTop, targetScrollTop, deltaY } = measure;

            if (!config.animate) {
              this.cancelAnimation();
              view.scrollDOM.scrollTop = targetScrollTop;
              return;
            }

            const duration = computeSqrtScrollDurationMs(
              deltaY,
              config.sqrtDurationFactorMs,
              config.maxDurationMs,
            );
            if (duration <= 4) {
              this.cancelAnimation();
              view.scrollDOM.scrollTop = targetScrollTop;
              return;
            }

            this.startAnimation(currentScrollTop, targetScrollTop, duration);
          },
        });
      }

      private startAnimation(from: number, to: number, duration: number) {
        this.cancelAnimation();
        this.scrollAnimFrom = from;
        this.scrollAnimTo = to;
        this.scrollAnimDuration = duration;
        this.scrollAnimStart = performance.now();

        const step = (now: number) => {
          const elapsed = now - this.scrollAnimStart;
          const progress = Math.min(1, elapsed / this.scrollAnimDuration);
          const eased = easeInOutCubic(progress);
          const next =
            this.scrollAnimFrom + (this.scrollAnimTo - this.scrollAnimFrom) * eased;
          const snapped = snapToDevicePixel(next, window.devicePixelRatio || 1);
          this.view.scrollDOM.scrollTop = snapped;

          if (progress < 1) {
            this.rafId = window.requestAnimationFrame(step);
          } else {
            this.rafId = null;
          }
        };

        this.rafId = window.requestAnimationFrame(step);
      }

      private cancelAnimation() {
        if (this.rafId !== null) {
          window.cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }
      }

      destroy() {
        this.cancelAnimation();
        if (this.pendingWheelReset !== null) {
          window.clearTimeout(this.pendingWheelReset);
        }
        this.view.dom.removeEventListener("pointerdown", this.onPointerDown);
        window.removeEventListener("pointerup", this.onPointerUp);
        this.view.scrollDOM.removeEventListener("wheel", this.onWheel);
      }
    },
  );

  return [overscrollAttrs, plugin];
}

import { EditorSelection, Extension, RangeSetBuilder, Text } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { FocusModeConfig, FocusModeKind } from "./types.js";
import { isNestedSubEditor } from "./dom-guards.js";

export interface FocusRange {
  from: number;
  to: number;
}

/**
 * Pure range calculator for Paragraph and Sentence focus modes.
 * Uses native Intl.Segmenter for CJK + Latin sentence boundary accuracy,
 * with a clean punctuation regex fallback if Intl.Segmenter is unavailable.
 */
export function computeFocusRange(
  doc: Text,
  selFrom: number,
  selTo: number,
  mode: FocusModeKind,
  locale?: string,
): FocusRange | null {
  if (mode === "off") return null;

  const startLine = doc.lineAt(selFrom);
  const endLine = doc.lineAt(selTo);

  if (mode === "paragraph" || mode === "line") {
    // Visual-line refinement happens in ViewPlugin for "line" mode;
    // logical line is the fallback/unit-testable baseline.
    return { from: startLine.from, to: endLine.to };
  }

  // Sentence focus mode: segment the paragraph(s) enclosing selection
  const paraFrom = startLine.from;
  const paraTo = endLine.to;
  const text = doc.sliceString(paraFrom, paraTo);
  if (text.length === 0) {
    return { from: paraFrom, to: paraTo };
  }

  const segments = segmentSentences(text, locale);
  const relFrom = selFrom - paraFrom;
  const relTo = selTo - paraFrom;

  let focusStart = 0;
  let focusEnd = text.length;
  let foundStart = false;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const segStart = seg.start;
    const segEnd = seg.end;

    // Cursor right at end of paragraph or end of a sentence stays attached to that sentence
    // unless next sentence already started with non-whitespace
    const containsStart =
      (relFrom >= segStart && relFrom < segEnd) ||
      (i === segments.length - 1 && relFrom === segEnd);

    if (!foundStart && containsStart) {
      focusStart = segStart;
      foundStart = true;
    }

    if (foundStart) {
      if (relTo <= segEnd || i === segments.length - 1) {
        focusEnd = segEnd;
        break;
      }
    }
  }

  return {
    from: paraFrom + focusStart,
    to: paraFrom + focusEnd,
  };
}

interface TextSegment {
  start: number;
  end: number;
}

function segmentSentences(text: string, locale?: string): TextSegment[] {
  const IntlAny = Intl as unknown as {
    Segmenter?: new (
      locale?: string,
      options?: { granularity: "sentence" },
    ) => { segment(input: string): Iterable<{ index: number; segment: string }> };
  };

  if (typeof IntlAny.Segmenter === "function") {
    const segmenter = new IntlAny.Segmenter(locale, { granularity: "sentence" });
    const out: TextSegment[] = [];
    for (const part of segmenter.segment(text)) {
      out.push({ start: part.index, end: part.index + part.segment.length });
    }
    if (out.length > 0) return out;
  }

  // Fallback regex supporting Latin (. ! ?) and CJK (。！？)
  const out: TextSegment[] = [];
  const regex = /[^.!?。！？\n]+(?:[.!?。！？]+["”’')）\]]*\s*|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    out.push({ start: match.index, end: match.index + match[0].length });
  }
  return out.length > 0 ? out : [{ start: 0, end: text.length }];
}

/**
 * Replicates ULFocusModeRenderingModifier:
 * - Supports Line (visual wrapped line aware), Sentence, and Paragraph focus.
 * - Dims unfocused text to opacity 0.20 (configurable) + optional desaturation.
 * - Only decorates visible ranges for smooth performance on long documents.
 */
export function focusModeExtension(config: FocusModeConfig): Extension {
  if (!config.enabled || config.mode === "off") return [];

  const dimMark = Decoration.mark({ class: "ul-focus-dimmed" });
  const focusClasses = config.desaturate
    ? "ul-focus-active ul-focus-desaturate"
    : "ul-focus-active";

  const editorAttrs = EditorView.editorAttributes.of((view) => {
    if (isNestedSubEditor(view)) return null;
    return {
      class: focusClasses,
      style: `--ul-focus-dim-opacity: ${config.unfocusedOpacity}`,
    };
  });

  const plugin = ViewPlugin.fromClass(
    class FocusModePlugin {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations =
          view.dom.isConnected && !isNestedSubEditor(view)
            ? this.buildDecorations(view)
            : Decoration.none;
      }

      update(update: ViewUpdate) {
        if (isNestedSubEditor(update.view)) {
          this.decorations = Decoration.none;
          return;
        }
        if (
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.geometryChanged
        ) {
          this.decorations = this.buildDecorations(update.view);
        }
      }

      private resolveVisualLineFocusRange(view: EditorView): FocusRange {
        const sel = view.state.selection.main;
        const startBlock = view.lineBlockAt(sel.from);
        const endBlock = view.lineBlockAt(sel.to);

        // Try visual wrapped line via moveToLineBoundary (handles soft wrap cleanly!)
        let from = startBlock.from;
        let to = endBlock.to;

        try {
          const lineStart = view.moveToLineBoundary(sel, false, true);
          const lineEnd = view.moveToLineBoundary(sel, true, true);
          if (sel.empty) {
            from = Math.min(lineStart.from, sel.from);
            to = Math.max(lineEnd.to, sel.to);
          } else {
            const headRangeStart = view.moveToLineBoundary(
              EditorSelection.cursor(sel.from),
              false,
              true,
            );
            const headRangeEnd = view.moveToLineBoundary(
              EditorSelection.cursor(sel.to),
              true,
              true,
            );
            from = headRangeStart.from;
            to = headRangeEnd.to;
          }
        } catch {
          // Fallback to logical line block when DOM layout isn't measured yet
        }

        return { from, to };
      }

      private buildDecorations(view: EditorView): DecorationSet {
        const sel = view.state.selection.main;
        const focusRange =
          config.mode === "line"
            ? this.resolveVisualLineFocusRange(view)
            : computeFocusRange(
                view.state.doc,
                sel.from,
                sel.to,
                config.mode,
                config.locale,
              );

        if (!focusRange) return Decoration.none;

        const builder = new RangeSetBuilder<Decoration>();

        for (const { from: visFrom, to: visTo } of view.visibleRanges) {
          // Segment before focus range
          const beforeEnd = Math.min(visTo, focusRange.from);
          if (visFrom < beforeEnd) {
            this.addLineSafeMarks(builder, view.state.doc, visFrom, beforeEnd);
          }

          // Segment after focus range
          const afterStart = Math.max(visFrom, focusRange.to);
          if (afterStart < visTo) {
            this.addLineSafeMarks(builder, view.state.doc, afterStart, visTo);
          }
        }

        return builder.finish();
      }

      /**
       * Add mark decorations per line segment so they never cross line breaks awkwardly
       * and remain compatible with Obsidian Live Preview widgets.
       */
      private addLineSafeMarks(
        builder: RangeSetBuilder<Decoration>,
        doc: Text,
        from: number,
        to: number,
      ) {
        let pos = from;
        while (pos < to) {
          const line = doc.lineAt(pos);
          const segEnd = Math.min(to, line.to);
          if (pos < segEnd) {
            builder.add(pos, segEnd, dimMark);
          }
          pos = line.to + 1;
        }
      }

      destroy() {
        // Attributes cleaned automatically by CM6 editorAttributes facet
      }
    },
    {
      decorations: (v) => v.decorations,
    },
  );

  return [editorAttrs, plugin];
}

import { Annotation, Extension, Prec, RangeSetBuilder } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import type { HangingOutdentConfig } from "./types.js";
import { isNestedSubEditor } from "./dom-guards.js";
import {
  collectHiddenInlineReplacements,
  isReadingDecorationsFacet,
} from "./zero-jump-syntax.js";

const HEADING_PREFIX_RE = /^(#{1,6})(\s+)/;
const QUOTE_PREFIX_RE = /^(\s*(?:>\s*)+)/;

const outdentMeasureAnnotation = Annotation.define<boolean>();

/**
 * Replicates Ulysses's optical hanging outdent (ULLayoutManager(Typesetting)):
 * - Reserves an 8ch left margin for block syntax markers (`# `, `## `, `> `, etc.).
 * - Verifies in DOM whether the formatting prefix (`.cm-formatting-header` / `.cm-formatting-quote`)
 *   is actually rendered on each line, and ONLY then applies negative `text-indent` equal to its
 *   exact measured pixel width.
 * - Result:
 *   - In Obsidian Live Preview: inactive lines (or unfocused lines) stay at `text-indent: 0` with a
 *     subtle left-margin `::before` marker; the exact moment Obsidian reveals `.cm-formatting-header`,
 *     our plugin pulls it into the left margin by its exact measured width -> TRUE ZERO-PIXEL JUMP!
 *   - In Source Mode: every heading & blockquote outdents cleanly into the left margin.
 * - Uses only `text-indent` (never `position: absolute` on editable spans), keeping CM6 `coordsAtPos`,
 *   hit-testing, selection rects, and CJK IME 100% native.
 */
export function hangingOutdentExtension(config: HangingOutdentConfig): Extension {
  if (!config.enabled) return [];

  const rootClasses = [
    "ul-outdent-enabled",
    config.mutedSyntax ? "ul-muted-syntax" : "",
    config.showInactiveHeadingMarkers ? "ul-show-inactive-heading-markers" : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Use official CM6 EditorView.editorAttributes so CM6 preserves our classes
  // across focus/blur transitions and automatically excludes nested sub-editors.
  const editorAttrs = EditorView.editorAttributes.of((view) => {
    if (isNestedSubEditor(view)) return null;
    return {
      class: rootClasses,
      style: `--ul-outdent-width: ${config.outdentWidthCh}ch`,
    };
  });

  const plugin = ViewPlugin.fromClass(
    class HangingOutdentPlugin {
      /** Map of lineNumber -> measured pixel width of currently rendered formatting prefix */
      livePrefixWidths = new Map<number, number>();
      /** Cross-line cache of prefix key (e.g. "h2:## ") -> exact pixel width for 0-frame outdent! */
      prefixWidthCache = new Map<string, number>();
      private isLivePreview = false;
      private dispatchQueued = false;

      constructor(readonly view: EditorView) {
        this.detectLivePreview();
        this.scheduleMeasure();
      }

      update(update: ViewUpdate) {
        if (isNestedSubEditor(update.view)) return;

        const modeChanged = this.detectLivePreview();
        const isSelfMeasureRefresh =
          update.transactions.length > 0 &&
          update.transactions.every((tr) => tr.annotation(outdentMeasureAnnotation));

        if (isSelfMeasureRefresh) return;

        if (
          modeChanged ||
          update.docChanged ||
          update.selectionSet ||
          update.viewportChanged ||
          update.focusChanged
        ) {
          this.scheduleMeasure();
        }
      }

      detectLivePreview(): boolean {
        const next = Boolean(
          this.view.dom.closest(".is-live-preview") ||
            this.view.dom.classList.contains("is-live-preview"),
        );
        const changed = next !== this.isLivePreview;
        this.isLivePreview = next;
        return changed;
      }

      get livePreviewActive(): boolean {
        this.detectLivePreview();
        return this.isLivePreview;
      }

      buildDecorations(view: EditorView): DecorationSet {
        if (isReadingDecorationsFacet(view)) return Decoration.none;
        if (!view.dom.isConnected || isNestedSubEditor(view)) return Decoration.none;

        const builder = new RangeSetBuilder<Decoration>();
        const doc = view.state.doc;
        const seenLines = new Set<number>();
        const isLP = this.livePreviewActive;

        // Read currently hidden Live Preview delimiter ranges in Phase 2 (after all ViewPlugins
        // finished updating, before DOM paint -> TRUE 0-frame synchronous outdent!).
        const hiddenRanges = isLP ? collectHiddenInlineReplacements(view) : [];

        const isPrefixHidden = (lineFrom: number, prefixLen: number): boolean => {
          const prefixEnd = lineFrom + prefixLen;
          for (const h of hiddenRanges) {
            if (h.from > prefixEnd) break;
            if (h.from <= lineFrom && h.to >= lineFrom + 1) {
              return true;
            }
          }
          return false;
        };

        for (const { from, to } of view.visibleRanges) {
          let pos = from;
          while (pos <= to) {
            const line = doc.lineAt(pos);
            if (!seenLines.has(line.number)) {
              seenLines.add(line.number);
              const hm = HEADING_PREFIX_RE.exec(line.text);
              if (hm) {
                const hashes = hm[1]!;
                const prefixStr = hm[0]!;
                const prefixLen = prefixStr.length;
                const cacheKey = `h${hashes.length}:${prefixStr}`;
                const measured =
                  this.livePrefixWidths.get(line.number) ??
                  this.prefixWidthCache.get(cacheKey);
                const hiddenByHost = isLP && isPrefixHidden(line.from, prefixLen);
                const hasLiveMarker = !hiddenByHost;

                const attrs: Record<string, string> = {
                  "data-ul-heading": hashes,
                };

                let cls = "ul-outdent-heading";
                if (hasLiveMarker) {
                  cls += " ul-outdent-live-prefix";
                  if (measured !== undefined && measured > 0) {
                    attrs.style = `--ul-line-outdent: -${measured.toFixed(1)}px;`;
                  } else {
                    const fallbackCh = Math.min(config.outdentWidthCh - 1, prefixLen);
                    attrs.style = `--ul-line-outdent: -${fallbackCh}ch;`;
                  }
                } else {
                  cls += " ul-outdent-inactive-heading";
                }

                builder.add(
                  line.from,
                  line.from,
                  Decoration.line({ class: cls, attributes: attrs }),
                );
              } else {
                const qm = QUOTE_PREFIX_RE.exec(line.text);
                if (qm) {
                  const prefixStr = qm[1]!;
                  const prefixLen = prefixStr.length;
                  const hiddenByHost = isLP && isPrefixHidden(line.from, prefixLen);
                  if (!hiddenByHost) {
                    const cacheKey = `q:${prefixStr}`;
                    const measured =
                      this.livePrefixWidths.get(line.number) ??
                      this.prefixWidthCache.get(cacheKey);
                    const outdentVal =
                      measured !== undefined && measured > 0
                        ? `-${measured.toFixed(1)}px`
                        : `-${Math.min(config.outdentWidthCh - 1, prefixLen)}ch`;
                    builder.add(
                      line.from,
                      line.from,
                      Decoration.line({
                        class: "ul-outdent-quote ul-outdent-live-prefix",
                        attributes: { style: `--ul-line-outdent: ${outdentVal};` },
                      }),
                    );
                  }
                }
              }
            }

            if (line.to >= doc.length) break;
            pos = line.to + 1;
          }
        }

        return builder.finish();
      }

      private scheduleMeasure() {
        this.view.requestMeasure({
          key: "ul-hanging-outdent-measure",
          read: (view) => {
            if (!view.dom.isConnected || isNestedSubEditor(view)) {
              return {
                nested: true as const,
                nextMap: new Map<number, number>(),
                cacheEntries: [] as Array<[string, number]>,
              };
            }
            const nextMap = new Map<number, number>();
            const cacheEntries: Array<[string, number]> = [];
            const lines = view.contentDOM.querySelectorAll<HTMLElement>(
              ".ul-outdent-heading, .ul-outdent-quote",
            );
            const baseFontSize =
              parseFloat(getComputedStyle(view.contentDOM).fontSize) || 16;
            const maxOutsetPx =
              baseFontSize * 0.65 * Math.max(1, config.outdentWidthCh - 1);

            for (const lineEl of lines) {
              const fmtEl = lineEl.querySelector<HTMLElement>(
                ".cm-formatting-header, .cm-formatting-quote, .tok-heading-mark",
              );
              if (!fmtEl) continue;

              const rect = fmtEl.getBoundingClientRect();
              if (rect.width <= 0.5) continue;

              try {
                const pos = view.posAtDOM(lineEl, 0);
                const docLine = view.state.doc.lineAt(pos);
                const width = Math.min(maxOutsetPx, rect.width);
                nextMap.set(docLine.number, width);

                const hm = HEADING_PREFIX_RE.exec(docLine.text);
                if (hm) {
                  cacheEntries.push([`h${hm[1]!.length}:${hm[0]!}`, width]);
                } else {
                  const qm = QUOTE_PREFIX_RE.exec(docLine.text);
                  if (qm) cacheEntries.push([`q:${qm[1]!}`, width]);
                }
              } catch {
                // Transient DOM detachment
              }
            }
            return { nested: false as const, nextMap, cacheEntries };
          },
          write: (res, view) => {
            if (!res || res.nested) return;
            for (const [k, w] of res.cacheEntries) {
              this.prefixWidthCache.set(k, w);
            }
            const nextMap = res.nextMap;
            let changed = nextMap.size !== this.livePrefixWidths.size;
            if (!changed) {
              for (const [ln, w] of nextMap) {
                const prev = this.livePrefixWidths.get(ln);
                if (prev === undefined || Math.abs(prev - w) > 1.0) {
                  changed = true;
                  break;
                }
              }
            }
            if (changed && !this.dispatchQueued) {
              this.livePrefixWidths = nextMap;
              this.dispatchQueued = true;
              queueMicrotask(() => {
                this.dispatchQueued = false;
                if (!view.dom.isConnected || isNestedSubEditor(view)) return;
                view.dispatch({
                  annotations: outdentMeasureAnnotation.of(true),
                });
              });
            }
          },
        });
      }
    },
  );

  const lineDecorations = Prec.lowest(
    EditorView.decorations.of((view) => {
      if (isReadingDecorationsFacet(view)) return Decoration.none;
      const inst = view.plugin(plugin);
      return inst ? inst.buildDecorations(view) : Decoration.none;
    }),
  );

  return [editorAttrs, plugin, lineDecorations];
}

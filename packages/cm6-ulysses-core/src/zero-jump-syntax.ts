import { Extension, Prec, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import type { HangingOutdentConfig } from "./types.js";
import { isNestedSubEditor } from "./dom-guards.js";

export interface HiddenReplacementRange {
  from: number;
  to: number;
  text: string;
}

/**
 * Reentrancy guard per EditorView so reading `EditorView.decorations` from inside
 * our ViewPlugins never triggers infinite recursion when CM6 calls our own getter.
 */
const activeFacetReads = new WeakSet<EditorView>();

export function isReadingDecorationsFacet(view: EditorView): boolean {
  return activeFacetReads.has(view);
}

/**
 * Read currently active inline hidden-syntax replacement ranges (`Decoration.replace({})`)
 * from official CodeMirror 6 `EditorView.decorations` across visible ranges.
 *
 * Works portably across Obsidian Live Preview and any other CM6 live-preview host,
 * using 100% public CM6 APIs (zero private internals or monkey-patching).
 */
export function collectHiddenInlineReplacements(
  view: EditorView,
): HiddenReplacementRange[] {
  if (activeFacetReads.has(view)) return [];
  activeFacetReads.add(view);

  const results: HiddenReplacementRange[] = [];
  const seen = new Set<string>();
  const doc = view.state.doc;

  try {
    const providers = view.state.facet(EditorView.decorations);
    for (const src of providers) {
      let set: DecorationSet | undefined;
      try {
        set = typeof src === "function" ? src(view) : src;
      } catch {
        continue;
      }
      if (!set || typeof set.between !== "function") continue;

      for (const { from: visFrom, to: visTo } of view.visibleRanges) {
        set.between(visFrom, visTo, (a, b, val) => {
          // Only inline (non-block), widget-less replacement hiding non-empty text
          if (a >= b || !val.point) return;
          const spec = val.spec as { widget?: unknown; block?: boolean } | undefined;
          if (spec?.widget || spec?.block) return;

          const key = `${a}:${b}`;
          if (seen.has(key)) return;
          seen.add(key);

          // Cap text length to avoid slicing giant folded blocks
          if (b - a > 12) return;
          results.push({
            from: a,
            to: b,
            text: doc.sliceString(a, b),
          });
        });
      }
    }
  } finally {
    activeFacetReads.delete(view);
  }

  results.sort((x, y) => x.from - y.from || x.to - y.to);
  return results;
}

const INLINE_SYNTAX_DELIM_RE = /^(\*\*|\*|__|_|`+|~~|==)$/;

function classifyGhostSyntax(text: string): string {
  if (text.startsWith("`")) {
    return "ul-ghost-syntax ul-ghost-code cm-formatting cm-formatting-code";
  }
  if (text === "**" || text === "__") {
    return "ul-ghost-syntax ul-ghost-strong cm-formatting cm-formatting-strong";
  }
  if (text === "*" || text === "_") {
    return "ul-ghost-syntax ul-ghost-em cm-formatting cm-formatting-em";
  }
  if (text === "~~") {
    return "ul-ghost-syntax ul-ghost-strike cm-formatting cm-formatting-strikethrough";
  }
  if (text === "==") {
    return "ul-ghost-syntax ul-ghost-highlight cm-formatting cm-formatting-highlight";
  }
  return "ul-ghost-syntax cm-formatting";
}

class GhostSyntaxWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly className: string,
    readonly isOpener: boolean,
  ) {
    super();
  }

  override eq(other: GhostSyntaxWidget): boolean {
    return (
      this.text === other.text &&
      this.className === other.className &&
      this.isOpener === other.isOpener
    );
  }

  override toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = this.className;
    // Zero-width U+2060 Word Joiner keeps opening delimiters attached to the following word
    // and closing delimiters attached to the preceding word, matching real inline wrapping!
    span.textContent = this.isOpener ? `${this.text}\u2060` : `\u2060${this.text}`;
    span.setAttribute("aria-hidden", "true");
    return span;
  }

  override ignoreEvent(): boolean {
    // Allow clicks on ghost syntax markers to pass naturally into CM6 hit-testing
    return false;
  }
}

interface PendingWidget {
  pos: number;
  side: number;
  deco: Decoration;
}

/**
 * Zero-Jump Live Preview for inline Markdown syntax (`**`, `*`, `__`, `_`, `` ` ``, `~~`, `==`):
 *
 * Whenever a Live Preview host hides an inline delimiter via `Decoration.replace({})`,
 * this extension renders a muted ghost widget with the exact same glyph width & font metrics.
 * The instant the cursor enters the span and the host reveals the real delimiter, our ghost
 * widget vanishes in the exact same CM6 transaction (Frame 0) -> 0.0px horizontal shift,
 * zero line-wrap reflow, while preserving all Live Preview tables, callouts, images & diagrams!
 */
export function zeroJumpInlineSyntaxExtension(
  config: HangingOutdentConfig,
): Extension {
  if (!config.enabled || !config.zeroJumpInlineSyntax) return [];

  interface CacheEntry {
    sig: string;
    decos: DecorationSet;
  }
  const cache = new WeakMap<EditorView, CacheEntry>();

  const buildForView = (view: EditorView): DecorationSet => {
    if (isReadingDecorationsFacet(view)) return Decoration.none;
    if (!view.dom.isConnected || isNestedSubEditor(view)) return Decoration.none;

    const hidden = collectHiddenInlineReplacements(view);
    if (hidden.length === 0) {
      cache.delete(view);
      return Decoration.none;
    }

    // Fast signature check to reuse DecorationSet across no-op redraws
    let sig = "";
    for (let i = 0; i < hidden.length; i++) {
      const h = hidden[i]!;
      sig += `${h.from}:${h.to}:${h.text}|`;
    }
    const prev = cache.get(view);
    if (prev && prev.sig === sig) return prev.decos;

    const doc = view.state.doc;
    const pending: PendingWidget[] = [];
    let currentLineNum = -1;
    const openCounts = new Map<string, number>();

    for (const item of hidden) {
      if (!INLINE_SYNTAX_DELIM_RE.test(item.text)) continue;

      const line = doc.lineAt(item.from);
      if (
        item.from === line.from &&
        /^(\*\*\*|---|___|```|~~~)/.test(line.text.trim())
      ) {
        continue;
      }

      if (line.number !== currentLineNum) {
        currentLineNum = line.number;
        openCounts.clear();
      }

      const count = openCounts.get(item.text) ?? 0;
      const isOpener = count % 2 === 0;
      openCounts.set(item.text, count + 1);

      const pos = isOpener ? item.from : item.to;
      const side = isOpener ? -1 : 1;
      const cls = classifyGhostSyntax(item.text);

      pending.push({
        pos,
        side,
        deco: Decoration.widget({
          widget: new GhostSyntaxWidget(item.text, cls, isOpener),
          side,
        }),
      });
    }

    if (pending.length === 0) {
      cache.set(view, { sig, decos: Decoration.none });
      return Decoration.none;
    }

    pending.sort((a, b) => a.pos - b.pos || a.side - b.side);

    const builder = new RangeSetBuilder<Decoration>();
    for (const entry of pending) {
      builder.add(entry.pos, entry.pos, entry.deco);
    }
    const decos = builder.finish();
    cache.set(view, { sig, decos });
    return decos;
  };

  // Run at lowest precedence inside CM6's Phase 2 decoration collection (after all
  // ViewPlugins including Obsidian Live Preview have finished updating, before DOM paint!)
  return Prec.lowest(EditorView.decorations.of(buildForView));
}

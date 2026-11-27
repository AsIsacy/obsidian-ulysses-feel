import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { UlyssesCoreConfig } from "./types.js";

/**
 * Pure CodeMirror 6 base theme so @writer/cm6-ulysses-core works out-of-the-box
 * in standalone web/Tauri/Electron apps as well as Obsidian.
 */
export function ulyssesBaseTheme(config: UlyssesCoreConfig): Extension {
  return EditorView.baseTheme({
    // Ensure scrollDOM is a positioning context for the baseline highlight pill
    ".cm-scroller": {
      position: "relative",
    },

    // Overscroll padding placed synchronously on Frame 0 via EditorView.editorAttributes:
    // - Obsidian: targets `> .cm-scroller > .cm-sizer` (ABOVE Properties & inline-title,
    //   so Properties and body stay attached while blank sheets start at the upper 1/3!)
    // - Standalone CM6: targets `> .cm-scroller > .cm-content`.
    // Direct-child combinators + isNestedSubEditor guarantee nested table cells NEVER receive padding.
    "&.ul-typewriter-overscroll-top > .cm-scroller > .cm-sizer, &.ul-typewriter-overscroll-top > .cm-scroller > .cm-content": {
      paddingTop: "var(--ul-overscroll-top, 33.3vh) !important",
    },
    "&.ul-typewriter-overscroll-bottom > .cm-scroller > .cm-sizer, &.ul-typewriter-overscroll-bottom > .cm-scroller > .cm-content": {
      paddingBottom: "var(--ul-overscroll-bottom, 55vh) !important",
    },

    // Ulysses ULTextHighlightView: slim capsule rule beneath active line baseline
    ".ul-baseline-highlight": {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none",
      zIndex: "0",
      backgroundColor: "currentColor",
      opacity: "0",
      transition: "opacity 160ms ease-out",
      willChange: "transform, opacity",
    },
    ".ul-baseline-highlight.ul-baseline-highlight-visible": {
      opacity: "var(--ul-hl-light-alpha, 0.15)",
    },
    ".ul-baseline-highlight.ul-baseline-dark.ul-baseline-highlight-visible": {
      opacity: "var(--ul-hl-dark-alpha, 0.20)",
    },

    // Ulysses ULFocusModeRenderingModifier: 0.20 opacity + subtle desaturation
    ".ul-focus-dimmed": {
      opacity: "var(--ul-focus-dim-opacity, 0.20)",
      transition: "opacity 140ms ease-out",
    },
    "&.ul-focus-desaturate .ul-focus-dimmed": {
      filter: "saturate(0.25)",
    },

    // Ulysses Hanging Outdent (ULLayoutManager outdentTags)
    "&.ul-outdent-enabled .cm-line.ul-outdent-live-prefix": {
      textIndent: "var(--ul-line-outdent, 0)",
    },
    "&.ul-outdent-enabled.ul-show-inactive-heading-markers .cm-line.ul-outdent-inactive-heading": {
      position: "relative",
    },
    "&.ul-outdent-enabled.ul-show-inactive-heading-markers .cm-line.ul-outdent-inactive-heading::before": {
      content: "attr(data-ul-heading)",
      position: "absolute",
      right: "calc(100% + 0.4em)",
      fontWeight: "400",
      opacity: "0.42",
      pointerEvents: "none",
      userSelect: "none",
      whiteSpace: "pre",
    },

    // Three-channel syntax muting (atoms stay visible yet calm)
    "&.ul-muted-syntax .cm-formatting-header, &.ul-muted-syntax .cm-formatting-strong, &.ul-muted-syntax .cm-formatting-em, &.ul-muted-syntax .cm-formatting-code, &.ul-muted-syntax .cm-formatting-quote, &.ul-muted-syntax .cm-formatting-strikethrough, &.ul-muted-syntax .cm-formatting-highlight, .ul-ghost-syntax": {
      opacity: "0.48",
      fontWeight: "400",
    },
    ".ul-ghost-syntax": {
      userSelect: "none",
      padding: "0",
    },
    ".ul-ghost-syntax.ul-ghost-code": {
      fontFamily: "var(--font-monospace, ui-monospace, SFMono-Regular, Menlo, monospace)",
      fontSize: "var(--code-size, 0.875em)",
    },

    // Standalone typography defaults (overridable by host app / Obsidian styles.css)
    ...(config.typography.enabled
      ? {
          "&.ul-standalone-typography .cm-content": {
            maxWidth: `${config.typography.measureCh}ch`,
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: String(config.typography.proseLineHeight),
            paddingLeft: `${config.hangingOutdent.outdentWidthCh}ch`,
          },
        }
      : {}),
  });
}

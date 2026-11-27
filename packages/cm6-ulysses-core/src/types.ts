export type TypewriterScrollMode = "off" | "variable" | "top" | "middle" | "bottom";
export type FocusModeKind = "off" | "line" | "sentence" | "paragraph";

export interface TypewriterConfig {
  enabled: boolean;
  mode: TypewriterScrollMode;
  /** Variable mode comfort band top fraction (default: 0.25) */
  variableBandTop: number;
  /** Variable mode comfort band bottom fraction (default: 0.55 eye-level center) */
  variableBandBottom: number;
  /** Top breathing margin fraction for Variable mode so new sheets start at upper 1/3 (default: 0.33) */
  variableTopMargin: number;
  /** Fixed mode anchor fractions (Ulysses: top=0.3, middle=0.5, bottom=0.7) */
  fixedFractions: {
    top: number;
    middle: number;
    bottom: number;
  };
  /**
   * Perceptual animation duration factor in ms: duration = factor * sqrt(|deltaY|).
   * Directly extracted from Ulysses arm64: 0.015s * sqrt(|deltaY|) = 15ms * sqrt(|deltaY|).
   */
  sqrtDurationFactorMs: number;
  /** Safety cap on huge jumps (e.g. Cmd+End on 50,000px doc) */
  maxDurationMs: number;
  /** Smoothly animate typewriter scrolls */
  animate: boolean;
  /** Add vertical overscroll padding so first/last lines can sit at anchor */
  overscrollPadding: boolean;
  /** In fixed modes (top/middle/bottom), wheel scrolls move caret up/down instead of fighting anchor */
  wheelMovesCaretInFixed: boolean;
}

export interface BaselineHighlightConfig {
  enabled: boolean;
  /** Bar height = fontSize / heightDivisor (Ulysses: 6) */
  heightDivisor: number;
  /** Alpha over light background (Ulysses: 0.15) */
  lightAlpha: number;
  /** Alpha over dark background (Ulysses: 0.20) */
  darkAlpha: number;
  /** Fade out highlight when editor loses focus */
  fadeOnBlur: boolean;
}

export interface FocusModeConfig {
  enabled: boolean;
  mode: FocusModeKind;
  /** Opacity of unfocused text (Ulysses: 0.20) */
  unfocusedOpacity: number;
  /** Slightly desaturate unfocused text */
  desaturate: boolean;
  /** Optional BCP-47 locale for Intl.Segmenter sentence segmentation */
  locale?: string;
}

export interface GhostAutoPairConfig {
  enabled: boolean;
  /** [open, close] pairs; multi-char pairs may share a prefix with 1-char pairs (e.g. * and **) */
  pairs: ReadonlyArray<readonly [string, string]>;
  /** Insert isolateHistory.of("before") so single Cmd+Z undoes only the auto-inserted closing delimiter */
  isolateUndo: boolean;
  /** Wrap non-empty selection when typing an opening delimiter */
  wrapSelection: boolean;
}

export interface SmartEditingConfig {
  enabled: boolean;
  /** Tab indents paragraph/list in prose anywhere on line; inserts literal tab inside code blocks */
  contextAwareTab: boolean;
  /** Continue bullets, numbered lists, task lists, blockquotes on Enter; exit on empty item */
  smartListContinuation: boolean;
  /** Renumber subsequent sibling ordered list items after insert/exit */
  autoRenumberOrderedLists: boolean;
  /** Home / Cmd+Left toggles between content start (after #, -, >, 1.) and column 0 */
  smartHome: boolean;
  /** Prevent OS smart quotes/dashes inside code blocks and partial markdown triggers (----, '', ++) */
  protectPotentialMarkup: boolean;
  /** Spaces or tab string for indentation */
  indentUnit: string;
}

export interface HangingOutdentConfig {
  enabled: boolean;
  /** Left margin reserve in ch units (Ulysses: 8 * nWidth) */
  outdentWidthCh: number;
  /** Show subtle muted heading markers in left margin for inactive lines (useful in Obsidian Live Preview) */
  showInactiveHeadingMarkers: boolean;
  /** Apply three-channel muted styling to markdown syntax atoms */
  mutedSyntax: boolean;
  /**
   * Zero-Jump Live Preview: mirror hidden inline delimiters (`**`, `*`, `_`, `` ` ``, `~~`, `==`)
   * with muted ghost widgets so moving the cursor in/out of formatted text causes 0.0px shift!
   */
  zeroJumpInlineSyntax: boolean;
}

export interface TypographyConfig {
  enabled: boolean;
  /** Line width in ch units (Ulysses default: 64) */
  measureCh: number;
  /** Body prose line-height (Ulysses default: 1.6) */
  proseLineHeight: number;
  /** Code block line-height cap (Ulysses: min(prose, 1.2)) */
  codeLineHeight: number;
  /** Normalize visual x-height across serif/sans/mono fonts */
  normalizeXHeight: boolean;
  /** Inactive split-pane text opacity (Ulysses: 0.33) */
  inactivePaneOpacity: number;
}

export interface UlyssesCoreConfig {
  typewriter: TypewriterConfig;
  baselineHighlight: BaselineHighlightConfig;
  focusMode: FocusModeConfig;
  ghostAutoPair: GhostAutoPairConfig;
  smartEditing: SmartEditingConfig;
  hangingOutdent: HangingOutdentConfig;
  typography: TypographyConfig;
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends ReadonlyArray<unknown>
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export const DEFAULT_GHOST_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["**", "**"],
  ["__", "__"],
  ["==", "=="],
  ["~~", "~~"],
  ["*", "*"],
  ["_", "_"],
  ["`", "`"],
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
  ['"', '"'],
  ["“", "”"],
  ["「", "」"],
  ["（", "）"],
];

export const DEFAULT_ULYSSES_CONFIG: UlyssesCoreConfig = {
  typewriter: {
    enabled: true,
    mode: "variable",
    variableBandTop: 0.25,
    variableBandBottom: 0.55,
    variableTopMargin: 0.33,
    fixedFractions: {
      top: 0.3,
      middle: 0.5,
      bottom: 0.7,
    },
    sqrtDurationFactorMs: 15,
    maxDurationMs: 650,
    animate: true,
    overscrollPadding: true,
    wheelMovesCaretInFixed: true,
  },
  baselineHighlight: {
    enabled: true,
    heightDivisor: 6,
    lightAlpha: 0.15,
    darkAlpha: 0.2,
    fadeOnBlur: true,
  },
  focusMode: {
    enabled: false,
    mode: "off",
    unfocusedOpacity: 0.2,
    desaturate: true,
  },
  ghostAutoPair: {
    enabled: true,
    pairs: DEFAULT_GHOST_PAIRS,
    isolateUndo: true,
    wrapSelection: true,
  },
  smartEditing: {
    enabled: true,
    contextAwareTab: true,
    smartListContinuation: true,
    autoRenumberOrderedLists: true,
    smartHome: true,
    protectPotentialMarkup: true,
    indentUnit: "\t",
  },
  hangingOutdent: {
    enabled: true,
    outdentWidthCh: 8,
    showInactiveHeadingMarkers: true,
    mutedSyntax: true,
    zeroJumpInlineSyntax: true,
  },
  typography: {
    enabled: true,
    measureCh: 64,
    proseLineHeight: 1.6,
    codeLineHeight: 1.2,
    normalizeXHeight: true,
    inactivePaneOpacity: 0.33,
  },
};

export function mergeUlyssesConfig(
  partial?: DeepPartial<UlyssesCoreConfig>,
): UlyssesCoreConfig {
  if (!partial) return structuredClone(DEFAULT_ULYSSES_CONFIG);
  return {
    typewriter: {
      ...DEFAULT_ULYSSES_CONFIG.typewriter,
      ...partial.typewriter,
      fixedFractions: {
        ...DEFAULT_ULYSSES_CONFIG.typewriter.fixedFractions,
        ...partial.typewriter?.fixedFractions,
      },
    },
    baselineHighlight: {
      ...DEFAULT_ULYSSES_CONFIG.baselineHighlight,
      ...partial.baselineHighlight,
    },
    focusMode: {
      ...DEFAULT_ULYSSES_CONFIG.focusMode,
      ...partial.focusMode,
    },
    ghostAutoPair: {
      ...DEFAULT_ULYSSES_CONFIG.ghostAutoPair,
      ...partial.ghostAutoPair,
    },
    smartEditing: {
      ...DEFAULT_ULYSSES_CONFIG.smartEditing,
      ...partial.smartEditing,
    },
    hangingOutdent: {
      ...DEFAULT_ULYSSES_CONFIG.hangingOutdent,
      ...partial.hangingOutdent,
    },
    typography: {
      ...DEFAULT_ULYSSES_CONFIG.typography,
      ...partial.typography,
    },
  };
}

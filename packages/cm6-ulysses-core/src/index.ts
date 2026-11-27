import { Compartment, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  DEFAULT_GHOST_PAIRS,
  DEFAULT_ULYSSES_CONFIG,
  DeepPartial,
  UlyssesCoreConfig,
  mergeUlyssesConfig,
} from "./types.js";
import { typewriterExtension } from "./typewriter.js";
import { baselineHighlightExtension } from "./baseline-highlight.js";
import { focusModeExtension } from "./focus-mode.js";
import { ghostAutoPairExtension } from "./ghost-autopair.js";
import { smartEditingExtension } from "./smart-editing.js";
import { hangingOutdentExtension } from "./hanging-outdent.js";
import { zeroJumpInlineSyntaxExtension } from "./zero-jump-syntax.js";
import { ulyssesBaseTheme } from "./styles.js";

export * from "./types.js";
export * from "./dom-guards.js";
export * from "./typewriter.js";
export * from "./baseline-highlight.js";
export * from "./focus-mode.js";
export * from "./ghost-autopair.js";
export * from "./smart-editing.js";
export * from "./hanging-outdent.js";
export * from "./zero-jump-syntax.js";
export * from "./sheet-title.js";
export * from "./styles.js";

export interface UlyssesExtensionBundle {
  /** Static CM6 extension to register once (e.g. via Obsidian registerEditorExtension) */
  extension: Extension;
  /** The backing Compartment for live hot-reconfiguration */
  compartment: Compartment;
  /** Build a reconfiguration StateEffect for any EditorView */
  reconfigureEffect: (next: DeepPartial<UlyssesCoreConfig>) => ReturnType<Compartment["reconfigure"]>;
  /** Hot-reconfigure a specific EditorView in place without recreating it */
  reconfigureView: (view: EditorView, next: DeepPartial<UlyssesCoreConfig>) => void;
  /** Read current merged config */
  getConfig: () => UlyssesCoreConfig;
}

/**
 * Build the flat CM6 Extension array for a concrete UlyssesCoreConfig.
 */
export function buildUlyssesExtensions(config: UlyssesCoreConfig): Extension {
  return [
    ulyssesBaseTheme(config),
    typewriterExtension(config.typewriter),
    baselineHighlightExtension(config.baselineHighlight),
    focusModeExtension(config.focusMode),
    ghostAutoPairExtension(config.ghostAutoPair),
    smartEditingExtension(config.smartEditing),
    hangingOutdentExtension(config.hangingOutdent),
    zeroJumpInlineSyntaxExtension(config.hangingOutdent),
  ];
}

/**
 * Create a self-contained, hot-reconfigurable Ulysses CodeMirror 6 extension bundle.
 * Zero framework or Obsidian dependencies — drop into Obsidian, Tauri, Electron, or Web CM6.
 */
export function createUlyssesExtension(
  initial?: DeepPartial<UlyssesCoreConfig>,
): UlyssesExtensionBundle {
  const compartment = new Compartment();
  let currentConfig = mergeUlyssesConfig(initial);

  return {
    extension: compartment.of(buildUlyssesExtensions(currentConfig)),
    compartment,
    reconfigureEffect(next) {
      currentConfig = mergeUlyssesConfig({
        ...currentConfig,
        ...next,
        typewriter: { ...currentConfig.typewriter, ...next.typewriter },
        baselineHighlight: {
          ...currentConfig.baselineHighlight,
          ...next.baselineHighlight,
        },
        focusMode: { ...currentConfig.focusMode, ...next.focusMode },
        ghostAutoPair: { ...currentConfig.ghostAutoPair, ...next.ghostAutoPair },
        smartEditing: { ...currentConfig.smartEditing, ...next.smartEditing },
        hangingOutdent: { ...currentConfig.hangingOutdent, ...next.hangingOutdent },
        typography: { ...currentConfig.typography, ...next.typography },
      });
      return compartment.reconfigure(buildUlyssesExtensions(currentConfig));
    },
    reconfigureView(view, next) {
      view.dispatch({ effects: this.reconfigureEffect(next) });
    },
    getConfig() {
      return currentConfig;
    },
  };
}

export { DEFAULT_GHOST_PAIRS, DEFAULT_ULYSSES_CONFIG, mergeUlyssesConfig };

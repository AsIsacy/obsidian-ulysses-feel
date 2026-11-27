import { App, PluginSettingTab, Setting } from "obsidian";
import type {
  FocusModeKind,
  TypewriterScrollMode,
} from "@writer/cm6-ulysses-core";
import type UlyssesFeelPlugin from "./main.js";

export interface UlyssesFeelSettings {
  // Typewriter scrolling
  typewriterEnabled: boolean;
  typewriterMode: TypewriterScrollMode;
  typewriterBandTop: number;
  typewriterBandBottom: number;
  typewriterVariableTopMargin: number;
  typewriterAnimate: boolean;
  typewriterSqrtFactorMs: number;
  typewriterOverscrollPadding: boolean;
  typewriterWheelMovesCaretInFixed: boolean;

  // Baseline capsule highlight (ULTextHighlightView)
  baselineHighlightEnabled: boolean;

  // Focus mode (ULFocusModeRenderingModifier)
  focusMode: FocusModeKind;
  focusUnfocusedOpacity: number;
  focusDesaturate: boolean;

  // Ghost Auto-Pairing (ULTextActor)
  ghostAutoPairEnabled: boolean;
  ghostIsolateUndo: boolean;

  // Smart Keyboard Ergonomics
  contextAwareTab: boolean;
  smartListContinuation: boolean;
  autoRenumberOrderedLists: boolean;
  smartHome: boolean;
  protectPotentialMarkup: boolean;

  // Hanging Outdent & Optical Typography
  hangingOutdentEnabled: boolean;
  outdentWidthCh: number;
  showInactiveHeadingMarkers: boolean;
  mutedSyntax: boolean;
  zeroJumpInlineSyntax: boolean;

  typographyEnabled: boolean;
  measureCh: number;
  proseLineHeight: number;
  codeLineHeight: number;
  normalizeXHeight: boolean;
  ulyssesHeadingScale: boolean;
  cjkOpticalSpacing: boolean;
  dimInactivePanes: boolean;
  inactivePaneOpacity: number;

  // Standalone Ulysses Canvas (Zero-dependency Chrome & Scrollbar Hygiene)
  hideInlineTitle: boolean;
  hideScrollbars: boolean;
  distractionFreeCanvas: boolean;

  // Titleless Sheets & Sheet List (Ulysses Sheet workflow)
  autoTitleUntitledSheets: boolean;
  autoTitleDebounceMs: number;
  autoTitleMaxLength: number;
  sheetListPreviewLines: number;

  // UI
  showStatusBar: boolean;
}

export const DEFAULT_SETTINGS: UlyssesFeelSettings = {
  typewriterEnabled: true,
  typewriterMode: "variable",
  typewriterBandTop: 0.25,
  typewriterBandBottom: 0.55,
  typewriterVariableTopMargin: 0.33,
  typewriterAnimate: true,
  typewriterSqrtFactorMs: 15,
  typewriterOverscrollPadding: true,
  typewriterWheelMovesCaretInFixed: true,

  baselineHighlightEnabled: true,

  focusMode: "off",
  focusUnfocusedOpacity: 0.2,
  focusDesaturate: true,

  ghostAutoPairEnabled: true,
  ghostIsolateUndo: true,

  contextAwareTab: true,
  smartListContinuation: true,
  autoRenumberOrderedLists: true,
  smartHome: true,
  protectPotentialMarkup: true,

  hangingOutdentEnabled: true,
  outdentWidthCh: 8,
  showInactiveHeadingMarkers: true,
  mutedSyntax: true,
  zeroJumpInlineSyntax: true,

  typographyEnabled: true,
  measureCh: 64,
  proseLineHeight: 1.6,
  codeLineHeight: 1.2,
  normalizeXHeight: true,
  ulyssesHeadingScale: true,
  cjkOpticalSpacing: true,
  dimInactivePanes: true,
  inactivePaneOpacity: 0.33,

  hideInlineTitle: true,
  hideScrollbars: true,
  distractionFreeCanvas: false,

  autoTitleUntitledSheets: true,
  autoTitleDebounceMs: 2000,
  autoTitleMaxLength: 42,
  sheetListPreviewLines: 2,

  showStatusBar: true,
};

export class UlyssesFeelSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly ulyssesPlugin: UlyssesFeelPlugin,
  ) {
    super(app, ulyssesPlugin);
  }

  override display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Ulysses Feel" });
    containerEl.createEl("p", {
      text: "Non-invasive Ulysses typing ergonomics powered by portable CodeMirror 6 extensions.",
      cls: "setting-item-description",
    });

    // Non-invasive conflict notice if another typewriter plugin is active
    const enabledPlugins: Set<string> | undefined = (
      this.app as unknown as { plugins?: { enabledPlugins?: Set<string> } }
    ).plugins?.enabledPlugins;

    if (enabledPlugins?.has("typewriter-mode") && this.ulyssesPlugin.settings.typewriterEnabled) {
      const warn = containerEl.createDiv({ cls: "ul-settings-notice" });
      warn.setText(
        "Detected community plugin 'typewriter-mode' is also enabled. To prevent two typewriter scrollers from competing, consider disabling one of them.",
      );
    }

    // Non-invasive notice if Obsidian's native auto-pairing is still enabled alongside Ghost Auto-Pair
    const vaultWithConfig = this.app.vault as unknown as {
      getConfig?: (key: string) => unknown;
      setConfig?: (key: string, val: unknown) => void;
    };
    const nativePairMd = vaultWithConfig.getConfig?.("autoPairMarkdown") !== false;
    const nativePairBrackets = vaultWithConfig.getConfig?.("autoPairBrackets") !== false;
    if (
      this.ulyssesPlugin.settings.ghostAutoPairEnabled &&
      (nativePairMd || nativePairBrackets)
    ) {
      const notice = containerEl.createDiv({ cls: "ul-settings-notice ul-settings-notice-action" });
      const msg = notice.createSpan();
      msg.setText(
        "Obsidian's built-in Auto-Pair Markdown/Brackets is currently on. Turn it off so 1× Cmd+Z undoes only the closing delimiter cleanly.",
      );
      if (typeof vaultWithConfig.setConfig === "function") {
        const btn = notice.createEl("button", {
          text: "Disable Obsidian Native Auto-Pair",
          cls: "mod-cta ul-settings-notice-btn",
        });
        btn.addEventListener("click", () => {
          vaultWithConfig.setConfig?.("autoPairMarkdown", false);
          vaultWithConfig.setConfig?.("autoPairBrackets", false);
          this.display();
        });
      }
    }

    // --- Section 1: Typewriter Scrolling ---
    containerEl.createEl("h3", { text: "Typewriter Scrolling & Baseline Indicator" });

    new Setting(containerEl)
      .setName("Enable Typewriter Scrolling")
      .setDesc("Ulysses perceptual scroll: duration = 15ms × √|Δy| with EaseInEaseOut.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typewriterEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.typewriterEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Scroll Anchor Mode")
      .setDesc(
        "Variable starts at upper 1/3 and holds typing inside your eye-level comfort band (default 25%–55%); Top/Middle/Bottom lock strictly to 30%/50%/70%.",
      )
      .addDropdown((d) =>
        d
          .addOption("variable", "Variable (Upper 1/3 → Eye-level Center)")
          .addOption("middle", "Fixed Middle (Strict 50% Lock)")
          .addOption("top", "Fixed Top (30%)")
          .addOption("bottom", "Fixed Bottom (70%)")
          .addOption("off", "Off")
          .setValue(this.ulyssesPlugin.settings.typewriterMode)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterMode = v as TypewriterScrollMode;
            await this.ulyssesPlugin.saveAndApply();
            this.display();
          }),
      );

    if (this.ulyssesPlugin.settings.typewriterMode === "variable") {
      new Setting(containerEl)
        .setName("First-Line Starting Position (%)")
        .setDesc("Where line 1 sits on a fresh sheet (default: 33% upper third of viewport).")
        .addSlider((s) =>
          s
            .setLimits(5, 50, 1)
            .setValue(Math.round(this.ulyssesPlugin.settings.typewriterVariableTopMargin * 100))
            .setDynamicTooltip()
            .onChange(async (v) => {
              this.ulyssesPlugin.settings.typewriterVariableTopMargin = v / 100;
              await this.ulyssesPlugin.saveAndApply();
            }),
        );

      new Setting(containerEl)
        .setName("Variable Comfort Zone Ceiling (%)")
        .setDesc("Upper trigger line before scrolling down (default: 25%).")
        .addSlider((s) =>
          s
            .setLimits(10, 45, 5)
            .setValue(Math.round(this.ulyssesPlugin.settings.typewriterBandTop * 100))
            .setDynamicTooltip()
            .onChange(async (v) => {
              this.ulyssesPlugin.settings.typewriterBandTop = Math.min(
                v / 100,
                this.ulyssesPlugin.settings.typewriterBandBottom - 0.05,
              );
              await this.ulyssesPlugin.saveAndApply();
            }),
        );

      new Setting(containerEl)
        .setName("Variable Comfort Zone Floor (%)")
        .setDesc("Lowest vertical position before smoothly scrolling upward (default: 55% eye-level center, neck-friendly).")
        .addSlider((s) =>
          s
            .setLimits(45, 85, 5)
            .setValue(Math.round(this.ulyssesPlugin.settings.typewriterBandBottom * 100))
            .setDynamicTooltip()
            .onChange(async (v) => {
              this.ulyssesPlugin.settings.typewriterBandBottom = Math.max(
                v / 100,
                this.ulyssesPlugin.settings.typewriterBandTop + 0.05,
              );
              await this.ulyssesPlugin.saveAndApply();
            }),
        );
    }

    new Setting(containerEl)
      .setName("Smooth Perceptual Animation")
      .setDesc("Animate scroll position with backing-pixel snapping.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typewriterAnimate).onChange(async (v) => {
          this.ulyssesPlugin.settings.typewriterAnimate = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Overscroll Top & Bottom Padding")
      .setDesc("Allow the very first and last lines of a note to rest at the focal anchor.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typewriterOverscrollPadding).onChange(async (v) => {
          this.ulyssesPlugin.settings.typewriterOverscrollPadding = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Wheel Moves Caret in Fixed Modes")
      .setDesc("In Top/Middle/Bottom modes, scrolling moves caret line-by-line without fighting the lock.")
      .addToggle((t) =>
        t
          .setValue(this.ulyssesPlugin.settings.typewriterWheelMovesCaretInFixed)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterWheelMovesCaretInFixed = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Slim Capsule Baseline Highlight")
      .setDesc("Draw Ulysses's fontSize/6 pill bar beneath the active line instead of shading the full line.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.baselineHighlightEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.baselineHighlightEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    // --- Section 2: Focus Mode ---
    containerEl.createEl("h3", { text: "Focus Mode" });

    new Setting(containerEl)
      .setName("Focus Granularity")
      .setDesc("Dim unfocused text to 20% opacity (Line, Sentence via Intl.Segmenter, or Paragraph).")
      .addDropdown((d) =>
        d
          .addOption("off", "Off")
          .addOption("line", "Line")
          .addOption("sentence", "Sentence")
          .addOption("paragraph", "Paragraph")
          .setValue(this.ulyssesPlugin.settings.focusMode)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.focusMode = v as FocusModeKind;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Unfocused Opacity")
      .setDesc("Ulysses default is 0.20.")
      .addSlider((s) =>
        s
          .setLimits(0.1, 0.6, 0.05)
          .setValue(this.ulyssesPlugin.settings.focusUnfocusedOpacity)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.focusUnfocusedOpacity = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 3: Ghost Auto-Pairing & Smart Editing ---
    containerEl.createEl("h3", { text: "Ghost Auto-Pairing & Keyboard Ergonomics" });

    new Setting(containerEl)
      .setName("Ghost Auto-Pairing")
      .setDesc(
        "Auto-pair **, _, `, ==, ~~, brackets & quotes with overtype-collapse, paired backspace, and 1x Cmd+Z undo of closing tag. (Tip: turn off Obsidian's built-in 'Auto pair Markdown syntax' to avoid double pairing.)",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.ghostAutoPairEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.ghostAutoPairEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Context-Aware Tab / Shift+Tab")
      .setDesc("Indent/outdent whole paragraph or list from any cursor column in prose; insert literal Tab inside code blocks.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.contextAwareTab).onChange(async (v) => {
          this.ulyssesPlugin.settings.contextAwareTab = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Smart List Continuation & Auto-Renumbering")
      .setDesc("Continue bullets/tasks/numbers/quotes on Enter, exit on empty item, and renumber following ordered items automatically.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.smartListContinuation).onChange(async (v) => {
          this.ulyssesPlugin.settings.smartListContinuation = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Smart Home (Home / Cmd+Left)")
      .setDesc("Toggle between start of content (after #, -, 1., >) and column 0.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.smartHome).onChange(async (v) => {
          this.ulyssesPlugin.settings.smartHome = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Protect Markup From OS Smart Punctuation")
      .setDesc("Prevent macOS smart dash/quote substitution inside code blocks or when typing ----, '', ++.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.protectPotentialMarkup).onChange(async (v) => {
          this.ulyssesPlugin.settings.protectPotentialMarkup = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    // --- Section 4: Hanging Outdent & Optical Typography ---
    containerEl.createEl("h3", { text: "Hanging Outdent & Optical Typography" });

    new Setting(containerEl)
      .setName("Hanging Outdent for Headings & Blockquotes")
      .setDesc("Pull active # / > markers into the left margin so heading text stays rock-steady with zero horizontal jump.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.hangingOutdentEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.hangingOutdentEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Show Subtle Heading Markers on Inactive Lines (Live Preview)")
      .setDesc("Display quiet muted #, ##, ### cues in the left margin of inactive Live Preview headings.")
      .addToggle((t) =>
        t
          .setValue(this.ulyssesPlugin.settings.showInactiveHeadingMarkers)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.showInactiveHeadingMarkers = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Zero-Jump Inline Syntax (Live Preview)")
      .setDesc(
        "Keep muted ghost syntax markers (**, *, _, `, ~~, ==) visible when Live Preview hides them, preventing horizontal line jitter and word-wrap reflow on cursor movement.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.zeroJumpInlineSyntax).onChange(async (v) => {
          this.ulyssesPlugin.settings.zeroJumpInlineSyntax = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Three-Channel Muted Syntax Tokens")
      .setDesc("Keep Markdown formatting tokens calm and low-contrast while body text stays crisp.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.mutedSyntax).onChange(async (v) => {
          this.ulyssesPlugin.settings.mutedSyntax = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Optical Typography Overrides")
      .setDesc("64ch reading measure, 1.6 prose line-height, 1.2 code-block line-height cap, inverse heading leading, and x-height normalization.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typographyEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.typographyEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Reading Measure (characters per line)")
      .setDesc("Ulysses default: 64ch.")
      .addSlider((s) =>
        s
          .setLimits(48, 84, 2)
          .setValue(this.ulyssesPlugin.settings.measureCh)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.measureCh = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Restrained Ulysses Heading Scale")
      .setDesc(
        "Use Ulysses's refined H1–H6 scale (1.35em → 0.96em) so headings stay balanced even on Obsidian's Default Theme.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.ulyssesHeadingScale).onChange(async (v) => {
          this.ulyssesPlugin.settings.ulyssesHeadingScale = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("CJK / Mixed-Script Optical Spacing")
      .setDesc(
        "Enable CSS text-autospace and subtle 0.025em tracking for crisp CJK + Latin typography without external snippets.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.cjkOpticalSpacing).onChange(async (v) => {
          this.ulyssesPlugin.settings.cjkOpticalSpacing = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Dim Inactive Split Panes")
      .setDesc("Dim unfocused split editors to 33% opacity (Ulysses ULDesaturatedTextRenderingModifier).")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.dimInactivePanes).onChange(async (v) => {
          this.ulyssesPlugin.settings.dimInactivePanes = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    // --- Section 5: Standalone Ulysses Canvas (Zero-Dependency Chrome) ---
    containerEl.createEl("h3", { text: "Standalone Ulysses Canvas" });

    new Setting(containerEl)
      .setName("Hide Inline Filename Title")
      .setDesc(
        "Hide Obsidian's inline filename header inside notes via scoped CSS for pure titleless writing (automatically restored if plugin is disabled).",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.hideInlineTitle).onChange(async (v) => {
          this.ulyssesPlugin.settings.hideInlineTitle = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Hide Editor Scrollbars")
      .setDesc("Keep a clean paper-like writing canvas without needing the Hider plugin.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.hideScrollbars).onChange(async (v) => {
          this.ulyssesPlugin.settings.hideScrollbars = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Distraction-Free Canvas (Minimal Chrome)")
      .setDesc(
        "Hide tab bar, view header breadcrumb, and status bar (hover top edge to reveal). Toggle anytime via Command Palette.",
      )
      .addToggle((t) =>
        t
          .setValue(this.ulyssesPlugin.settings.distractionFreeCanvas)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.distractionFreeCanvas = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 6: Titleless Sheets & Sheet List ---
    containerEl.createEl("h3", { text: "Titleless Sheets & Ulysses Sheet List" });

    new Setting(containerEl)
      .setName("Auto-Name New / Untitled Sheets From First Line")
      .setDesc(
        "Silently rename newly created or untitled notes ('未命名', 'Untitled', 'UL-...') using their first non-empty body line. Existing user-named notes and daily notes are never touched.",
      )
      .addToggle((t) =>
        t
          .setValue(this.ulyssesPlugin.settings.autoTitleUntitledSheets)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.autoTitleUntitledSheets = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Auto-Rename Delay (iCloud Safe Debounce)")
      .setDesc(
        "Wait this many milliseconds after typing stops (or immediately on switching notes) before renaming on disk.",
      )
      .addSlider((s) =>
        s
          .setLimits(800, 5000, 200)
          .setValue(this.ulyssesPlugin.settings.autoTitleDebounceMs)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.autoTitleDebounceMs = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Maximum Auto-Generated Filename Length")
      .setDesc("Long first lines are cleanly truncated to this character limit.")
      .addSlider((s) =>
        s
          .setLimits(20, 80, 2)
          .setValue(this.ulyssesPlugin.settings.autoTitleMaxLength)
          .setDynamicTooltip()
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.autoTitleMaxLength = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Sheet List Preview Lines")
      .setDesc("Number of excerpt lines shown below the first-line title in the Ulysses Sheet List sidebar.")
      .addDropdown((d) =>
        d
          .addOption("1", "1 line")
          .addOption("2", "2 lines (Ulysses default)")
          .addOption("3", "3 lines")
          .setValue(String(this.ulyssesPlugin.settings.sheetListPreviewLines))
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.sheetListPreviewLines = parseInt(v, 10) || 2;
            await this.ulyssesPlugin.saveAndApply();
            this.ulyssesPlugin.refreshSheetLists();
          }),
      );

    new Setting(containerEl)
      .setName("Show Status Bar Indicator")
      .setDesc("Quick-toggle typewriter & focus modes from the status bar.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.showStatusBar).onChange(async (v) => {
          this.ulyssesPlugin.settings.showStatusBar = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );
  }
}

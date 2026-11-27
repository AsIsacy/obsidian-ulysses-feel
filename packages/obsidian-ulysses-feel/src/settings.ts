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

    // --- Section 1: Typewriter scrolling & baseline indicator ---
    new Setting(containerEl)
      .setName("Typewriter scrolling and baseline indicator")
      .setHeading();

    new Setting(containerEl)
      .setName("Enable typewriter scrolling")
      .setDesc("Ulysses perceptual scroll: duration = 15ms × √|Δy| with EaseInEaseOut.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typewriterEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.typewriterEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
          this.display();
        }),
      );

    new Setting(containerEl)
      .setName("Scroll anchor mode")
      .setDesc(
        "Variable starts at upper 1/3 and holds typing inside your eye-level comfort band (default 25%–55%); Top, Middle, and Bottom lock strictly to 30%, 50%, and 70%.",
      )
      .addDropdown((d) =>
        d
          .addOption("variable", "Variable (upper 1/3 to eye-level center)")
          .addOption("middle", "Fixed middle (strict 50% lock)")
          .addOption("top", "Fixed top (30%)")
          .addOption("bottom", "Fixed bottom (70%)")
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
        .setName("First-line starting position (%)")
        .setDesc("Where line 1 sits on a fresh sheet (default: 33% upper third of viewport).")
        .addSlider((s) =>
          s
            .setLimits(5, 50, 1)
            .setValue(Math.round(this.ulyssesPlugin.settings.typewriterVariableTopMargin * 100))
            .onChange(async (v) => {
              this.ulyssesPlugin.settings.typewriterVariableTopMargin = v / 100;
              await this.ulyssesPlugin.saveAndApply();
            }),
        );

      new Setting(containerEl)
        .setName("Variable comfort zone ceiling (%)")
        .setDesc("Upper trigger line before scrolling down (default: 25%).")
        .addSlider((s) =>
          s
            .setLimits(10, 45, 5)
            .setValue(Math.round(this.ulyssesPlugin.settings.typewriterBandTop * 100))
            .onChange(async (v) => {
              this.ulyssesPlugin.settings.typewriterBandTop = Math.min(
                v / 100,
                this.ulyssesPlugin.settings.typewriterBandBottom - 0.05,
              );
              await this.ulyssesPlugin.saveAndApply();
            }),
        );

      new Setting(containerEl)
        .setName("Variable comfort zone floor (%)")
        .setDesc("Lowest vertical position before smoothly scrolling upward (default: 55% eye-level center).")
        .addSlider((s) =>
          s
            .setLimits(45, 85, 5)
            .setValue(Math.round(this.ulyssesPlugin.settings.typewriterBandBottom * 100))
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
      .setName("Smooth perceptual animation")
      .setDesc("Animate scroll position with backing-pixel snapping.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typewriterAnimate).onChange(async (v) => {
          this.ulyssesPlugin.settings.typewriterAnimate = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Overscroll top and bottom padding")
      .setDesc("Allow the very first and last lines of a note to rest at the focal anchor.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typewriterOverscrollPadding).onChange(async (v) => {
          this.ulyssesPlugin.settings.typewriterOverscrollPadding = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Wheel moves caret in fixed modes")
      .setDesc("In Top, Middle, and Bottom modes, scrolling moves the caret line by line without fighting the lock.")
      .addToggle((t) =>
        t
          .setValue(this.ulyssesPlugin.settings.typewriterWheelMovesCaretInFixed)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterWheelMovesCaretInFixed = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Slim capsule baseline highlight")
      .setDesc("Draw Ulysses's fontSize/6 pill bar beneath the active line instead of shading the full line.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.baselineHighlightEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.baselineHighlightEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    // --- Section 2: Focus mode ---
    new Setting(containerEl).setName("Focus mode").setHeading();

    new Setting(containerEl)
      .setName("Focus granularity")
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
      .setName("Unfocused opacity")
      .setDesc("Ulysses default is 0.20.")
      .addSlider((s) =>
        s
          .setLimits(0.1, 0.6, 0.05)
          .setValue(this.ulyssesPlugin.settings.focusUnfocusedOpacity)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.focusUnfocusedOpacity = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 3: Ghost auto-pairing & keyboard ergonomics ---
    new Setting(containerEl)
      .setName("Ghost auto-pairing and keyboard ergonomics")
      .setHeading();

    new Setting(containerEl)
      .setName("Ghost auto-pairing")
      .setDesc(
        "Auto-pair **, _, `, ==, ~~, brackets, and quotes with overtype-collapse, paired backspace, and 1× Cmd+Z undo of the closing delimiter. Tip: disable Editor → Auto pair Markdown syntax and Auto pair brackets for clean single-step undo.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.ghostAutoPairEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.ghostAutoPairEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Context-aware Tab and Shift+Tab")
      .setDesc("Indent or outdent the whole paragraph or list from any cursor column in prose; insert a literal tab inside code blocks.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.contextAwareTab).onChange(async (v) => {
          this.ulyssesPlugin.settings.contextAwareTab = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Smart list continuation and auto-renumbering")
      .setDesc("Continue bullets, tasks, numbers, and quotes on Enter, exit on empty items, and renumber following ordered items automatically.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.smartListContinuation).onChange(async (v) => {
          this.ulyssesPlugin.settings.smartListContinuation = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Smart home (Home / Cmd+Left)")
      .setDesc("Toggle between the start of content (after #, -, 1., >) and column 0.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.smartHome).onChange(async (v) => {
          this.ulyssesPlugin.settings.smartHome = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Protect markup from OS smart punctuation")
      .setDesc("Prevent smart dash or quote substitution inside code blocks or when typing ----, '', or ++.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.protectPotentialMarkup).onChange(async (v) => {
          this.ulyssesPlugin.settings.protectPotentialMarkup = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    // --- Section 4: Hanging outdent & optical typography ---
    new Setting(containerEl)
      .setName("Hanging outdent and optical typography")
      .setHeading();

    new Setting(containerEl)
      .setName("Hanging outdent for headings and blockquotes")
      .setDesc("Pull active # and > markers into the left margin so heading text stays steady with zero horizontal jump.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.hangingOutdentEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.hangingOutdentEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Show subtle heading markers on inactive lines (Live Preview)")
      .setDesc("Display quiet muted #, ##, and ### cues in the left margin of inactive Live Preview headings.")
      .addToggle((t) =>
        t
          .setValue(this.ulyssesPlugin.settings.showInactiveHeadingMarkers)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.showInactiveHeadingMarkers = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Zero-jump inline syntax (Live Preview)")
      .setDesc(
        "Keep muted ghost syntax markers (**, *, _, `, ~~, ==) visible when Live Preview hides them, preventing horizontal line jitter and word-wrap reflow.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.zeroJumpInlineSyntax).onChange(async (v) => {
          this.ulyssesPlugin.settings.zeroJumpInlineSyntax = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Three-channel muted syntax tokens")
      .setDesc("Keep Markdown formatting tokens calm and low-contrast while body text stays crisp.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.mutedSyntax).onChange(async (v) => {
          this.ulyssesPlugin.settings.mutedSyntax = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Optical typography overrides")
      .setDesc("64ch reading measure, 1.6 prose line-height, 1.2 code-block line-height cap, inverse heading leading, and x-height normalization.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.typographyEnabled).onChange(async (v) => {
          this.ulyssesPlugin.settings.typographyEnabled = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Reading measure (characters per line)")
      .setDesc("Ulysses default: 64.")
      .addSlider((s) =>
        s
          .setLimits(48, 84, 2)
          .setValue(this.ulyssesPlugin.settings.measureCh)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.measureCh = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Restrained Ulysses heading scale")
      .setDesc(
        "Use Ulysses's refined H1–H6 scale (1.35em to 0.96em) so headings stay balanced across themes.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.ulyssesHeadingScale).onChange(async (v) => {
          this.ulyssesPlugin.settings.ulyssesHeadingScale = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("CJK and mixed-script optical spacing")
      .setDesc(
        "Enable CSS text-autospace and subtle 0.025em tracking for crisp CJK and Latin typography.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.cjkOpticalSpacing).onChange(async (v) => {
          this.ulyssesPlugin.settings.cjkOpticalSpacing = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Dim inactive split panes")
      .setDesc("Dim unfocused split editors to 33% opacity.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.dimInactivePanes).onChange(async (v) => {
          this.ulyssesPlugin.settings.dimInactivePanes = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    // --- Section 5: Standalone Ulysses canvas ---
    new Setting(containerEl).setName("Standalone canvas").setHeading();

    new Setting(containerEl)
      .setName("Hide inline filename title")
      .setDesc(
        "Hide the inline filename header inside notes via scoped CSS for pure titleless writing.",
      )
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.hideInlineTitle).onChange(async (v) => {
          this.ulyssesPlugin.settings.hideInlineTitle = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Hide editor scrollbars")
      .setDesc("Keep a clean paper-like writing canvas without scrollbars.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.hideScrollbars).onChange(async (v) => {
          this.ulyssesPlugin.settings.hideScrollbars = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName("Distraction-free canvas")
      .setDesc(
        "Hide the tab bar, view header breadcrumb, and status bar (hover top edge to reveal).",
      )
      .addToggle((t) =>
        t
          .setValue(this.ulyssesPlugin.settings.distractionFreeCanvas)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.distractionFreeCanvas = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 6: Titleless sheets & sheet list ---
    new Setting(containerEl)
      .setName("Titleless sheets and sheet list")
      .setHeading();

    new Setting(containerEl)
      .setName("Auto-name new or untitled sheets from first line")
      .setDesc(
        "Silently rename newly created or untitled notes using their first non-empty body line. Existing user-named notes and daily notes are never touched.",
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
      .setName("Auto-rename delay (ms)")
      .setDesc(
        "Wait this many milliseconds after typing stops (or immediately on switching notes) before renaming on disk.",
      )
      .addSlider((s) =>
        s
          .setLimits(800, 5000, 200)
          .setValue(this.ulyssesPlugin.settings.autoTitleDebounceMs)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.autoTitleDebounceMs = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Maximum auto-generated filename length")
      .setDesc("Long first lines are cleanly truncated to this character limit.")
      .addSlider((s) =>
        s
          .setLimits(20, 80, 2)
          .setValue(this.ulyssesPlugin.settings.autoTitleMaxLength)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.autoTitleMaxLength = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName("Sheet list preview lines")
      .setDesc("Number of excerpt lines shown below the first-line title in the sheet list sidebar.")
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
      .setName("Show status bar indicator")
      .setDesc("Quick-toggle typewriter and focus modes from the status bar.")
      .addToggle((t) =>
        t.setValue(this.ulyssesPlugin.settings.showStatusBar).onChange(async (v) => {
          this.ulyssesPlugin.settings.showStatusBar = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );
  }
}

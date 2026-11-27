import { App, PluginSettingTab, Setting } from "obsidian";
import type {
  FocusModeKind,
  TypewriterScrollMode,
} from "@writer/cm6-ulysses-core";
import type UlyssesFeelPlugin from "./main.js";
import { t } from "./i18n.js";

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
  hideRibbonWhenCollapsed: boolean;
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
  hideRibbonWhenCollapsed: true,
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
    new Setting(containerEl).setName(t("secTypewriter")).setHeading();

    new Setting(containerEl)
      .setName(t("setTwEnableName"))
      .setDesc(t("setTwEnableDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.typewriterEnabled)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterEnabled = v;
            await this.ulyssesPlugin.saveAndApply();
            this.display();
          }),
      );

    new Setting(containerEl)
      .setName(t("setTwModeName"))
      .setDesc(t("setTwModeDesc"))
      .addDropdown((d) =>
        d
          .addOption("variable", t("optTwVariable"))
          .addOption("middle", t("optTwMiddle"))
          .addOption("top", t("optTwTop"))
          .addOption("bottom", t("optTwBottom"))
          .addOption("off", t("optTwOff"))
          .setValue(this.ulyssesPlugin.settings.typewriterMode)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterMode = v as TypewriterScrollMode;
            await this.ulyssesPlugin.saveAndApply();
            this.display();
          }),
      );

    if (this.ulyssesPlugin.settings.typewriterMode === "variable") {
      new Setting(containerEl)
        .setName(t("setTwTopStartName"))
        .setDesc(t("setTwTopStartDesc"))
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
        .setName(t("setTwBandTopName"))
        .setDesc(t("setTwBandTopDesc"))
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
        .setName(t("setTwBandBottomName"))
        .setDesc(t("setTwBandBottomDesc"))
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
      .setName(t("setTwAnimateName"))
      .setDesc(t("setTwAnimateDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.typewriterAnimate)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterAnimate = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setTwOverscrollName"))
      .setDesc(t("setTwOverscrollDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.typewriterOverscrollPadding)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterOverscrollPadding = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setTwWheelName"))
      .setDesc(t("setTwWheelDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.typewriterWheelMovesCaretInFixed)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typewriterWheelMovesCaretInFixed = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setBaselineName"))
      .setDesc(t("setBaselineDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.baselineHighlightEnabled)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.baselineHighlightEnabled = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 2: Focus mode ---
    new Setting(containerEl).setName(t("secFocus")).setHeading();

    new Setting(containerEl)
      .setName(t("setFocusModeName"))
      .setDesc(t("setFocusModeDesc"))
      .addDropdown((d) =>
        d
          .addOption("off", t("optFocusOff"))
          .addOption("line", t("optFocusLine"))
          .addOption("sentence", t("optFocusSentence"))
          .addOption("paragraph", t("optFocusParagraph"))
          .setValue(this.ulyssesPlugin.settings.focusMode)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.focusMode = v as FocusModeKind;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setFocusOpacityName"))
      .setDesc(t("setFocusOpacityDesc"))
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
    new Setting(containerEl).setName(t("secTyping")).setHeading();

    new Setting(containerEl)
      .setName(t("setGhostPairName"))
      .setDesc(t("setGhostPairDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.ghostAutoPairEnabled)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.ghostAutoPairEnabled = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setContextTabName"))
      .setDesc(t("setContextTabDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.contextAwareTab)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.contextAwareTab = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setSmartListName"))
      .setDesc(t("setSmartListDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.smartListContinuation)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.smartListContinuation = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setSmartHomeName"))
      .setDesc(t("setSmartHomeDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.ulyssesPlugin.settings.smartHome).onChange(async (v) => {
          this.ulyssesPlugin.settings.smartHome = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName(t("setProtectMarkupName"))
      .setDesc(t("setProtectMarkupDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.protectPotentialMarkup)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.protectPotentialMarkup = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 4: Hanging outdent & optical typography ---
    new Setting(containerEl).setName(t("secTypography")).setHeading();

    new Setting(containerEl)
      .setName(t("setOutdentName"))
      .setDesc(t("setOutdentDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.hangingOutdentEnabled)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.hangingOutdentEnabled = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setInactiveMarkersName"))
      .setDesc(t("setInactiveMarkersDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.showInactiveHeadingMarkers)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.showInactiveHeadingMarkers = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setZeroJumpName"))
      .setDesc(t("setZeroJumpDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.zeroJumpInlineSyntax)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.zeroJumpInlineSyntax = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setMutedSyntaxName"))
      .setDesc(t("setMutedSyntaxDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.ulyssesPlugin.settings.mutedSyntax).onChange(async (v) => {
          this.ulyssesPlugin.settings.mutedSyntax = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );

    new Setting(containerEl)
      .setName(t("setTypographyName"))
      .setDesc(t("setTypographyDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.typographyEnabled)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.typographyEnabled = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setMeasureName"))
      .setDesc(t("setMeasureDesc"))
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
      .setName(t("setHeadingScaleName"))
      .setDesc(t("setHeadingScaleDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.ulyssesHeadingScale)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.ulyssesHeadingScale = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setCjkSpacingName"))
      .setDesc(t("setCjkSpacingDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.cjkOpticalSpacing)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.cjkOpticalSpacing = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setDimInactiveName"))
      .setDesc(t("setDimInactiveDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.dimInactivePanes)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.dimInactivePanes = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 5: Standalone canvas ---
    new Setting(containerEl).setName(t("secCanvas")).setHeading();

    new Setting(containerEl)
      .setName(t("setHideInlineTitleName"))
      .setDesc(t("setHideInlineTitleDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.hideInlineTitle)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.hideInlineTitle = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setHideScrollbarsName"))
      .setDesc(t("setHideScrollbarsDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.hideScrollbars)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.hideScrollbars = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setHideCollapsedRibbonName"))
      .setDesc(t("setHideCollapsedRibbonDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.hideRibbonWhenCollapsed)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.hideRibbonWhenCollapsed = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setDistractionFreeName"))
      .setDesc(t("setDistractionFreeDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.distractionFreeCanvas)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.distractionFreeCanvas = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    // --- Section 6: Titleless sheets & sheet list ---
    new Setting(containerEl).setName(t("secTitleless")).setHeading();

    new Setting(containerEl)
      .setName(t("setAutoTitleName"))
      .setDesc(t("setAutoTitleDesc"))
      .addToggle((toggle) =>
        toggle
          .setValue(this.ulyssesPlugin.settings.autoTitleUntitledSheets)
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.autoTitleUntitledSheets = v;
            await this.ulyssesPlugin.saveAndApply();
          }),
      );

    new Setting(containerEl)
      .setName(t("setAutoTitleDelayName"))
      .setDesc(t("setAutoTitleDelayDesc"))
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
      .setName(t("setAutoTitleMaxLenName"))
      .setDesc(t("setAutoTitleMaxLenDesc"))
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
      .setName(t("setPreviewLinesName"))
      .setDesc(t("setPreviewLinesDesc"))
      .addDropdown((d) =>
        d
          .addOption("1", t("optPreview1"))
          .addOption("2", t("optPreview2"))
          .addOption("3", t("optPreview3"))
          .setValue(String(this.ulyssesPlugin.settings.sheetListPreviewLines))
          .onChange(async (v) => {
            this.ulyssesPlugin.settings.sheetListPreviewLines = parseInt(v, 10) || 2;
            await this.ulyssesPlugin.saveAndApply();
            this.ulyssesPlugin.refreshSheetLists();
          }),
      );

    new Setting(containerEl)
      .setName(t("setStatusBarName"))
      .setDesc(t("setStatusBarDesc"))
      .addToggle((toggle) =>
        toggle.setValue(this.ulyssesPlugin.settings.showStatusBar).onChange(async (v) => {
          this.ulyssesPlugin.settings.showStatusBar = v;
          await this.ulyssesPlugin.saveAndApply();
        }),
      );
  }
}

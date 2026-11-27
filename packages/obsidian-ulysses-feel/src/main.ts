import { MarkdownView, Notice, Plugin } from "obsidian";
import type { Extension } from "@codemirror/state";
import {
  DEFAULT_ULYSSES_CONFIG,
  FocusModeKind,
  TypewriterScrollMode,
  UlyssesCoreConfig,
  buildUlyssesExtensions,
} from "@writer/cm6-ulysses-core";
import {
  DEFAULT_SETTINGS,
  UlyssesFeelSettingTab,
  UlyssesFeelSettings,
} from "./settings.js";
import { TitlelessSheetManager } from "./titleless-sheets.js";
import {
  UlyssesSheetListView,
  VIEW_TYPE_ULYSSES_SHEETS,
} from "./sheet-list-view.js";

const TYPEWRITER_CYCLE: TypewriterScrollMode[] = [
  "off",
  "variable",
  "top",
  "middle",
  "bottom",
];

const FOCUS_CYCLE: FocusModeKind[] = ["off", "line", "sentence", "paragraph"];

export default class UlyssesFeelPlugin extends Plugin {
  override settings: UlyssesFeelSettings = { ...DEFAULT_SETTINGS };
  private editorExtensions: Extension[] = [];
  private statusBarEl: HTMLElement | null = null;
  titlelessSheets!: TitlelessSheetManager;

  override async onload(): Promise<void> {
    await this.loadSettings();

    // Official Obsidian standard pattern for dynamic CM6 extensions:
    // Pass a mutable Extension[] array once to registerEditorExtension(),
    // then mutate in place + call app.workspace.updateOptions() on settings changes.
    // Zero private API access, zero monkey-patching!
    this.editorExtensions = [buildUlyssesExtensions(this.toCoreConfig())];
    this.registerEditorExtension(this.editorExtensions);

    // Titleless Sheet manager & Ulysses Sheet List sidebar view
    this.titlelessSheets = new TitlelessSheetManager(this.app, this);
    this.titlelessSheets.register();

    this.registerView(
      VIEW_TYPE_ULYSSES_SHEETS,
      (leaf) => new UlyssesSheetListView(leaf, this),
    );

    this.addRibbonIcon("sheets-in-box", "Open Ulysses Sheet List", () => {
      void this.activateSheetListView();
    });

    this.applyBodyStyling();
    this.setupStatusBar();
    this.registerCommands();
    this.addSettingTab(new UlyssesFeelSettingTab(this.app, this));
  }

  override onunload(): void {
    this.titlelessSheets?.dispose();
    // Strictly remove all body classes and custom CSS variables for 100% clean uninstall
    const cls = activeDocument.body.classList;
    cls.remove(
      "ulysses-feel-enabled",
      "ulysses-feel-typography",
      "ulysses-feel-xheight",
      "ulysses-feel-heading-scale",
      "ulysses-feel-cjk-spacing",
      "ulysses-feel-outdent",
      "ulysses-feel-dim-inactive",
      "ulysses-feel-hide-inline-title",
      "ulysses-feel-hide-scrollbars",
      "ulysses-feel-distraction-free",
    );
    const style = activeDocument.body.style;
    style.removeProperty("--ul-measure-ch");
    style.removeProperty("--ul-prose-line-height");
    style.removeProperty("--ul-code-line-height");
    style.removeProperty("--ul-outdent-width");
    style.removeProperty("--ul-inactive-pane-opacity");
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<UlyssesFeelSettings> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved ?? {});
  }

  async saveAndApply(): Promise<void> {
    await this.saveData(this.settings);
    this.refreshExtensions();
    this.applyBodyStyling();
    this.updateStatusBar();
  }

  async activateSheetListView(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_ULYSSES_SHEETS);
    if (existing.length > 0) {
      await this.app.workspace.revealLeaf(existing[0]!);
      return;
    }

    const leaf = this.app.workspace.getLeftLeaf(false);
    if (!leaf) return;
    await leaf.setViewState({
      type: VIEW_TYPE_ULYSSES_SHEETS,
      active: true,
    });
    await this.app.workspace.revealLeaf(leaf);
  }

  refreshSheetLists(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_ULYSSES_SHEETS)) {
      if (leaf.view instanceof UlyssesSheetListView) {
        leaf.view.refresh();
      }
    }
  }

  private toCoreConfig(): UlyssesCoreConfig {
    const s = this.settings;
    return {
      ...DEFAULT_ULYSSES_CONFIG,
      typewriter: {
        ...DEFAULT_ULYSSES_CONFIG.typewriter,
        enabled: s.typewriterEnabled,
        mode: s.typewriterMode,
        variableBandTop: s.typewriterBandTop,
        variableBandBottom: s.typewriterBandBottom,
        variableTopMargin: s.typewriterVariableTopMargin,
        animate: s.typewriterAnimate,
        sqrtDurationFactorMs: s.typewriterSqrtFactorMs,
        overscrollPadding: s.typewriterOverscrollPadding,
        wheelMovesCaretInFixed: s.typewriterWheelMovesCaretInFixed,
      },
      baselineHighlight: {
        ...DEFAULT_ULYSSES_CONFIG.baselineHighlight,
        enabled: s.baselineHighlightEnabled,
      },
      focusMode: {
        ...DEFAULT_ULYSSES_CONFIG.focusMode,
        enabled: s.focusMode !== "off",
        mode: s.focusMode,
        unfocusedOpacity: s.focusUnfocusedOpacity,
        desaturate: s.focusDesaturate,
      },
      ghostAutoPair: {
        ...DEFAULT_ULYSSES_CONFIG.ghostAutoPair,
        enabled: s.ghostAutoPairEnabled,
        isolateUndo: s.ghostIsolateUndo,
      },
      smartEditing: {
        ...DEFAULT_ULYSSES_CONFIG.smartEditing,
        enabled:
          s.contextAwareTab ||
          s.smartListContinuation ||
          s.smartHome ||
          s.protectPotentialMarkup,
        contextAwareTab: s.contextAwareTab,
        smartListContinuation: s.smartListContinuation,
        autoRenumberOrderedLists: s.autoRenumberOrderedLists,
        smartHome: s.smartHome,
        protectPotentialMarkup: s.protectPotentialMarkup,
      },
      hangingOutdent: {
        ...DEFAULT_ULYSSES_CONFIG.hangingOutdent,
        enabled: s.hangingOutdentEnabled,
        outdentWidthCh: s.outdentWidthCh,
        showInactiveHeadingMarkers: s.showInactiveHeadingMarkers,
        mutedSyntax: s.mutedSyntax,
        zeroJumpInlineSyntax: s.zeroJumpInlineSyntax,
      },
      typography: {
        ...DEFAULT_ULYSSES_CONFIG.typography,
        enabled: s.typographyEnabled,
        measureCh: s.measureCh,
        proseLineHeight: s.proseLineHeight,
        codeLineHeight: s.codeLineHeight,
        normalizeXHeight: s.normalizeXHeight,
        inactivePaneOpacity: s.inactivePaneOpacity,
      },
    };
  }

  private refreshExtensions(): void {
    this.editorExtensions.length = 0;
    this.editorExtensions.push(buildUlyssesExtensions(this.toCoreConfig()));
    this.app.workspace.updateOptions();
  }

  private applyBodyStyling(): void {
    const s = this.settings;
    const cls = activeDocument.body.classList;
    cls.add("ulysses-feel-enabled");
    cls.toggle("ulysses-feel-typography", s.typographyEnabled);
    cls.toggle("ulysses-feel-xheight", s.typographyEnabled && s.normalizeXHeight);
    cls.toggle("ulysses-feel-heading-scale", s.typographyEnabled && s.ulyssesHeadingScale);
    cls.toggle("ulysses-feel-cjk-spacing", s.cjkOpticalSpacing);
    cls.toggle("ulysses-feel-outdent", s.hangingOutdentEnabled);
    cls.toggle("ulysses-feel-dim-inactive", s.dimInactivePanes);
    cls.toggle("ulysses-feel-hide-inline-title", s.hideInlineTitle);
    cls.toggle("ulysses-feel-hide-scrollbars", s.hideScrollbars);
    cls.toggle("ulysses-feel-distraction-free", s.distractionFreeCanvas);

    const style = activeDocument.body.style;
    // Use root-relative `rch` (CSS Values 4, matching Ulysses `pageWidth * baseFont.nWidth`)
    // instead of element-relative `ch`, so H1–H6 headings with different font sizes/weights
    // never compute different line widths or staircase under `margin: auto` centering!
    const measureVal =
      typeof CSS !== "undefined" && CSS.supports("width", "1rch")
        ? `${s.measureCh}rch`
        : `${(s.measureCh * 0.6).toFixed(2)}rem`;
    style.setProperty("--ul-measure-ch", measureVal);
    style.setProperty("--ul-prose-line-height", String(s.proseLineHeight));
    style.setProperty("--ul-code-line-height", String(s.codeLineHeight));
    style.setProperty("--ul-outdent-width", `${s.outdentWidthCh}ch`);
    style.setProperty("--ul-inactive-pane-opacity", String(s.inactivePaneOpacity));
  }

  private setupStatusBar(): void {
    this.statusBarEl = this.addStatusBarItem();
    this.statusBarEl.addClass("ul-status-bar-item");
    this.statusBarEl.setAttribute(
      "aria-label",
      "Click to cycle focus mode · Shift+Click to cycle typewriter mode",
    );
    this.registerDomEvent(this.statusBarEl, "click", async (evt) => {
      if (evt.shiftKey) {
        await this.cycleTypewriterMode();
      } else {
        await this.cycleFocusMode();
      }
    });
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    if (!this.statusBarEl) return;
    this.statusBarEl.toggleClass("ul-hidden", !this.settings.showStatusBar);
    if (!this.settings.showStatusBar) return;
    const tw = this.settings.typewriterEnabled ? this.settings.typewriterMode : "off";
    const fc = this.settings.focusMode;
    this.statusBarEl.setText(`UL · TW:${tw} · Focus:${fc}`);
  }

  private async cycleTypewriterMode(): Promise<void> {
    const cur: TypewriterScrollMode = this.settings.typewriterEnabled
      ? this.settings.typewriterMode
      : "off";
    const idx = TYPEWRITER_CYCLE.indexOf(cur);
    const next = TYPEWRITER_CYCLE[(idx + 1) % TYPEWRITER_CYCLE.length]!;
    this.settings.typewriterMode = next;
    this.settings.typewriterEnabled = next !== "off";
    await this.saveAndApply();
    new Notice(`Typewriter mode: ${next}`);
  }

  private async cycleFocusMode(): Promise<void> {
    const idx = FOCUS_CYCLE.indexOf(this.settings.focusMode);
    const next = FOCUS_CYCLE[(idx + 1) % FOCUS_CYCLE.length]!;
    this.settings.focusMode = next;
    await this.saveAndApply();
    new Notice(`Focus mode: ${next}`);
  }

  private registerCommands(): void {
    this.addCommand({
      id: "cycle-typewriter-mode",
      name: "Cycle typewriter scroll mode",
      callback: () => void this.cycleTypewriterMode(),
    });

    this.addCommand({
      id: "cycle-focus-mode",
      name: "Cycle focus mode",
      callback: () => void this.cycleFocusMode(),
    });

    this.addCommand({
      id: "toggle-baseline-highlight",
      name: "Toggle capsule baseline highlight",
      callback: async () => {
        this.settings.baselineHighlightEnabled = !this.settings.baselineHighlightEnabled;
        await this.saveAndApply();
        new Notice(
          `Baseline highlight: ${this.settings.baselineHighlightEnabled ? "on" : "off"}`,
        );
      },
    });

    this.addCommand({
      id: "toggle-hanging-outdent",
      name: "Toggle hanging outdent markup",
      callback: async () => {
        this.settings.hangingOutdentEnabled = !this.settings.hangingOutdentEnabled;
        await this.saveAndApply();
        new Notice(
          `Hanging outdent: ${this.settings.hangingOutdentEnabled ? "on" : "off"}`,
        );
      },
    });

    this.addCommand({
      id: "toggle-zero-jump-inline-syntax",
      name: "Toggle zero-jump inline syntax (Live Preview)",
      callback: async () => {
        this.settings.zeroJumpInlineSyntax = !this.settings.zeroJumpInlineSyntax;
        await this.saveAndApply();
        new Notice(
          `Zero-jump inline syntax: ${this.settings.zeroJumpInlineSyntax ? "on" : "off"}`,
        );
      },
    });

    this.addCommand({
      id: "new-titleless-sheet",
      name: "New titleless sheet",
      callback: () => {
        void this.titlelessSheets.createTitlelessSheet();
      },
    });

    this.addCommand({
      id: "open-sheet-list-panel",
      name: "Open sheet list sidebar",
      callback: () => {
        void this.activateSheetListView();
      },
    });

    this.addCommand({
      id: "sync-filename-from-first-line",
      name: "Sync current filename from first line",
      callback: () => {
        void this.titlelessSheets.syncActiveFileFromFirstLine();
      },
    });

    this.addCommand({
      id: "toggle-distraction-free-canvas",
      name: "Toggle distraction-free canvas",
      callback: async () => {
        this.settings.distractionFreeCanvas = !this.settings.distractionFreeCanvas;
        await this.saveAndApply();
        new Notice(
          `Distraction-free canvas: ${this.settings.distractionFreeCanvas ? "on" : "off"}`,
        );
      },
    });

    this.addCommand({
      id: "toggle-pure-source-writing-mode",
      name: "Toggle pure source mode",
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view) return false;
        if (checking) return true;

        const leaf = view.leaf;
        const viewState = leaf.getViewState();
        const curState = viewState.state ?? {};
        const nextSource = !curState.source;
        void leaf.setViewState({
          ...viewState,
          state: { ...curState, mode: "source", source: nextSource },
        });
        new Notice(
          nextSource
            ? "Switched to pure source mode"
            : "Switched back to Live Preview",
        );
        return true;
      },
    });
  }
}

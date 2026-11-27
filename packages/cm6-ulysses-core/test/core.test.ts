// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { EditorSelection, EditorState, RangeSetBuilder, Text } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import { history, undo } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  DEFAULT_ULYSSES_CONFIG,
  computeFocusRange,
  computeSqrtScrollDurationMs,
  computeTypewriterTargetScrollTop,
  createUlyssesExtension,
  extractSheetSummary,
  formatSilentSheetPlaceholder,
  ghostPairField,
  handleGhostBackspace,
  handleGhostInput,
  isInsideCodeBlock,
  isNestedSubEditor,
  isUntitledLikeBasename,
  sanitizeFilenameFromTitle,
  smartBacktabCommand,
  smartEnterCommand,
  smartHomeCommand,
  smartTabCommand,
  snapToDevicePixel,
} from "../src/index.js";

function createTestView(doc: string, cursor = 0, extra: Parameters<typeof EditorState.create>[0]["extensions"] = []) {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const state = EditorState.create({
    doc,
    selection: EditorSelection.cursor(cursor),
    extensions: [history(), markdown(), ...extra],
  });
  return new EditorView({ state, parent });
}

describe("Typewriter perceptual scroll math (Ulysses exact formulas)", () => {
  it("computes duration = 15 * sqrt(|deltaY|) matching 0.015s * sqrt(|Δy|)", () => {
    expect(computeSqrtScrollDurationMs(0)).toBe(0);
    // 1 line (~28px) -> ~79.37ms
    expect(computeSqrtScrollDurationMs(28)).toBeCloseTo(15 * Math.sqrt(28), 3);
    // 400px jump -> exactly 300ms
    expect(computeSqrtScrollDurationMs(400)).toBeCloseTo(300, 3);
    // Negative deltaY uses absolute value
    expect(computeSqrtScrollDurationMs(-400)).toBeCloseTo(300, 3);
    // Huge jump caps cleanly
    expect(computeSqrtScrollDurationMs(100000, 15, 650)).toBe(650);
  });

  it("snaps coordinates to device backing pixels", () => {
    expect(snapToDevicePixel(100.3, 2)).toBe(100.5);
    expect(snapToDevicePixel(100.2, 2)).toBe(100);
    expect(snapToDevicePixel(100.6, 1)).toBe(101);
  });

  it("respects Variable comfort band [15%, 85%] and Fixed 30%/50%/70% anchors", () => {
    const fixedFractions = { top: 0.3, middle: 0.5, bottom: 0.7 };
    // Inside [150, 850] on 1000px viewport -> returns null (no scroll!)
    expect(
      computeTypewriterTargetScrollTop({
        mode: "variable",
        currentScrollTop: 100,
        viewportHeight: 1000,
        caretBaselineDocY: 600, // relY = 500
        variableBandTop: 0.15,
        variableBandBottom: 0.85,
        fixedFractions,
      }),
    ).toBeNull();

    // Below 85% (relY = 900) -> pushes scrollTop so caret sits at 850
    expect(
      computeTypewriterTargetScrollTop({
        mode: "variable",
        currentScrollTop: 100,
        viewportHeight: 1000,
        caretBaselineDocY: 1000,
        variableBandTop: 0.15,
        variableBandBottom: 0.85,
        fixedFractions,
      }),
    ).toBe(150);

    // Fixed Top (30%) / Middle (50%) / Bottom (70%)
    expect(
      computeTypewriterTargetScrollTop({
        mode: "top",
        currentScrollTop: 0,
        viewportHeight: 1000,
        caretBaselineDocY: 800,
        variableBandTop: 0.15,
        variableBandBottom: 0.85,
        fixedFractions,
      }),
    ).toBe(500);
    expect(
      computeTypewriterTargetScrollTop({
        mode: "middle",
        currentScrollTop: 0,
        viewportHeight: 1000,
        caretBaselineDocY: 800,
        variableBandTop: 0.15,
        variableBandBottom: 0.85,
        fixedFractions,
      }),
    ).toBe(300);
    expect(
      computeTypewriterTargetScrollTop({
        mode: "bottom",
        currentScrollTop: 0,
        viewportHeight: 1000,
        caretBaselineDocY: 800,
        variableBandTop: 0.15,
        variableBandBottom: 0.85,
        fixedFractions,
      }),
    ).toBe(100);
  });
});

describe("Focus Mode range computation (Line / Sentence / Paragraph)", () => {
  it("computes CJK and English sentence boundaries accurately", () => {
    const doc = Text.of(["第一句话在这里。第二句话在这里！Third sentence?"]);
    // Inside second Chinese sentence ("第二句话在这里！")
    const r = computeFocusRange(doc, 10, 10, "sentence", "zh-CN");
    expect(r).not.toBeNull();
    expect(doc.sliceString(r!.from, r!.to)).toBe("第二句话在这里！");

    // Inside English sentence
    const r2 = computeFocusRange(doc, 20, 20, "sentence", "en-US");
    expect(r2).not.toBeNull();
    expect(doc.sliceString(r2!.from, r2!.to)).toBe("Third sentence?");
  });

  it("computes paragraph focus range cleanly", () => {
    const doc = Text.of(["Para one.", "Para two line.", "Para three."]);
    const line2 = doc.line(2);
    const r = computeFocusRange(doc, line2.from + 3, line2.from + 3, "paragraph");
    expect(r).toEqual({ from: line2.from, to: line2.to });
  });
});

describe("Ghost Auto-Pairing (Ulysses ULTextActor dual-range & undo isolation)", () => {
  const cfg = DEFAULT_ULYSSES_CONFIG.ghostAutoPair;

  it("inserts closing tag with isolated undo so 1x Cmd+Z undoes ONLY the closing tag", () => {
    const bundle = createUlyssesExtension({
      typewriter: { enabled: false },
      baselineHighlight: { enabled: false },
    });
    const view = createTestView("", 0, [bundle.extension]);

    expect(handleGhostInput(view, 0, 0, "*", cfg)).toBe(true);
    expect(view.state.doc.toString()).toBe("**");
    expect(view.state.selection.main.head).toBe(1);
    expect(view.state.field(ghostPairField)).toMatchObject({
      matchedFrom: 0,
      insertedFrom: 1,
      insertedTo: 2,
      open: "*",
      close: "*",
    });

    // Single Undo removes ONLY the auto-inserted closing "*", keeping user's "*"!
    undo(view);
    expect(view.state.doc.toString()).toBe("*");
    expect(view.state.selection.main.head).toBe(1);

    // Second Undo removes the user's "*"
    undo(view);
    expect(view.state.doc.toString()).toBe("");
    view.destroy();
  });

  it("upgrades *|* to **|** when typing second *, then collapses cleanly on manual closing **", () => {
    const bundle = createUlyssesExtension({
      typewriter: { enabled: false },
      baselineHighlight: { enabled: false },
    });
    const view = createTestView("", 0, [bundle.extension]);

    // Type * -> *|*
    handleGhostInput(view, 0, 0, "*", cfg);
    expect(view.state.doc.toString()).toBe("**");
    // Type second * -> **|**
    handleGhostInput(view, 1, 1, "*", cfg);
    expect(view.state.doc.toString()).toBe("****");
    expect(view.state.selection.main.head).toBe(2);

    // Type interior text "bold"
    view.dispatch({
      changes: { from: 2, insert: "bold" },
      selection: EditorSelection.cursor(6),
    });
    expect(view.state.doc.toString()).toBe("**bold**");
    expect(view.state.field(ghostPairField)).toMatchObject({
      matchedFrom: 0,
      insertedFrom: 6,
      insertedTo: 8,
    });

    // Overtype closing "*" twice -> skips over ghost without creating "****"
    expect(handleGhostInput(view, 6, 6, "*", cfg)).toBe(true);
    expect(view.state.doc.toString()).toBe("**bold**");
    expect(view.state.selection.main.head).toBe(7);

    expect(handleGhostInput(view, 7, 7, "*", cfg)).toBe(true);
    expect(view.state.doc.toString()).toBe("**bold**");
    expect(view.state.selection.main.head).toBe(8);
    expect(view.state.field(ghostPairField)).toBeNull();
    view.destroy();
  });

  it("deletes paired ghost characters on Backspace and downgrades **|** -> *|*", () => {
    const bundle = createUlyssesExtension({
      typewriter: { enabled: false },
      baselineHighlight: { enabled: false },
    });
    const view = createTestView("", 0, [bundle.extension]);

    handleGhostInput(view, 0, 0, "*", cfg);
    handleGhostInput(view, 1, 1, "*", cfg);
    expect(view.state.doc.toString()).toBe("****");

    // First Backspace downgrades **|** -> *|*
    expect(handleGhostBackspace(view, cfg)).toBe(true);
    expect(view.state.doc.toString()).toBe("**");
    expect(view.state.selection.main.head).toBe(1);

    // Second Backspace removes remaining *|*
    expect(handleGhostBackspace(view, cfg)).toBe(true);
    expect(view.state.doc.toString()).toBe("");
    expect(view.state.selection.main.head).toBe(0);
    view.destroy();
  });

  it("does not misfire on snake_case identifiers", () => {
    const bundle = createUlyssesExtension({
      typewriter: { enabled: false },
      baselineHighlight: { enabled: false },
    });
    const view = createTestView("foo", 3, [bundle.extension]);
    expect(handleGhostInput(view, 3, 3, "_", cfg)).toBe(false);
    view.destroy();
  });
});

describe("Smart Editing (Context-aware Tab, Ordered List Renumbering, Smart Home)", () => {
  const cfg = DEFAULT_ULYSSES_CONFIG.smartEditing;

  it("indents prose line from mid-sentence with Tab, but yields literal Tab inside fenced code blocks", () => {
    const view = createTestView("Hello world\n```ts\nconst x = 1;\n```", 5);
    // In prose at col 5: Tab indents at line start, keeping cursor offset!
    expect(smartTabCommand(view, cfg)).toBe(true);
    expect(view.state.doc.line(1).text).toBe("\tHello world");
    expect(view.state.selection.main.head).toBe(6);

    // Shift-Tab outdents cleanly
    expect(smartBacktabCommand(view, cfg)).toBe(true);
    expect(view.state.doc.line(1).text).toBe("Hello world");
    expect(view.state.selection.main.head).toBe(5);

    // Inside fenced code block: returns false so native tab insertion happens
    const codePos = view.state.doc.line(3).from + 4;
    expect(isInsideCodeBlock(view.state, codePos)).toBe(true);
    view.dispatch({ selection: EditorSelection.cursor(codePos) });
    expect(smartTabCommand(view, cfg)).toBe(false);
    view.destroy();
  });

  it("continues ordered lists and automatically renumbers subsequent sibling items", () => {
    const view = createTestView("1. First\n2. Second\n3. Third", 8);
    expect(smartEnterCommand(view, cfg)).toBe(true);
    expect(view.state.doc.toString()).toBe("1. First\n2. \n3. Second\n4. Third");

    // Pressing Enter again on empty "2. " exits list and renumbers following items from 1
    expect(smartEnterCommand(view, cfg)).toBe(true);
    expect(view.state.doc.toString()).toBe("1. First\n\n1. Second\n2. Third");
    view.destroy();
  });

  it("toggles cursor between heading/list content start and column 0 with Smart Home", () => {
    const view = createTestView("### My Heading", 14);
    // Jump to start of "My Heading" (col 4)
    expect(smartHomeCommand(view, false, cfg)).toBe(true);
    expect(view.state.selection.main.head).toBe(4);
    // Second Home jumps to col 0
    expect(smartHomeCommand(view, false, cfg)).toBe(true);
    expect(view.state.selection.main.head).toBe(0);
    // Third Home jumps back to col 4
    expect(smartHomeCommand(view, false, cfg)).toBe(true);
    expect(view.state.selection.main.head).toBe(4);
    view.destroy();
  });
});

describe("Nested sub-editor isolation (Obsidian Live Preview table cells & embeds)", () => {
  it("skips document-level layout/nav extensions inside nested table-cell editors while keeping ghost auto-pair active", () => {
    const outer = document.createElement("div");
    outer.className = "cm-editor";
    const widget = document.createElement("div");
    widget.className = "cm-embed-block cm-table-widget";
    const table = document.createElement("table");
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    const wrapper = document.createElement("div");
    wrapper.className = "table-cell-wrapper";
    td.appendChild(wrapper);
    tr.appendChild(td);
    table.appendChild(tr);
    widget.appendChild(table);
    outer.appendChild(widget);
    document.body.appendChild(outer);

    const bundle = createUlyssesExtension({
      typewriter: { enabled: true, overscrollPadding: true },
      focusMode: { enabled: true, mode: "sentence" },
      hangingOutdent: { enabled: true },
      baselineHighlight: { enabled: true },
    });

    const state = EditorState.create({
      doc: "cell text",
      selection: EditorSelection.cursor(0),
      extensions: [history(), bundle.extension],
    });
    const nestedView = new EditorView({ state, parent: wrapper });

    expect(isNestedSubEditor(nestedView)).toBe(true);
    expect(nestedView.dom.classList.contains("ul-typewriter-overscroll-top")).toBe(false);
    expect(nestedView.dom.classList.contains("ul-typewriter-overscroll-bottom")).toBe(false);
    expect(nestedView.dom.classList.contains("ul-outdent-enabled")).toBe(false);
    expect(nestedView.dom.classList.contains("ul-focus-active")).toBe(false);
    expect(nestedView.scrollDOM.querySelector(".ul-baseline-highlight")).toBeNull();

    // Native table navigation must not be hijacked by smart Tab / Shift-Tab / Enter
    expect(smartTabCommand(nestedView, DEFAULT_ULYSSES_CONFIG.smartEditing)).toBe(false);
    expect(smartBacktabCommand(nestedView, DEFAULT_ULYSSES_CONFIG.smartEditing)).toBe(false);
    expect(smartEnterCommand(nestedView, DEFAULT_ULYSSES_CONFIG.smartEditing)).toBe(false);

    // Ghost auto-pair STILL works cleanly inside table cells (e.g. wrapping a selection)!
    expect(
      handleGhostInput(nestedView, 0, 4, "*", DEFAULT_ULYSSES_CONFIG.ghostAutoPair),
    ).toBe(true);
    expect(nestedView.state.doc.toString()).toBe("*cell* text");

    nestedView.destroy();
    outer.remove();
  });
});

describe("Zero-Jump Live Preview inline syntax mirroring", () => {
  it("renders muted ghost syntax widgets for hidden inline delimiters and drops them immediately when revealed", () => {
    // Simulate a Live Preview host hiding `**` around "bold" when caret is outside [6, 14]
    const mockLivePreview = ViewPlugin.fromClass(
      class {
        decorations;
        constructor(view: EditorView) {
          this.decorations = this.build(view);
        }
        update(u: { view: EditorView; docChanged: boolean; selectionSet: boolean }) {
          if (u.docChanged || u.selectionSet) this.decorations = this.build(u.view);
        }
        build(view: EditorView) {
          const sel = view.state.selection.main;
          if (sel.from <= 14 && sel.to >= 6) return Decoration.none;
          const b = new RangeSetBuilder<Decoration>();
          b.add(6, 8, Decoration.replace({}));
          b.add(12, 14, Decoration.replace({}));
          return b.finish();
        }
      },
      { decorations: (v) => v.decorations },
    );

    const bundle = createUlyssesExtension({
      typewriter: { enabled: false },
      baselineHighlight: { enabled: false },
      hangingOutdent: { enabled: true, zeroJumpInlineSyntax: true },
    });

    // Cursor at 0 (outside **bold**): host hides ** -> our plugin emits 2 ghost ** widgets!
    const view = createTestView("Hello **bold** world", 0, [
      mockLivePreview,
      bundle.extension,
    ]);
    const ghostsHidden = view.contentDOM.querySelectorAll(".ul-ghost-syntax");
    expect(ghostsHidden.length).toBe(2);
    expect(ghostsHidden[0]?.textContent?.replace(/\u2060/g, "")).toBe("**");
    expect(ghostsHidden[1]?.textContent?.replace(/\u2060/g, "")).toBe("**");

    // Move cursor inside **bold** (pos 9): host reveals ** -> ghost widgets vanish on Frame 0!
    view.dispatch({ selection: EditorSelection.cursor(9) });
    expect(view.contentDOM.querySelectorAll(".ul-ghost-syntax").length).toBe(0);

    // Move cursor back out (pos 19): ghost widgets reappear cleanly!
    view.dispatch({ selection: EditorSelection.cursor(19) });
    expect(view.contentDOM.querySelectorAll(".ul-ghost-syntax").length).toBe(2);

    view.destroy();
  });
});

describe("Titleless Sheet summary & safe filename derivation (Ulysses Sheet workflow)", () => {
  it("extracts clean first-line title, stripped preview lines, and CJK+Latin word count while skipping YAML frontmatter", () => {
    const md = [
      "---",
      "title: Ignored Frontmatter",
      "tags: [writing]",
      "---",
      "",
      "# **Ulysses** 无标题写作体验",
      "",
      "第一段包含 `代码` 和 [[内部链接|别名]]，以及 [外部链接](https://example.com)。",
      "- 列表项第二行预览",
    ].join("\n");

    const summary = extractSheetSummary(md);
    expect(summary.isEmpty).toBe(false);
    expect(summary.title).toBe("Ulysses 无标题写作体验");
    expect(summary.preview).toContain("第一段包含 代码 和 别名，以及 外部链接。");
    expect(summary.preview).toContain("列表项第二行预览");
    expect(summary.wordCount).toBeGreaterThan(20);
  });

  it("sanitizes illegal filename characters cleanly and identifies only untitled/placeholder basenames", () => {
    expect(sanitizeFilenameFromTitle("  # A/B: 测试?*<标题> [1]  ")).toBe("A B 测试 标题 1");
    expect(sanitizeFilenameFromTitle("...leading and trailing...")).toBe("leading and trailing");
    expect(sanitizeFilenameFromTitle("///")).toBe("");

    expect(isUntitledLikeBasename("Untitled")).toBe(true);
    expect(isUntitledLikeBasename("Untitled 3")).toBe(true);
    expect(isUntitledLikeBasename("未命名")).toBe(true);
    expect(isUntitledLikeBasename("未命名 2")).toBe(true);
    expect(isUntitledLikeBasename(formatSilentSheetPlaceholder())).toBe(true);

    // Must NEVER touch user-named notes or daily notes!
    expect(isUntitledLikeBasename("2026-04-23")).toBe(false);
    expect(isUntitledLikeBasename("产品思考笔记")).toBe(false);
  });
});

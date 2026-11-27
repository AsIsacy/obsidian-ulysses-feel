import {
  ChangeSpec,
  EditorSelection,
  EditorState,
  Extension,
  Prec,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { SmartEditingConfig } from "./types.js";
import { isNestedSubEditor } from "./dom-guards.js";

const FENCE_LINE_RE = /^\s*(```|~~~)/;

/**
 * Determine whether `pos` is inside a fenced or indented code block.
 * Uses Lezer syntaxTree first, with a fast line-based fence-parity fallback
 * so it remains 100% accurate even without markdown grammar or deep in huge docs.
 */
export function isInsideCodeBlock(state: EditorState, pos: number): boolean {
  const tree = syntaxTree(state);
  let node = tree.resolveInner(pos, -1);
  while (node) {
    const name = node.name;
    if (
      name === "FencedCode" ||
      name === "CodeBlock" ||
      name === "CodeText" ||
      name.includes("codeblock")
    ) {
      return true;
    }
    if (!node.parent) break;
    node = node.parent;
  }

  // Fast fallback: scan fence toggles up to current line
  const curLineNum = state.doc.lineAt(pos).number;
  let inFence = false;
  let fenceChar = "";
  for (let ln = 1; ln <= curLineNum; ln++) {
    const text = state.doc.line(ln).text;
    const m = FENCE_LINE_RE.exec(text);
    if (m) {
      const marker = m[1]!;
      if (!inFence) {
        inFence = true;
        fenceChar = marker[0]!;
      } else if (marker[0] === fenceChar) {
        // Closing fence line itself counts as code context if cursor is on it
        if (ln === curLineNum) return true;
        inFence = false;
        fenceChar = "";
      }
    }
  }
  return inFence;
}

const TASK_LIST_RE = /^(\s*)([-*+])\s+\[([ xX])\](\s+)(.*)$/;
const UNORDERED_LIST_RE = /^(\s*)([-*+])(\s+)(.*)$/;
const ORDERED_LIST_RE = /^(\s*)(\d+)([.)])(\s+)(.*)$/;
const BLOCKQUOTE_RE = /^(\s*(?:>\s*)+)(.*)$/;
const HEADING_RE = /^(\s*#{1,6}\s+)(.*)$/;

function getLineContentStartOffset(lineText: string): number {
  for (const re of [
    HEADING_RE,
    TASK_LIST_RE,
    UNORDERED_LIST_RE,
    ORDERED_LIST_RE,
    BLOCKQUOTE_RE,
  ]) {
    const m = re.exec(lineText);
    if (m) {
      const content = m[m.length - 1] ?? "";
      return lineText.length - content.length;
    }
  }
  const ws = /^(\s+)/.exec(lineText);
  return ws ? ws[1]!.length : 0;
}

/**
 * Ulysses performInsertTab:
 * - Inside code block with empty selection: return false (insert literal \t).
 * - Outside code block (prose, lists, blockquotes): indent the full line(s) at column 0
 *   from ANY cursor column, never splitting a sentence with a stray tab!
 */
export function smartTabCommand(
  view: EditorView,
  config: SmartEditingConfig,
): boolean {
  if (!config.enabled || !config.contextAwareTab) return false;
  // Never hijack Tab navigation inside nested editors (e.g. Obsidian table cells)
  if (isNestedSubEditor(view)) return false;
  const state = view.state;
  const sel = state.selection.main;

  if (sel.empty && isInsideCodeBlock(state, sel.head)) {
    return false;
  }

  const startLine = state.doc.lineAt(sel.from).number;
  const endLine = state.doc.lineAt(
    sel.to > sel.from && state.doc.lineAt(sel.to).from === sel.to ? sel.to - 1 : sel.to,
  ).number;

  const indent = config.indentUnit;
  const changes: ChangeSpec[] = [];
  for (let ln = startLine; ln <= endLine; ln++) {
    const line = state.doc.line(ln);
    changes.push({ from: line.from, insert: indent });
  }

  const tr = state.update({
    changes,
    selection: sel.empty
      ? EditorSelection.cursor(sel.head + indent.length)
      : EditorSelection.range(
          sel.from + indent.length,
          sel.to + indent.length * (endLine - startLine + 1),
        ),
    userEvent: "input.indent",
  });
  view.dispatch(tr);
  return true;
}

/**
 * Ulysses performInsertBacktab:
 * Always outdents selected line(s) cleanly while preserving relative cursor position.
 */
export function smartBacktabCommand(
  view: EditorView,
  config: SmartEditingConfig,
): boolean {
  if (!config.enabled || !config.contextAwareTab) return false;
  if (isNestedSubEditor(view)) return false;
  const state = view.state;
  const sel = state.selection.main;

  const startLine = state.doc.lineAt(sel.from).number;
  const endLine = state.doc.lineAt(
    sel.to > sel.from && state.doc.lineAt(sel.to).from === sel.to ? sel.to - 1 : sel.to,
  ).number;

  const changes: ChangeSpec[] = [];
  let firstRemoved = 0;
  let totalRemoved = 0;

  for (let ln = startLine; ln <= endLine; ln++) {
    const line = state.doc.line(ln);
    const removeLen = computeOutdentLength(line.text, config.indentUnit);
    if (removeLen > 0) {
      changes.push({ from: line.from, to: line.from + removeLen });
      if (ln === startLine) firstRemoved = removeLen;
      totalRemoved += removeLen;
    }
  }

  if (changes.length === 0) return true;

  const firstLineFrom = state.doc.line(startLine).from;
  const newFrom = Math.max(firstLineFrom, sel.from - firstRemoved);
  const newTo = Math.max(newFrom, sel.to - totalRemoved);

  view.dispatch({
    changes,
    selection: sel.empty
      ? EditorSelection.cursor(newFrom)
      : EditorSelection.range(newFrom, newTo),
    userEvent: "delete.dedent",
  });
  return true;
}

function computeOutdentLength(lineText: string, indentUnit: string): number {
  if (lineText.startsWith("\t")) return 1;
  if (indentUnit !== "\t" && lineText.startsWith(indentUnit)) {
    return indentUnit.length;
  }
  const m = /^( {1,4})/.exec(lineText);
  return m ? m[1]!.length : 0;
}

/**
 * Compute atomic renumbering changes for subsequent contiguous sibling ordered list items
 * at the exact same indentation level (mirroring Ulysses autoupdateItemizedGroupingsStartingFromIndex:).
 */
export function buildOrderedListRenumberChanges(
  state: EditorState,
  afterLineNumber: number,
  targetIndent: string,
  nextExpectedNumber: number,
): ChangeSpec[] {
  const changes: ChangeSpec[] = [];
  let num = nextExpectedNumber;
  const totalLines = state.doc.lines;

  for (let ln = afterLineNumber + 1; ln <= totalLines; ln++) {
    const line = state.doc.line(ln);
    const text = line.text;

    // Empty line ends list group
    if (text.trim().length === 0) break;

    const om = ORDERED_LIST_RE.exec(text);
    if (om) {
      const indent = om[1]!;
      const oldDigits = om[2]!;
      if (indent === targetIndent) {
        const expectedStr = String(num);
        if (oldDigits !== expectedStr) {
          changes.push({
            from: line.from + indent.length,
            to: line.from + indent.length + oldDigits.length,
            insert: expectedStr,
          });
        }
        num++;
        continue;
      }
      // More indented sub-list belongs to previous item; keep scanning
      if (indent.length > targetIndent.length) {
        continue;
      }
      // Less indented item ends this list level
      break;
    }

    // Continuation lines or nested unordered bullets indented deeper than targetIndent
    const wsMatch = /^(\s*)/.exec(text);
    const wsLen = wsMatch ? wsMatch[1]!.length : 0;
    if (wsLen > targetIndent.length) {
      continue;
    }
    break;
  }

  return changes;
}

/**
 * Ulysses performInsertNewline:
 * - Continues unordered, ordered (with live renumbering!), task lists, and blockquotes.
 * - Exits empty list item cleanly (outdents if nested, strips marker if top-level) and renumbers!
 */
export function smartEnterCommand(
  view: EditorView,
  config: SmartEditingConfig,
): boolean {
  if (!config.enabled || !config.smartListContinuation) return false;
  if (isNestedSubEditor(view)) return false;
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;
  if (isInsideCodeBlock(state, sel.head)) return false;

  const line = state.doc.lineAt(sel.head);
  const text = line.text;
  const col = sel.head - line.from;

  // 1. Task list item
  const taskMatch = TASK_LIST_RE.exec(text);
  if (taskMatch) {
    const [, indent, marker, , space, content] = taskMatch;
    const prefixLen = text.length - (content?.length ?? 0);
    if (col < prefixLen) return false;

    if ((content ?? "").trim().length === 0) {
      return exitOrOutdentEmptyListItem(view, line, indent!, config, false);
    }

    const insert = `\n${indent}${marker} [ ]${space}`;
    view.dispatch({
      changes: { from: sel.head, insert },
      selection: EditorSelection.cursor(sel.head + insert.length),
      userEvent: "input.enter",
    });
    return true;
  }

  // 2. Unordered list item
  const ulMatch = UNORDERED_LIST_RE.exec(text);
  if (ulMatch) {
    const [, indent, marker, space, content] = ulMatch;
    const prefixLen = text.length - (content?.length ?? 0);
    if (col < prefixLen) return false;

    if ((content ?? "").trim().length === 0) {
      return exitOrOutdentEmptyListItem(view, line, indent!, config, false);
    }

    const insert = `\n${indent}${marker}${space}`;
    view.dispatch({
      changes: { from: sel.head, insert },
      selection: EditorSelection.cursor(sel.head + insert.length),
      userEvent: "input.enter",
    });
    return true;
  }

  // 3. Ordered list item (with automatic sibling renumbering!)
  const olMatch = ORDERED_LIST_RE.exec(text);
  if (olMatch) {
    const [, indent, numStr, delim, space, content] = olMatch;
    const prefixLen = text.length - (content?.length ?? 0);
    if (col < prefixLen) return false;

    if ((content ?? "").trim().length === 0) {
      return exitOrOutdentEmptyListItem(view, line, indent!, config, true);
    }

    const nextNum = parseInt(numStr!, 10) + 1;
    const insert = `\n${indent}${nextNum}${delim}${space}`;
    const changes: ChangeSpec[] = [{ from: sel.head, insert }];

    if (config.autoRenumberOrderedLists) {
      changes.push(
        ...buildOrderedListRenumberChanges(state, line.number, indent!, nextNum + 1),
      );
    }

    view.dispatch({
      changes,
      selection: EditorSelection.cursor(sel.head + insert.length),
      userEvent: "input.enter",
    });
    return true;
  }

  // 4. Blockquote
  const qMatch = BLOCKQUOTE_RE.exec(text);
  if (qMatch) {
    const [, prefix, content] = qMatch;
    const prefixLen = prefix!.length;
    if (col < prefixLen) return false;

    if ((content ?? "").trim().length === 0) {
      // Exit empty blockquote line
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
        selection: EditorSelection.cursor(line.from),
        userEvent: "delete.list",
      });
      return true;
    }

    const normalizedPrefix = prefix!.endsWith(" ") ? prefix! : `${prefix!} `;
    const insert = `\n${normalizedPrefix}`;
    view.dispatch({
      changes: { from: sel.head, insert },
      selection: EditorSelection.cursor(sel.head + insert.length),
      userEvent: "input.enter",
    });
    return true;
  }

  return false;
}

function exitOrOutdentEmptyListItem(
  view: EditorView,
  line: { from: number; to: number; number: number; text: string },
  indent: string,
  config: SmartEditingConfig,
  wasOrdered: boolean,
): boolean {
  const state = view.state;
  const changes: ChangeSpec[] = [];

  if (indent.length > 0) {
    // Nested empty list item: outdent one level
    const removeLen = computeOutdentLength(indent, config.indentUnit);
    if (removeLen > 0) {
      changes.push({ from: line.from, to: line.from + removeLen });
      view.dispatch({
        changes,
        selection: EditorSelection.cursor(line.to - removeLen),
        userEvent: "delete.dedent",
      });
      return true;
    }
  }

  // Top-level empty list item: strip marker completely
  changes.push({ from: line.from, to: line.to, insert: "" });

  if (wasOrdered && config.autoRenumberOrderedLists) {
    // Remaining items after exiting form a fresh ordered list starting at 1
    changes.push(...buildOrderedListRenumberChanges(state, line.number, indent, 1));
  }

  view.dispatch({
    changes,
    selection: EditorSelection.cursor(line.from),
    userEvent: "delete.list",
  });
  return true;
}

/**
 * Ulysses performMoveToBeginningOfLineWithProposedLocation (Smart Home):
 * Toggles between content start (after #, -, 1., >) and column 0.
 */
export function smartHomeCommand(
  view: EditorView,
  extendSelection: boolean,
  config: SmartEditingConfig,
): boolean {
  if (!config.enabled || !config.smartHome) return false;
  const state = view.state;
  const sel = state.selection.main;
  const line = state.doc.lineAt(sel.head);
  const contentOffset = getLineContentStartOffset(line.text);
  const contentPos = line.from + contentOffset;

  // If line has no prefix/indent, fall back to default behavior
  if (contentOffset === 0) return false;

  const target = sel.head > contentPos || sel.head === line.from ? contentPos : line.from;
  if (target === sel.head && !extendSelection) return false;

  view.dispatch({
    selection: extendSelection
      ? EditorSelection.range(sel.anchor, target)
      : EditorSelection.cursor(target),
    scrollIntoView: true,
    userEvent: "select.move",
  });
  return true;
}

const POTENTIAL_TAG_PREFIX_RE = /(?:^|\s)(?:-{1,3}|'{1,2}|`{1,2}|\+{1,2}|:{1,2}|\|{1,2}|>{1,2})$/;

/**
 * Guard against OS smart dash (`--` -> `—`) and smart quotes (`''` -> `”`) inside code blocks
 * or when typing potential markdown tags (Ulysses ULString(TextChecking)).
 */
function potentialMarkupGuardHandler(config: SmartEditingConfig): Extension {
  if (!config.protectPotentialMarkup) return [];

  return EditorView.domEventHandlers({
    beforeinput(event, view) {
      if (view.composing) return false;
      const data = event.data;
      if (!data) return false;

      const isSmartReplacement =
        event.inputType === "insertReplacementText" ||
        (event.inputType === "insertText" && (data === "—" || data === "–" || data === "”" || data === "“" || data === "’" || data === "‘"));

      if (!isSmartReplacement) return false;

      const sel = view.state.selection.main;
      const inCode = isInsideCodeBlock(view.state, sel.from);
      const line = view.state.doc.lineAt(sel.from);
      const before = line.text.slice(0, sel.from - line.from);
      const nearTagPrefix = POTENTIAL_TAG_PREFIX_RE.test(before);

      if (!inCode && !nearTagPrefix) return false;

      // Map smart punctuation back to raw ASCII
      const rawMap: Record<string, string> = {
        "—": "--",
        "–": "--",
        "“": '"',
        "”": '"',
        "‘": "'",
        "’": "'",
      };
      const replacement = rawMap[data];
      if (!replacement) return false;

      event.preventDefault();
      // If macOS tried to replace a preceding '-' with '—', replace only the triggered span
      const replaceFrom =
        data === "—" && before.endsWith("-") ? sel.from - 1 : sel.from;
      const insertText =
        data === "—" && before.endsWith("-") ? "--" : replacement;
      view.dispatch({
        changes: { from: replaceFrom, to: sel.to, insert: insertText },
        selection: EditorSelection.cursor(replaceFrom + insertText.length),
        userEvent: "input.type",
      });
      return true;
    },
  });
}

export function smartEditingExtension(config: SmartEditingConfig): Extension {
  if (!config.enabled) return [];

  return [
    Prec.high(
      keymap.of([
        {
          key: "Tab",
          run: (view) => smartTabCommand(view, config),
        },
        {
          key: "Shift-Tab",
          run: (view) => smartBacktabCommand(view, config),
        },
        {
          key: "Enter",
          run: (view) => smartEnterCommand(view, config),
        },
        {
          key: "Alt-Enter",
          run: (view) => {
            if (!config.smartListContinuation) return false;
            if (isNestedSubEditor(view)) return false;
            const sel = view.state.selection.main;
            view.dispatch({
              changes: { from: sel.from, to: sel.to, insert: "\n" },
              selection: EditorSelection.cursor(sel.from + 1),
              userEvent: "input.enter",
            });
            return true;
          },
        },
        {
          key: "Home",
          run: (view) => smartHomeCommand(view, false, config),
          shift: (view) => smartHomeCommand(view, true, config),
        },
        {
          key: "Mod-ArrowLeft",
          run: (view) => smartHomeCommand(view, false, config),
          shift: (view) => smartHomeCommand(view, true, config),
        },
      ]),
    ),
    potentialMarkupGuardHandler(config),
  ];
}

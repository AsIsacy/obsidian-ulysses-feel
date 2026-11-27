import {
  EditorSelection,
  Extension,
  Prec,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { isolateHistory } from "@codemirror/commands";
import type { GhostAutoPairConfig } from "./types.js";
import { isInsideCodeBlock } from "./smart-editing.js";

/**
 * Dual-range ghost auto-pairing state mirroring Ulysses's ULTextActor:
 *   _autoMatchedRange  = [matchedFrom, insertedFrom)
 *   _autoInsertedRange = [insertedFrom, insertedTo)
 */
export interface GhostPairState {
  matchedFrom: number;
  matchedTo: number;
  insertedFrom: number;
  insertedTo: number;
  open: string;
  close: string;
}

export const setGhostPairEffect = StateEffect.define<GhostPairState | null>();

export const ghostPairField = StateField.define<GhostPairState | null>({
  create() {
    return null;
  },
  update(value, tr) {
    // Explicit effect always wins
    for (const effect of tr.effects) {
      if (effect.is(setGhostPairEffect)) {
        return effect.value;
      }
    }

    if (!value) return null;

    // On undo/redo, clear ghost tracking cleanly
    if (tr.isUserEvent("undo") || tr.isUserEvent("redo")) {
      return null;
    }

    let { matchedFrom, insertedFrom, insertedTo } = value;
    if (tr.docChanged) {
      matchedFrom = tr.changes.mapPos(matchedFrom, 1);
      // Assoc 1 on insertedFrom so typing right before the ghost closing tag
      // keeps the ghost tag pushed right and expands matched range!
      insertedFrom = tr.changes.mapPos(insertedFrom, 1);
      insertedTo = tr.changes.mapPos(insertedTo, 1);
    }

    if (insertedFrom >= insertedTo || matchedFrom > insertedFrom) {
      return null;
    }

    // Verify ghost closing characters are still intact
    const remainingGhost = tr.newDoc.sliceString(insertedFrom, insertedTo);
    if (!value.close.endsWith(remainingGhost)) {
      return null;
    }

    // checkSelectionOutsideAutoMatchedRange: commit ghost once selection leaves union range
    const sel = tr.newSelection.main;
    if (sel.from < matchedFrom || sel.to > insertedTo) {
      return null;
    }

    return {
      ...value,
      matchedFrom,
      matchedTo: insertedFrom,
      insertedFrom,
      insertedTo,
    };
  },
});

const MARKDOWN_ONLY_OPENS = new Set(["*", "**", "_", "__", "==", "~~", "`"]);
const SYMMETRIC_WORD_GUARD_OPENS = new Set(["*", "_", '"', "`"]);
const WORD_CHAR_RE = /[A-Za-z0-9_\u4e00-\u9fff]/;
const LATIN_WORD_CHAR_RE = /[A-Za-z0-9_]/;

function findPair(
  pairs: ReadonlyArray<readonly [string, string]>,
  open: string,
): readonly [string, string] | undefined {
  return pairs.find(([o]) => o === open);
}

function isEscaped(docSliceBefore: string): boolean {
  let slashes = 0;
  for (let i = docSliceBefore.length - 1; i >= 0 && docSliceBefore[i] === "\\"; i--) {
    slashes++;
  }
  return slashes % 2 === 1;
}

/**
 * Process typed text with Ulysses ghost auto-pair semantics:
 * 1. Upgrade 1-char pair -> 2-char pair when interior is empty (e.g. *|* + * -> **|**)
 * 2. Collapse/skip over ghost closing chars when typing matching closer (overtype-collapse)
 * 3. Wrap non-empty selection
 * 4. Open new 2-char or 1-char pair with isolateHistory.of("before") so 1x Cmd+Z undoes ONLY the closing tag
 */
export function handleGhostInput(
  view: EditorView,
  from: number,
  to: number,
  text: string,
  config: GhostAutoPairConfig,
): boolean {
  if (!config.enabled || text.length === 0) return false;
  // Never interfere during IME composition (CJK input safety)
  if (view.composing) return false;
  // Only handle single-character manual typing (multi-char pastes are untouched)
  if (text.length !== 1) return false;

  const state = view.state;
  const doc = state.doc;
  const inCode = isInsideCodeBlock(state, from);

  // Case 1: Selection wrapping
  if (from < to && config.wrapSelection) {
    const pair = findPair(config.pairs, text);
    if (!pair) return false;
    if (inCode && MARKDOWN_ONLY_OPENS.has(pair[0])) return false;

    const [open, close] = pair;
    const selected = doc.sliceString(from, to);
    view.dispatch({
      changes: { from, to, insert: open + selected + close },
      selection: EditorSelection.range(
        from + open.length,
        from + open.length + selected.length,
      ),
      userEvent: "input.type",
    });
    return true;
  }

  if (from !== to) return false;

  const ghost = state.field(ghostPairField, false) ?? null;

  // Case 2: Active ghost pair interactions
  if (ghost && from === ghost.insertedFrom) {
    const interiorEmpty = ghost.matchedFrom + ghost.open.length === ghost.insertedFrom;

    // 2a. Upgrade 1-char empty pair -> 2-char pair (e.g. *|* + * -> **|**)
    if (interiorEmpty) {
      const upgradedOpen = ghost.open + text;
      const upgraded = findPair(config.pairs, upgradedOpen);
      if (upgraded && !(inCode && MARKDOWN_ONLY_OPENS.has(upgraded[0]))) {
        const [, upgradedClose] = upgraded;
        const extraClose = upgradedClose.slice(ghost.close.length);
        // Step 1: User's typed character
        view.dispatch({
          changes: { from, insert: text },
          selection: EditorSelection.cursor(from + 1),
          effects: setGhostPairEffect.of({
            matchedFrom: ghost.matchedFrom,
            matchedTo: from + 1,
            insertedFrom: from + 1,
            insertedTo: ghost.insertedTo + 1,
            open: upgradedOpen,
            close: ghost.close,
          }),
          userEvent: "input.type",
        });

        // Step 2: Isolated auto-inserted extra closing char
        if (extraClose.length > 0) {
          const insertAt = from + 1;
          view.dispatch({
            changes: { from: insertAt, insert: extraClose },
            selection: EditorSelection.cursor(insertAt),
            annotations: config.isolateUndo ? isolateHistory.of("before") : undefined,
            effects: setGhostPairEffect.of({
              matchedFrom: ghost.matchedFrom,
              matchedTo: insertAt,
              insertedFrom: insertAt,
              insertedTo: ghost.insertedTo + 1 + extraClose.length,
              open: upgradedOpen,
              close: upgradedClose,
            }),
            userEvent: "input.complete",
          });
        }
        return true;
      }
    }

    // 2b. Overtype-collapse: typing matching closing char skips over ghost without duplicating
    const remainingGhost = doc.sliceString(ghost.insertedFrom, ghost.insertedTo);
    if (remainingGhost.startsWith(text)) {
      const nextInsertedFrom = ghost.insertedFrom + text.length;
      const nextGhost: GhostPairState | null =
        nextInsertedFrom < ghost.insertedTo
          ? {
              ...ghost,
              matchedTo: nextInsertedFrom,
              insertedFrom: nextInsertedFrom,
            }
          : null;
      view.dispatch({
        selection: EditorSelection.cursor(nextInsertedFrom),
        effects: setGhostPairEffect.of(nextGhost),
        userEvent: "move",
      });
      return true;
    }
  }

  // Escape guard
  const beforeSlice = doc.sliceString(Math.max(0, from - 6), from);
  if (isEscaped(beforeSlice)) return false;

  const prevChar = from > 0 ? doc.sliceString(from - 1, from) : "";
  const nextChar = from < doc.length ? doc.sliceString(from, from + 1) : "";

  // Case 3: 2-char trigger whose 1-char prefix is NOT itself paired (e.g. ==, ~~)
  if (prevChar.length === 1 && !findPair(config.pairs, prevChar)) {
    const twoCharPair = findPair(config.pairs, prevChar + text);
    if (twoCharPair && !(inCode && MARKDOWN_ONLY_OPENS.has(twoCharPair[0]))) {
      if (nextChar && WORD_CHAR_RE.test(nextChar)) {
        return false;
      }
      const [open, close] = twoCharPair;
      const openStart = from - 1;

      view.dispatch({
        changes: { from, insert: text },
        selection: EditorSelection.cursor(from + 1),
        userEvent: "input.type",
      });

      const closePos = from + 1;
      view.dispatch({
        changes: { from: closePos, insert: close },
        selection: EditorSelection.cursor(closePos),
        annotations: config.isolateUndo ? isolateHistory.of("before") : undefined,
        effects: setGhostPairEffect.of({
          matchedFrom: openStart,
          matchedTo: closePos,
          insertedFrom: closePos,
          insertedTo: closePos + close.length,
          open,
          close,
        }),
        userEvent: "input.complete",
      });
      return true;
    }
  }

  // Case 4: Standard 1-char opening pair
  const pair = findPair(config.pairs, text);
  if (!pair) return false;
  const [open, close] = pair;

  if (inCode && MARKDOWN_ONLY_OPENS.has(open)) return false;

  // Word-boundary guards so foo_bar, don't, or *existingWord don't misfire
  if (SYMMETRIC_WORD_GUARD_OPENS.has(open)) {
    if (prevChar && LATIN_WORD_CHAR_RE.test(prevChar)) return false;
  }
  if (nextChar && WORD_CHAR_RE.test(nextChar)) {
    return false;
  }

  // Step 1: Insert user's opening delimiter as its own history entry
  view.dispatch({
    changes: { from, insert: open },
    selection: EditorSelection.cursor(from + open.length),
    userEvent: "input.type",
  });

  // Step 2: Insert ghost closing delimiter with isolateHistory.of("before")
  // Pressing Cmd+Z once will undo ONLY this step, preserving the user's typed opening delimiter!
  const closePos = from + open.length;
  view.dispatch({
    changes: { from: closePos, insert: close },
    selection: EditorSelection.cursor(closePos),
    annotations: config.isolateUndo ? isolateHistory.of("before") : undefined,
    effects: setGhostPairEffect.of({
      matchedFrom: from,
      matchedTo: closePos,
      insertedFrom: closePos,
      insertedTo: closePos + close.length,
      open,
      close,
    }),
    userEvent: "input.complete",
  });

  return true;
}

/**
 * Paired backspace (Ulysses performDeleteBackward -> discardAutomaticInsertion):
 * - In *|* -> deletes both * and * cleanly
 * - In **|** -> downgrades smoothly to *|* if 1-char pair exists, else deletes closing pair
 */
export function handleGhostBackspace(
  view: EditorView,
  config: GhostAutoPairConfig,
): boolean {
  if (!config.enabled) return false;
  const state = view.state;
  const sel = state.selection.main;
  if (!sel.empty) return false;

  const ghost = state.field(ghostPairField, false) ?? null;
  if (!ghost) return false;

  const pos = sel.head;
  const interiorEmpty = ghost.matchedFrom + ghost.open.length === ghost.insertedFrom;
  if (!interiorEmpty || pos !== ghost.insertedFrom || pos === 0) return false;

  // If 2-char pair whose 1-char prefix is also a valid pair (e.g. **|** -> *|*)
  if (ghost.open.length === 2 && ghost.close.length === 2) {
    const subOpen = ghost.open.slice(0, 1);
    const subPair = findPair(config.pairs, subOpen);
    if (subPair && subPair[1] === ghost.close.slice(1)) {
      view.dispatch({
        changes: [
          { from: pos - 1, to: pos },
          { from: ghost.insertedFrom, to: ghost.insertedFrom + 1 },
        ],
        selection: EditorSelection.cursor(pos - 1),
        effects: setGhostPairEffect.of({
          matchedFrom: ghost.matchedFrom,
          matchedTo: pos - 1,
          insertedFrom: pos - 1,
          insertedTo: pos,
          open: subPair[0],
          close: subPair[1],
        }),
        userEvent: "delete.backward",
      });
      return true;
    }
  }

  // Otherwise delete 1 char before caret + discard the entire ghost closing tag
  view.dispatch({
    changes: { from: pos - 1, to: ghost.insertedTo },
    selection: EditorSelection.cursor(pos - 1),
    effects: setGhostPairEffect.of(null),
    userEvent: "delete.backward",
  });
  return true;
}

export function ghostAutoPairExtension(config: GhostAutoPairConfig): Extension {
  if (!config.enabled) return [];

  return [
    ghostPairField,
    EditorView.inputHandler.of((view, from, to, text) =>
      handleGhostInput(view, from, to, text, config),
    ),
    Prec.high(
      keymap.of([
        {
          key: "Backspace",
          run: (view) => handleGhostBackspace(view, config),
        },
      ]),
    ),
    // Ensure non-edit transactions that move cursor outside autoMatchedRange commit cleanly
    EditorView.updateListener.of((update) => {
      if (update.transactions.some((t: Transaction) => t.effects.length > 0)) return;
    }),
  ];
}

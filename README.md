# Ulysses Feel for Obsidian

**English** | [简体中文](./README.zh-CN.md)

**One-plugin, out-of-the-box Ulysses writing experience for Obsidian** — built on a **zero-dependency portable CodeMirror 6 core** (`@writer/cm6-ulysses-core`) and a **100% non-invasive Obsidian adapter**.

Install this single plugin to bring Ulysses's calm, rock-steady writing ergonomics straight into Obsidian's Default Theme (Light & Dark) as well as Minimal and other community themes — no fragile plugin stacks, no monkey-patching, and zero residue when disabled.

---

## Highlights

| Capability | Details |
| :--- | :--- |
| **Zero-Jump Live Preview Syntax** | Mirrors Live Preview's hidden inline delimiters (`**`, `*`, `__`, `_`, `` ` ``, `~~`, `==`) with same-width muted ghost widgets and applies Frame-0 hanging outdent to `#`–`######` and `>` — **0px horizontal shift and zero word-wrap reflow** while keeping Live Preview tables, callouts, images, and Mermaid diagrams intact. |
| **Optical Typography & Laser Alignment** | Root-relative `64rch` reading measure (H1–H6 and body text align to the exact same pixel axis), `1.6` prose leading, `1.2` code-block leading cap, inverse heading leading, x-height normalization, restrained Ulysses heading scale, and CJK `text-autospace`. |
| **Perceptual Typewriter Scrolling** | Square-root animation timing (`duration = 15ms × √|Δy|`, EaseInEaseOut, backing-pixel snapped). Starts fresh sheets at the **upper 1/3 (`33%`)** and holds continuous writing inside an ergonomic eye-level comfort zone (**default `25%–55%`**, fully adjustable via sliders), plus Fixed `Top / Middle / Bottom` modes with wheel-to-caret control. |
| **Capsule Baseline Indicator** | Slim `fontSize / 6` rounded pill bar hugging the writing column beneath the active line (`0.15` Light / `0.20` Dark alpha, smooth blur fade) instead of shading the entire line box. |
| **Line / Sentence / Paragraph Focus Mode** | Dims unfocused text to `0.20` opacity with subtle desaturation; Sentence mode uses native `Intl.Segmenter` for accurate CJK + Latin sentence boundaries; inactive split panes dim to `0.33`. |
| **Undo-Safe Ghost Auto-Pairing** | Dual-range auto-pairing for `**`, `*`, `_`, `` ` ``, `==`, `~~`, brackets, and quotes with `isolateHistory.of("before")` so **1× `Cmd+Z` undoes only the closing delimiter**, `*`→`**` upgrade, overtype-collapse, paired backspace, and selection wrapping. |
| **Smart Keyboard Ergonomics** | Context-aware `Tab` / `Shift+Tab` (indents prose/lists from any column; inserts literal `\t` inside fenced code blocks), smart list/task/blockquote continuation with live ordered-list renumbering, Smart Home (`Home` / `Cmd+Left`), and OS smart-punctuation guard near Markdown triggers. |
| **Titleless Sheets & Ulysses Sheet List** | Create blank sheets (`New titleless sheet`) with caret immediately on line 1, silently auto-name newly created or untitled notes from their first body line (iCloud-safe debounced rename via official `fileManager.renameFile`, never touching existing user-named or daily notes), and browse notes in a **Ulysses-style Sheet List sidebar** (first-line title + 1–3 line excerpt + word count + folder filter). |
| **Standalone Ulysses Canvas** | Built-in scoped toggles for hiding `.inline-title`, hiding document scrollbars, auto-hiding the left ribbon whenever the left sidebar is collapsed, and optional **Distraction-Free Canvas** (hides tab bar, view header, and status bar with smooth top-edge hover reveal) — works out of the box on Obsidian's Default Theme. |
| **Auto-Localized UI & Nested Editor Safety** | Automatically follows Obsidian's UI language (**English** and **Chinese**), and cleanly isolates Live Preview table cells and embedded sub-editors so overscroll, outdent, and table navigation (`Tab` / `Enter`) never break. |

---

## Installation

### From Obsidian Community Plugins
Search for **Ulysses Feel** in **Settings → Community plugins → Browse** (once approved in the Community Directory).

### From GitHub Releases
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/AsIsacy/obsidian-ulysses-feel/releases).
2. Copy them into `<YourVault>/.obsidian/plugins/ulysses-feel/`.
3. Reload Obsidian and enable **Ulysses Feel** in **Settings → Community plugins**.

### Via BRAT
1. Install the **BRAT** plugin in Obsidian.
2. Select **Add Beta plugin** and paste: `https://github.com/AsIsacy/obsidian-ulysses-feel`.

### Build from Source
```bash
pnpm install
pnpm build
# Copy packages/obsidian-ulysses-feel/{main.js,manifest.json,styles.css}
# into <YourVault>/.obsidian/plugins/ulysses-feel/
```

---

## Recommended Setup & Hotkeys

- **Bind `Cmd+N` / `Ctrl+N` to Titleless Sheets**: In **Settings → Hotkeys**, bind **`Ulysses Feel: New titleless sheet`** to `Cmd+N` (macOS) or `Ctrl+N` (Windows/Linux) to start writing immediately on line 1 without filename friction.
- **Native Auto-Pair**: For single-step `Cmd+Z` undo of auto-inserted closing delimiters, turn off **Settings → Editor → Auto pair Markdown syntax** and **Auto pair brackets**.
- **Command Palette Commands** (search `Ulysses Feel`):
  - `New titleless sheet`
  - `Open sheet list sidebar`
  - `Cycle typewriter scroll mode`
  - `Cycle focus mode`
  - `Toggle distraction-free canvas`
  - `Toggle zero-jump inline syntax (Live Preview)`
  - `Toggle pure source mode`
  - `Sync current filename from first line`

---

## Architecture & Portability

```text
packages/
├── cm6-ulysses-core/        # Pure CodeMirror 6 extensions (ZERO Obsidian dependency)
│   ├── src/typewriter.ts        # Sqrt perceptual scroll, comfort band, fixed wheel control
│   ├── src/baseline-highlight.ts# fontSize/6 column-aligned capsule bar
│   ├── src/focus-mode.ts        # Line / Sentence (Intl.Segmenter) / Paragraph dimming
│   ├── src/ghost-autopair.ts    # Dual-range ghost pairs + isolateHistory single-step undo
│   ├── src/smart-editing.ts     # Context Tab, ordered list renumbering, Smart Home, markup guard
│   ├── src/hanging-outdent.ts   # Frame-0 text-indent outdent for headings & blockquotes
│   ├── src/zero-jump-syntax.ts  # Phase-2 Live Preview hidden-delimiter ghost mirroring
│   ├── src/sheet-title.ts       # Portable first-line title, excerpt & safe filename extractor
│   └── test/core.test.ts        # Vitest unit test suite
└── obsidian-ulysses-feel/   # Thin standard Obsidian plugin adapter
    ├── src/main.ts              # registerEditorExtension + updateOptions + commands
    ├── src/settings.ts          # Native PluginSettingTab
    ├── src/i18n.ts              # Automatic en / zh UI localization
    ├── src/titleless-sheets.ts  # Titleless creation + iCloud-safe debounced auto-renaming
    ├── src/sheet-list-view.ts   # Ulysses-style Sheet List ItemView sidebar
    └── styles.css               # Scoped strictly under body.ulysses-feel-enabled
```

You can also embed `@writer/cm6-ulysses-core` directly in any standalone Web, Electron, or Tauri CodeMirror 6 editor:

```ts
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createUlyssesExtension } from "@writer/cm6-ulysses-core";

const ulysses = createUlyssesExtension({
  typewriter: { mode: "variable", variableBandTop: 0.25, variableBandBottom: 0.55 },
  focusMode: { enabled: true, mode: "sentence" },
});

const view = new EditorView({
  state: EditorState.create({ doc: "# Hello Ulysses\n", extensions: [ulysses.extension] }),
  parent: document.body,
});
```

---

## Development

```bash
pnpm install
pnpm build       # Build @writer/cm6-ulysses-core & Obsidian main.js bundle
pnpm typecheck   # Strict TypeScript check across all packages
pnpm lint        # Run official eslint-plugin-obsidianmd rules
pnpm test        # Run Vitest unit tests
```

## License

[MIT](./LICENSE)

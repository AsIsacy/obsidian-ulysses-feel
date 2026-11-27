# Ulysses Feel for Obsidian

**One-plugin, out-of-the-box Ulysses writing experience for Obsidian** — built on a **zero-dependency portable CodeMirror 6 core** (`@writer/cm6-ulysses-core`) and a **100% non-invasive Obsidian adapter**.

> **开箱即用的 Obsidian × Ulysses 写作体验插件**：只装这一个插件，在 Obsidian 默认主题（浅色/深色）与 Minimal 等社区主题下即可一步获得 Ulysses 级别的无抖动输入手感、护颈打字机滚动、聚焦模式、无标题写作与文稿摘要侧边栏。核心引擎完全独立于 Obsidian，可直接复用到任意 CodeMirror 6 应用。

---

## Why Ulysses Feel? / 核心特性

Every interaction parameter is modeled directly after Ulysses's macOS writing engine while remaining 100% faithful to Obsidian's official plugin APIs (zero monkey-patching, zero private API hacks, zero residue on unload):

| Capability | Details |
| :--- | :--- |
| **Zero-Jump Live Preview Syntax** | Mirrors Live Preview's hidden inline delimiters (`**`, `*`, `__`, `_`, `` ` ``, `~~`, `==`) with same-width muted ghost widgets and applies Frame-0 hanging outdent to `#`–`######` and `>` — **0px horizontal shift and zero line-wrap reflow** while keeping Live Preview tables, callouts, images, and Mermaid diagrams intact. |
| **Optical Typography & Laser Alignment** | Root-relative `64rch` measure (`H1`–`H6` and prose align to the exact same left pixel axis), `1.6` prose leading, `1.2` code-block leading cap, inverse heading leading, x-height normalization, restrained Ulysses heading scale, and CJK `text-autospace`. |
| **Perceptual Typewriter Scrolling** | Square-root animation timing (`duration = 15ms × √|Δy|`, EaseInEaseOut, device-pixel snapped). Starts fresh sheets at the **upper 1/3 (`33%`)** and holds continuous writing inside an ergonomic eye-level comfort band (**default `25%–55%`** — configurable via sliders), plus Fixed `Top / Middle / Bottom` modes with wheel-to-caret control. |
| **Capsule Baseline Indicator** | Slim `fontSize / 6` rounded pill bar hugging the writing column beneath the active line (`0.15` Light / `0.20` Dark alpha, fades smoothly on blur) instead of shading the entire line box. |
| **Line / Sentence / Paragraph Focus Mode** | Dims unfocused text to `0.20` opacity with subtle desaturation; Sentence mode uses native `Intl.Segmenter` for accurate CJK + Latin sentence boundaries; inactive split panes dim to `0.33`. |
| **Undo-Safe Ghost Auto-Pairing** | Dual-range auto-pairing for `**`, `*`, `_`, `` ` ``, `==`, `~~`, brackets, and CJK quotes with `isolateHistory.of("before")` so **1× `Cmd+Z` undoes only the closing delimiter**, `*`→`**` upgrade, overtype-collapse, paired backspace, and selection wrapping. |
| **Smart Keyboard Ergonomics** | Context-aware `Tab` / `Shift+Tab` (indents prose/lists from any column; inserts literal `\t` inside fenced code blocks), smart list/task/blockquote continuation with live ordered-list renumbering, Smart Home (`Home` / `Cmd+Left`), and OS smart-punctuation guard near Markdown triggers. |
| **Titleless Sheets & Ulysses Sheet List** | Create blank sheets (`New Titleless Sheet`) with caret immediately on line 1, silently auto-name newly created / untitled notes from their first body line (iCloud-safe debounced rename via official `fileManager.renameFile`, never touching historical notes or daily notes), and browse notes in a **Ulysses-style Sheet List sidebar** (first-line title + 2-line preview + word count + folder filter). |
| **Standalone Ulysses Canvas** | Built-in scoped toggles for hiding `.inline-title`, hiding document scrollbars, and optional **Distraction-Free Canvas** (hide tab bar, view header, status bar with smooth top-edge hover reveal) — works out of the box on Obsidian's Default Theme without needing Minimal or Hider. |
| **Nested Sub-Editor Safety** | Automatically isolates Obsidian Live Preview table cells and embedded sub-editors so overscroll, hanging outdent, and table navigation (`Tab` / `Enter`) never break. |

---

## Installation / 安装方式

### Option 1: From GitHub Releases (Recommended)
1. Download `main.js`, `manifest.json`, and `styles.css` from the latest [GitHub Release](https://github.com/AsIsacy/obsidian-ulysses-feel/releases).
2. Copy them into `<YourVault>/.obsidian/plugins/ulysses-feel/`.
3. Restart/reload Obsidian and enable **Ulysses Feel** in **Settings → Community plugins**.

### Option 2: Via BRAT (Beta Reviewer's Auto-update Tool)
1. Install the **BRAT** plugin in Obsidian.
2. Click **Add Beta plugin** and paste this repository URL.

### Option 3: Build from Source
```bash
pnpm install
pnpm build
# Copy packages/obsidian-ulysses-feel/{main.js,manifest.json,styles.css}
# into <YourVault>/.obsidian/plugins/ulysses-feel/
```

---

## Recommended Hotkeys & Setup / 推荐快捷键与设置

- **New Titleless Sheet**: Bind `Cmd+N` (macOS) / `Ctrl+N` (Windows/Linux) to **`Ulysses Feel: New Titleless Sheet`** in **Settings → Hotkeys** for true Ulysses start-typing-immediately flow.
- **Native Auto-Pair**: Open **Settings → Ulysses Feel** — if Obsidian's built-in Auto-Pair Markdown/Brackets is enabled, a one-click banner lets you disable it cleanly so single-step `Cmd+Z` ghost undo works everywhere.
- **Quick Commands** (Command Palette → search `Ulysses`):
  - `New Titleless Sheet (Start Typing Immediately)`
  - `Open Ulysses Sheet List Panel`
  - `Cycle Typewriter Scroll Mode (Off / Variable / Top / Middle / Bottom)`
  - `Cycle Focus Mode (Off / Line / Sentence / Paragraph)`
  - `Toggle Distraction-Free Canvas (Hide Tabs, Header & Status Bar)`
  - `Toggle Zero-Jump Inline Syntax (Live Preview)`
  - `Toggle Pure Ulysses Source Mode`
  - `Sync Current Filename From First Line`

---

## Architecture / 架构与可迁移性

```text
packages/
├── cm6-ulysses-core/        # Pure CodeMirror 6 extensions (ZERO Obsidian dependency)
│   ├── src/typewriter.ts        # Sqrt perceptual scroll, comfort band, fixed wheel control
│   ├── src/baseline-highlight.ts# fontSize/6 column-aligned capsule bar
│   ├── src/focus-mode.ts        # Line / Sentence (Intl.Segmenter) / Paragraph dimming
│   ├── src/ghost-autopair.ts    # Dual-range ghost pairs + isolateHistory single-step undo
│   ├── src/smart-editing.ts     # Context Tab, ordered list renumbering, Smart Home, IME/markup guard
│   ├── src/hanging-outdent.ts   # Frame-0 text-indent outdent for headings & blockquotes
│   ├── src/zero-jump-syntax.ts  # Phase-2 Live Preview hidden-delimiter ghost mirroring
│   ├── src/sheet-title.ts       # Portable first-line title, excerpt & safe filename extractor
│   └── test/core.test.ts        # Vitest unit test suite
└── obsidian-ulysses-feel/   # Thin standard Obsidian plugin adapter
    ├── src/main.ts              # registerEditorExtension + updateOptions + commands
    ├── src/settings.ts          # Full PluginSettingTab with conflict helper
    ├── src/titleless-sheets.ts  # Titleless creation + iCloud-safe debounced auto-renaming
    ├── src/sheet-list-view.ts   # Ulysses-style Sheet List ItemView sidebar
    └── styles.css               # Scoped strictly under body.ulysses-feel-enabled
```

Use `@writer/cm6-ulysses-core` directly in any standalone Web, Electron, or Tauri CodeMirror 6 editor:

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

## Development / 开发与测试

```bash
pnpm install
pnpm build       # Build @writer/cm6-ulysses-core & Obsidian main.js bundle
pnpm typecheck   # Strict TypeScript check across all packages
pnpm test        # Run Vitest unit tests (16 tests)
```

## License

[MIT](./LICENSE)

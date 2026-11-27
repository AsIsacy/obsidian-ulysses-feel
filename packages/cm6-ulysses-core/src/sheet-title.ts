export interface SheetSummary {
  /** Clean human-readable title extracted from first non-empty body line (empty if blank) */
  title: string;
  /** Clean 1–3 line preview excerpt stripped of Markdown syntax */
  preview: string;
  /** Approximate Ulysses-style character/word count (CJK chars + Latin/numeric words) */
  wordCount: number;
  /** True when the note body has no visible content yet */
  isEmpty: boolean;
}

export interface ExtractSummaryOptions {
  maxTitleLength?: number;
  maxPreviewLength?: number;
  previewLines?: number;
}

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const HR_LINE_RE = /^\s*(?:[-*_]\s*){3,}$/;
const CODE_FENCE_RE = /^\s*(?:```|~~~)/;
const CALLOUT_HEADER_RE = /^>\s*\[![^\]]+\][+-]?\s*(.*)$/;

/**
 * Strip inline & block Markdown syntax from a single line to produce clean plain text
 * for Ulysses-style sheet titles and preview snippets.
 */
export function stripMarkdownLine(rawLine: string): string {
  let line = rawLine.trim();
  if (!line) return "";

  // Callout header: `> [!info] Title` -> `Title`
  const cm = CALLOUT_HEADER_RE.exec(line);
  if (cm) {
    line = (cm[1] ?? "").trim();
  } else {
    // Strip block prefixes: headings, blockquotes, task/unordered/ordered lists
    line = line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^(?:>\s*)+/, "")
      .replace(/^[-*+]\s+\[[ xX]\]\s+/, "")
      .replace(/^[-*+]\s+/, "")
      .replace(/^\d+[.)]\s+/, "");
  }

  // Strip HTML comments
  line = line.replace(/<!--[\s\S]*?-->/g, "");

  // Embedded images/files: `![alt](url)` -> `alt`, `![[file|alias]]` -> `alias`
  line = line.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1");
  line = line.replace(/!\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  line = line.replace(/!\[\[([^\]]+)\]\]/g, "");

  // Markdown links & wikilinks
  line = line.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  line = line.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  line = line.replace(/\[\[([^\]]+)\]\]/g, "$1");

  // Inline code, bold, italic, strikethrough, highlight (lookbehind-free for full iOS/mobile compatibility)
  line = line
    .replace(/`+([^`]+)`+/g, "$1")
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(~~|==)(.*?)\1/g, "$2")
    .replace(/(^|[^\w])(\*|_)(?!\s)([^\n]*?\S)\2(?=$|[^\w])/g, "$1$3")
    .replace(/(^|[^\w])(\*|_)(?!\s)([^\n]*?\S)\2(?=$|[^\w])/g, "$1$3");

  // Strip leftover unclosed leading/trailing emphasis or backticks and collapse spaces
  line = line.replace(/\s+/g, " ").trim();
  return line;
}

/**
 * Count words/characters in Ulysses style:
 * each CJK ideograph counts as 1, each contiguous Latin/digit token counts as 1.
 */
export function countSheetWords(markdown: string): number {
  const body = markdown.replace(FRONTMATTER_RE, "");
  const cjkMatches = body.match(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g);
  const latinMatches = body
    .replace(/[\u3400-\u9fff\uf900-\ufaff\u3040-\u30ff\uac00-\ud7af]/g, " ")
    .match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g);
  return (cjkMatches?.length ?? 0) + (latinMatches?.length ?? 0);
}

/**
 * Extract Ulysses-style Sheet title (first non-empty line), preview excerpt,
 * and word count from raw Markdown text. Zero framework/Obsidian dependencies.
 */
export function extractSheetSummary(
  markdown: string,
  options: ExtractSummaryOptions = {},
): SheetSummary {
  const maxTitleLength = options.maxTitleLength ?? 60;
  const maxPreviewLength = options.maxPreviewLength ?? 160;
  const maxPreviewLines = options.previewLines ?? 2;

  const body = markdown.replace(FRONTMATTER_RE, "");
  const lines = body.split(/\r?\n/);

  let title = "";
  const previewParts: string[] = [];
  let inCodeFence = false;

  for (const raw of lines) {
    if (CODE_FENCE_RE.test(raw)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    if (HR_LINE_RE.test(raw)) continue;

    // Skip markdown table separator rows like `| --- | --- |`
    if (/^\s*\|?(?:\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?\s*$/.test(raw)) continue;

    const clean = stripMarkdownLine(raw);
    if (!clean) continue;

    if (!title) {
      title = truncateCodePoints(clean, maxTitleLength);
    } else if (previewParts.length < maxPreviewLines) {
      previewParts.push(clean);
      if (previewParts.join(" ").length >= maxPreviewLength) {
        break;
      }
    } else {
      break;
    }
  }

  const previewRaw = previewParts.join(" ");
  const preview =
    previewRaw.length > maxPreviewLength
      ? `${truncateCodePoints(previewRaw, maxPreviewLength - 1)}…`
      : previewRaw;

  return {
    title,
    preview,
    wordCount: countSheetWords(markdown),
    isEmpty: title.length === 0,
  };
}

/**
 * Sanitize an extracted title string into a safe cross-platform / Obsidian / iCloud filename
 * (without `.md` extension).
 */
export function sanitizeFilenameFromTitle(title: string, maxLength = 42): string {
  if (!title) return "";

  // Remove Obsidian-forbidden and OS-forbidden filename characters: \ / : * ? " < > | # ^ [ ]
  let cleaned = title
    .replace(/[\\/:*?"<>|#^[\]]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Strip leading/trailing dots and hyphens (hidden files on macOS / invalid trailing dot on Windows)
  cleaned = cleaned.replace(/^[.\s-]+|[.\s]+$/g, "").trim();
  if (!cleaned) return "";

  return truncateCodePoints(cleaned, maxLength).trim().replace(/[.\s]+$/g, "");
}

const UNTITLED_BASENAME_RE =
  /^(?:Untitled(?:\s+\d+)?|未命名(?:\s*\d+)?|UL-\d{8}-\d{6}(?:-\d+)?|Sheet-\d{8}-\d{6}(?:-\d+)?)$/i;

/**
 * Returns true if a file basename is an Obsidian default untitled name (`Untitled`, `未命名`, etc.)
 * or a silent placeholder created by our Titleless Sheet workflow (`UL-YYYYMMDD-HHmmss`).
 * Explicitly returns false for user-named notes and daily notes (e.g. `2026-04-23`).
 */
export function isUntitledLikeBasename(basename: string): boolean {
  return UNTITLED_BASENAME_RE.test(basename.trim());
}

/**
 * Format a compact silent placeholder basename (`UL-YYYYMMDD-HHmmss`) for new titleless sheets.
 */
export function formatSilentSheetPlaceholder(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `UL-${y}${m}${d}-${hh}${mm}${ss}`;
}

function truncateCodePoints(str: string, maxLen: number): string {
  const chars = Array.from(str);
  if (chars.length <= maxLen) return str;
  return chars.slice(0, maxLen).join("");
}

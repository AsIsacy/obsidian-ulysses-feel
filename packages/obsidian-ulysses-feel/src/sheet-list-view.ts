import {
  ItemView,
  MarkdownView,
  Menu,
  TFile,
  TFolder,
  WorkspaceLeaf,
  setIcon,
} from "obsidian";
import {
  SheetSummary,
  extractSheetSummary,
  isUntitledLikeBasename,
} from "@writer/cm6-ulysses-core";
import type UlyssesFeelPlugin from "./main.js";
import { getActiveLocale, t } from "./i18n.js";

export const VIEW_TYPE_ULYSSES_SHEETS = "ulysses-sheet-list";

type SortMode = "mtime" | "ctime" | "title";

interface CachedSummaryEntry {
  mtime: number;
  previewLines: number;
  summary: SheetSummary;
}

interface SheetListItem {
  file: TFile;
  displayTitle: string;
  preview: string;
  wordCount: number;
  isEmpty: boolean;
  folderLabel: string;
}

/**
 * Ulysses-style Sheet List Sidebar View:
 * Displays notes by their live first-line content + multi-line excerpt + word count + relative time,
 * freeing the writer from filename friction while staying 100% native to Obsidian's Markdown vault.
 */
export class UlyssesSheetListView extends ItemView {
  private summaryCache = new Map<string, CachedSummaryEntry>();
  private selectedFolderPath = "__ALL__";
  private sortMode: SortMode = "mtime";
  private searchQuery = "";
  private renderTimer: number | null = null;
  private renderSeq = 0;

  private folderSelectEl: HTMLSelectElement | null = null;
  private sortBtnEl: HTMLButtonElement | null = null;
  private listEl: HTMLElement | null = null;
  private countEl: HTMLElement | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: UlyssesFeelPlugin,
  ) {
    super(leaf);
  }

  override getViewType(): string {
    return VIEW_TYPE_ULYSSES_SHEETS;
  }

  override getDisplayText(): string {
    return t("sheetListTitle");
  }

  override getIcon(): string {
    return "sheets-in-box";
  }

  override async onOpen(): Promise<void> {
    const container = this.containerEl.children[1] as HTMLElement | undefined;
    const root = container ?? this.containerEl;
    root.empty();
    root.addClass("ul-sheet-list-root");

    // --- Header Bar (Folder scope + Sort + New Titleless Sheet `+`) ---
    const header = root.createDiv({ cls: "ul-sheet-header" });

    this.folderSelectEl = header.createEl("select", {
      cls: "ul-sheet-folder-select dropdown",
      attr: { "aria-label": t("sheetFolderFilterAria") },
    });
    this.folderSelectEl.addEventListener("change", () => {
      this.selectedFolderPath = this.folderSelectEl?.value ?? "__ALL__";
      this.scheduleRender(0);
    });

    const actions = header.createDiv({ cls: "ul-sheet-header-actions" });

    this.sortBtnEl = actions.createEl("button", {
      cls: "clickable-icon ul-sheet-icon-btn",
      attr: { "aria-label": t("sheetSortMtimeAria") },
    });
    setIcon(this.sortBtnEl, "arrow-down-wide-narrow");
    this.sortBtnEl.addEventListener("click", () => {
      this.sortMode =
        this.sortMode === "mtime"
          ? "ctime"
          : this.sortMode === "ctime"
            ? "title"
            : "mtime";
      this.updateSortTooltip();
      this.scheduleRender(0);
    });

    const newBtn = actions.createEl("button", {
      cls: "clickable-icon ul-sheet-icon-btn ul-sheet-new-btn",
      attr: { "aria-label": t("sheetNewAria") },
    });
    setIcon(newBtn, "square-pen");
    newBtn.addEventListener("click", () => {
      const folder = this.getSelectedFolder();
      void this.plugin.titlelessSheets.createTitlelessSheet(folder);
    });

    // --- Quick Filter Search Box ---
    const searchRow = root.createDiv({ cls: "ul-sheet-search-row" });
    const searchInput = searchRow.createEl("input", {
      type: "search",
      cls: "ul-sheet-search-input",
      placeholder: t("sheetSearchPlaceholder"),
    });
    searchInput.addEventListener("input", () => {
      this.searchQuery = searchInput.value.trim().toLowerCase();
      this.scheduleRender(120);
    });

    this.countEl = root.createDiv({ cls: "ul-sheet-meta-bar" });
    this.listEl = root.createDiv({ cls: "ul-sheet-cards" });

    // --- Live Vault & Workspace Event Wiring ---
    this.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.summaryCache.delete(file.path);
          this.scheduleRender(260);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("create", (file) => {
        if (file instanceof TFile && file.extension === "md") {
          this.populateFolderDropdown();
          this.scheduleRender(120);
        }
      }),
    );

    this.registerEvent(
      this.app.vault.on("delete", (file) => {
        this.summaryCache.delete(file.path);
        this.populateFolderDropdown();
        this.scheduleRender(120);
      }),
    );

    this.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        this.summaryCache.delete(oldPath);
        if (file instanceof TFile) {
          this.summaryCache.delete(file.path);
        }
        this.populateFolderDropdown();
        this.scheduleRender(120);
      }),
    );

    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        this.updateActiveCardHighlight();
      }),
    );

    this.populateFolderDropdown();
    this.updateSortTooltip();
    await this.renderSheets();
  }

  override async onClose(): Promise<void> {
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
      this.renderTimer = null;
    }
    this.summaryCache.clear();
  }

  refresh(): void {
    this.summaryCache.clear();
    this.populateFolderDropdown();
    this.scheduleRender(0);
  }

  private updateSortTooltip(): void {
    if (!this.sortBtnEl) return;
    const label =
      this.sortMode === "mtime"
        ? t("sheetSortMtimeAria")
        : this.sortMode === "ctime"
          ? t("sheetSortCtimeAria")
          : t("sheetSortTitleAria");
    this.sortBtnEl.setAttribute("aria-label", label);
  }

  private getSelectedFolder(): TFolder | null {
    if (this.selectedFolderPath === "__ALL__") return null;
    if (this.selectedFolderPath === "__ROOT__") return this.app.vault.getRoot();
    const af = this.app.vault.getAbstractFileByPath(this.selectedFolderPath);
    return af instanceof TFolder ? af : null;
  }

  private populateFolderDropdown(): void {
    const select = this.folderSelectEl;
    if (!select) return;

    const prev = this.selectedFolderPath;
    select.empty();

    select.createEl("option", { value: "__ALL__", text: t("sheetAllNotes") });
    select.createEl("option", { value: "__ROOT__", text: t("sheetRootFolder") });

    const folders: TFolder[] = [];
    for (const af of this.app.vault.getAllLoadedFiles()) {
      if (af instanceof TFolder && !af.isRoot()) {
        folders.push(af);
      }
    }
    const sortLocale = getActiveLocale() === "zh" ? "zh-CN" : "en";
    folders.sort((a, b) => a.path.localeCompare(b.path, sortLocale));

    for (const f of folders) {
      select.createEl("option", { value: f.path, text: f.path });
    }

    const stillExists =
      prev === "__ALL__" ||
      prev === "__ROOT__" ||
      folders.some((f) => f.path === prev);
    this.selectedFolderPath = stillExists ? prev : "__ALL__";
    select.value = this.selectedFolderPath;
  }

  private scheduleRender(delayMs: number): void {
    if (this.renderTimer !== null) {
      window.clearTimeout(this.renderTimer);
    }
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.renderSheets();
    }, delayMs);
  }

  private async getSummary(file: TFile): Promise<SheetSummary> {
    const previewLines = this.plugin.settings.sheetListPreviewLines;
    const cached = this.summaryCache.get(file.path);
    if (
      cached &&
      cached.mtime === file.stat.mtime &&
      cached.previewLines === previewLines
    ) {
      return cached.summary;
    }

    const raw = await this.app.vault.cachedRead(file);
    const summary = extractSheetSummary(raw, {
      maxTitleLength: 64,
      maxPreviewLength: previewLines * 70,
      previewLines,
    });
    this.summaryCache.set(file.path, {
      mtime: file.stat.mtime,
      previewLines,
      summary,
    });
    return summary;
  }

  private async renderSheets(): Promise<void> {
    const listEl = this.listEl;
    if (!listEl) return;
    const seq = ++this.renderSeq;

    let files = this.app.vault.getMarkdownFiles();
    if (this.selectedFolderPath === "__ROOT__") {
      files = files.filter((f) => !f.parent || f.parent.isRoot());
    } else if (this.selectedFolderPath !== "__ALL__") {
      const prefix = `${this.selectedFolderPath}/`;
      files = files.filter(
        (f) => f.parent?.path === this.selectedFolderPath || f.path.startsWith(prefix),
      );
    }

    // Pre-sort by mtime/ctime before reading content so UI feels snappy
    if (this.sortMode === "mtime") {
      files = [...files].sort((a, b) => b.stat.mtime - a.stat.mtime);
    } else if (this.sortMode === "ctime") {
      files = [...files].sort((a, b) => b.stat.ctime - a.stat.ctime);
    }

    const items: SheetListItem[] = await Promise.all(
      files.map(async (file) => {
        const summary = await this.getSummary(file);
        const displayTitle = summary.title
          ? summary.title
          : isUntitledLikeBasename(file.basename)
            ? t("sheetUntitledFallback")
            : file.basename;
        const folderLabel =
          file.parent && !file.parent.isRoot() ? file.parent.path : "";
        return {
          file,
          displayTitle,
          preview: summary.preview,
          wordCount: summary.wordCount,
          isEmpty: summary.isEmpty,
          folderLabel,
        };
      }),
    );

    if (seq !== this.renderSeq) return;

    let filtered = items;
    if (this.searchQuery) {
      const q = this.searchQuery;
      filtered = items.filter(
        (it) =>
          it.displayTitle.toLowerCase().includes(q) ||
          it.preview.toLowerCase().includes(q) ||
          it.file.basename.toLowerCase().includes(q),
      );
    }

    if (this.sortMode === "title") {
      const sortLocale = getActiveLocale() === "zh" ? "zh-CN" : "en";
      filtered.sort((a, b) =>
        a.displayTitle.localeCompare(b.displayTitle, sortLocale),
      );
    }

    if (this.countEl) {
      const sortLabel =
        this.sortMode === "mtime"
          ? t("sheetSortMtimeShort")
          : this.sortMode === "ctime"
            ? t("sheetSortCtimeShort")
            : t("sheetSortTitleShort");
      this.countEl.setText(`${filtered.length} ${t("sheetCountSuffix")} · ${sortLabel}`);
    }

    listEl.empty();
    const activePath = this.app.workspace.getActiveFile()?.path ?? null;

    if (filtered.length === 0) {
      const empty = listEl.createDiv({ cls: "ul-sheet-empty" });
      empty.setText(this.searchQuery ? t("sheetEmptySearch") : t("sheetEmptyFolder"));
      return;
    }

    const previewLineClamp = String(this.plugin.settings.sheetListPreviewLines);

    for (const item of filtered) {
      const card = listEl.createDiv({
        cls: "ul-sheet-card",
        attr: { "data-path": item.file.path },
      });
      if (item.file.path === activePath) {
        card.addClass("is-active");
      }
      if (item.isEmpty) {
        card.addClass("is-empty-sheet");
      }

      const titleEl = card.createDiv({ cls: "ul-sheet-card-title" });
      titleEl.setText(item.displayTitle);

      if (item.preview) {
        const previewEl = card.createDiv({
          cls: `ul-sheet-card-preview ul-clamp-${previewLineClamp}`,
        });
        previewEl.setText(item.preview);
      }

      const footer = card.createDiv({ cls: "ul-sheet-card-meta" });
      footer.createSpan({
        cls: "ul-sheet-card-time",
        text: formatRelativeTime(item.file.stat.mtime),
      });

      if (this.selectedFolderPath === "__ALL__" && item.folderLabel) {
        footer.createSpan({
          cls: "ul-sheet-card-folder",
          text: item.folderLabel,
        });
      }

      footer.createSpan({
        cls: "ul-sheet-card-words",
        text: `${item.wordCount} ${t("sheetWordsSuffix")}`,
      });

      card.addEventListener("click", (evt) => {
        const openInNewTab = evt.metaKey || evt.ctrlKey;
        const leaf = this.app.workspace.getLeaf(openInNewTab);
        void leaf.openFile(item.file).then(() => {
          if (leaf.view instanceof MarkdownView && leaf.view.editor) {
            leaf.view.editor.focus();
          }
        });
      });

      card.addEventListener("contextmenu", (evt) => {
        evt.preventDefault();
        const menu = new Menu();
        menu.addItem((mi) =>
          mi
            .setTitle(t("sheetMenuOpenNewTab"))
            .setIcon("file-plus")
            .onClick(() => {
              void this.app.workspace.getLeaf(true).openFile(item.file);
            }),
        );
        menu.addItem((mi) =>
          mi
            .setTitle(t("sheetMenuSyncFilename"))
            .setIcon("pencil")
            .onClick(async () => {
              const leaf = this.app.workspace.getLeaf(false);
              await leaf.openFile(item.file);
              await this.plugin.titlelessSheets.syncActiveFileFromFirstLine();
            }),
        );
        menu.addSeparator();
        menu.addItem((mi) =>
          mi
            .setTitle(t("sheetMenuTrash"))
            .setIcon("trash")
            .onClick(() => {
              void this.app.fileManager.trashFile(item.file);
            }),
        );
        menu.showAtMouseEvent(evt);
      });
    }
  }

  private updateActiveCardHighlight(): void {
    if (!this.listEl) return;
    const activePath = this.app.workspace.getActiveFile()?.path ?? null;
    const cards = this.listEl.querySelectorAll<HTMLElement>(".ul-sheet-card");
    for (const card of cards) {
      card.classList.toggle("is-active", card.dataset.path === activePath);
    }
  }
}

function formatRelativeTime(mtime: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - mtime) / 1000));
  if (diffSec < 60) return t("timeJustNow");
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}${t("timeMinAgo")}`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}${t("timeHrAgo")}`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return t("timeYesterday");
  if (diffDay < 7) return `${diffDay}${t("timeDayAgo")}`;
  const d = new Date(mtime);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

import { App, MarkdownView, Notice, TFile, TFolder, normalizePath } from "obsidian";
import {
  extractSheetSummary,
  formatSilentSheetPlaceholder,
  isUntitledLikeBasename,
  sanitizeFilenameFromTitle,
} from "@writer/cm6-ulysses-core";
import type UlyssesFeelPlugin from "./main.js";
import { t } from "./i18n.js";

/**
 * Manages Ulysses-style Titleless Sheet creation and iCloud-safe automatic
 * first-line filename syncing (strictly scoped to newly created & untitled notes;
 * never touches existing user-named notes or daily notes).
 */
export class TitlelessSheetManager {
  /** Paths of notes created/opened as untitled during this session */
  private managedPaths = new Set<string>();
  /** Paths currently being renamed internally (distinguishes auto-rename from manual user rename) */
  private internalRenameTargets = new Set<string>();
  /** Debounced rename timers keyed by file path */
  private pendingTimers = new Map<string, number>();
  /** Track previously active file so we can flush pending rename cleanly when switching notes */
  private lastActiveFilePath: string | null = null;

  constructor(
    private readonly app: App,
    private readonly plugin: UlyssesFeelPlugin,
  ) {}

  /**
   * Register vault & workspace listeners via plugin.registerEvent for 100% clean teardown.
   */
  register(): void {
    // 1. Track newly opened untitled notes (e.g. from Obsidian's own Cmd+N creating "未命名.md")
    this.plugin.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        const prevPath = this.lastActiveFilePath;
        const nextFile =
          leaf?.view instanceof MarkdownView ? leaf.view.file : null;
        this.lastActiveFilePath = nextFile?.path ?? null;

        // Flush any pending auto-rename on the note the user just left
        if (prevPath && prevPath !== this.lastActiveFilePath) {
          this.flushRename(prevPath);
        }

        if (nextFile && isUntitledLikeBasename(nextFile.basename)) {
          this.managedPaths.add(nextFile.path);
        }
      }),
    );

    // 2. Schedule debounced rename when an active managed/untitled file is modified
    this.plugin.registerEvent(
      this.app.vault.on("modify", (file) => {
        if (!(file instanceof TFile) || file.extension !== "md") return;
        if (!this.plugin.settings.autoTitleUntitledSheets) return;

        if (isUntitledLikeBasename(file.basename)) {
          this.managedPaths.add(file.path);
        }
        if (!this.managedPaths.has(file.path)) return;

        this.scheduleRename(file.path);
      }),
    );

    // 3. Track renames: keep managedPaths synced on internal renames; stop managing if user renames manually!
    this.plugin.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile)) return;

        const timer = this.pendingTimers.get(oldPath);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          this.pendingTimers.delete(oldPath);
        }

        if (this.lastActiveFilePath === oldPath) {
          this.lastActiveFilePath = file.path;
        }

        if (this.internalRenameTargets.has(file.path)) {
          // Our own auto-rename completed -> keep managing during this writing session
          this.internalRenameTargets.delete(file.path);
          this.managedPaths.delete(oldPath);
          this.managedPaths.add(file.path);
        } else {
          // User manually renamed this file -> respect their custom name and stop auto-renaming!
          this.managedPaths.delete(oldPath);
          if (isUntitledLikeBasename(file.basename)) {
            this.managedPaths.add(file.path);
          }
        }
      }),
    );

    // 4. Clean up deleted files
    this.plugin.registerEvent(
      this.app.vault.on("delete", (file) => {
        const timer = this.pendingTimers.get(file.path);
        if (timer !== undefined) {
          window.clearTimeout(timer);
          this.pendingTimers.delete(file.path);
        }
        this.managedPaths.delete(file.path);
        if (this.lastActiveFilePath === file.path) {
          this.lastActiveFilePath = null;
        }
      }),
    );
  }

  /**
   * Create a blank titleless sheet with a silent placeholder filename,
   * open it in the editor, and place focus directly on line 1 column 0
   * (zero filename prompt, zero title-box interruption).
   */
  async createTitlelessSheet(targetFolder?: TFolder | null): Promise<TFile> {
    const activeFile = this.app.workspace.getActiveFile();
    const folder =
      targetFolder ??
      this.app.fileManager.getNewFileParent(activeFile?.path ?? "");

    const placeholderBase = formatSilentSheetPlaceholder(new Date());
    const targetPath = this.resolveUniquePath(folder, placeholderBase);

    const file = await this.app.vault.create(targetPath, "");
    this.managedPaths.add(file.path);

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(file, {
      active: true,
      state: { mode: "source" },
    });

    // Place caret directly into body line 0, col 0 (like Ulysses Cmd+N!)
    window.requestAnimationFrame(() => {
      const view = leaf.view;
      if (view instanceof MarkdownView && view.editor) {
        view.editor.focus();
        view.editor.setCursor({ line: 0, ch: 0 });
      }
    });

    return file;
  }

  /**
   * One-shot manual command to sync any active note's filename from its first body line.
   */
  async syncActiveFileFromFirstLine(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file || file.extension !== "md") {
      new Notice(t("noticeNoActiveNote"));
      return;
    }

    const renamed = await this.syncFileFilename(file, true);
    if (renamed) {
      new Notice(`${t("noticeRenamedTo")} "${renamed}"`);
    } else {
      new Notice(t("noticeAlreadySynced"));
    }
  }

  dispose(): void {
    for (const timer of this.pendingTimers.values()) {
      window.clearTimeout(timer);
    }
    this.pendingTimers.clear();
    this.managedPaths.clear();
    this.internalRenameTargets.clear();
  }

  private scheduleRename(filePath: string): void {
    const prev = this.pendingTimers.get(filePath);
    if (prev !== undefined) {
      window.clearTimeout(prev);
    }
    const delay = Math.max(600, this.plugin.settings.autoTitleDebounceMs);
    const timer = window.setTimeout(() => {
      this.pendingTimers.delete(filePath);
      void this.performAutoRenameByPath(filePath);
    }, delay);
    this.pendingTimers.set(filePath, timer);
  }

  private flushRename(filePath: string): void {
    const timer = this.pendingTimers.get(filePath);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      this.pendingTimers.delete(filePath);
      void this.performAutoRenameByPath(filePath);
    }
  }

  private async performAutoRenameByPath(filePath: string): Promise<void> {
    if (!this.plugin.settings.autoTitleUntitledSheets) return;
    const abstract = this.app.vault.getAbstractFileByPath(filePath);
    if (!(abstract instanceof TFile) || abstract.extension !== "md") return;
    if (!this.managedPaths.has(abstract.path) && !isUntitledLikeBasename(abstract.basename)) {
      return;
    }
    await this.syncFileFilename(abstract, false);
  }

  private async syncFileFilename(
    file: TFile,
    forceEvenIfNotManaged: boolean,
  ): Promise<string | null> {
    if (!forceEvenIfNotManaged && !this.managedPaths.has(file.path)) {
      return null;
    }

    const content = await this.app.vault.cachedRead(file);
    const summary = extractSheetSummary(content, {
      maxTitleLength: this.plugin.settings.autoTitleMaxLength,
    });
    if (summary.isEmpty) return null;

    const desiredBase = sanitizeFilenameFromTitle(
      summary.title,
      this.plugin.settings.autoTitleMaxLength,
    );
    if (!desiredBase || desiredBase === file.basename) {
      return null;
    }

    const parent = file.parent ?? this.app.vault.getRoot();
    const newPath = this.resolveUniquePath(parent, desiredBase, file.path);
    if (newPath === file.path) return null;

    // Mark target path as internal so vault.on("rename") knows this wasn't a manual user rename
    if (this.managedPaths.has(file.path)) {
      this.internalRenameTargets.add(newPath);
    }

    try {
      await this.app.fileManager.renameFile(file, newPath);
      return desiredBase;
    } catch {
      this.internalRenameTargets.delete(newPath);
      return null;
    }
  }

  private resolveUniquePath(
    folder: TFolder,
    desiredBasename: string,
    ignoreCurrentPath?: string,
  ): string {
    const prefix = folder.isRoot() ? "" : `${folder.path}/`;
    const candidate = normalizePath(`${prefix}${desiredBasename}.md`);
    if (
      candidate === ignoreCurrentPath ||
      !this.app.vault.getAbstractFileByPath(candidate)
    ) {
      return candidate;
    }

    for (let i = 2; i < 1000; i++) {
      const next = normalizePath(`${prefix}${desiredBasename} ${i}.md`);
      if (
        next === ignoreCurrentPath ||
        !this.app.vault.getAbstractFileByPath(next)
      ) {
        return next;
      }
    }

    return normalizePath(`${prefix}${desiredBasename} ${Date.now()}.md`);
  }
}

import { getLanguage, moment, requireApiVersion } from "obsidian";

export type SupportedLocale = "en" | "zh";

const EN = {
  // Ribbon & Views
  ribbonOpenSheetList: "Open Ulysses sheet list",
  sheetListTitle: "Ulysses sheets",

  // Status bar
  statusBarAria: "Click to cycle focus mode · Shift+Click to cycle typewriter mode",

  // Commands
  cmdCycleTypewriter: "Cycle typewriter scroll mode",
  cmdCycleFocus: "Cycle focus mode",
  cmdToggleBaseline: "Toggle capsule baseline highlight",
  cmdToggleOutdent: "Toggle hanging outdent markup",
  cmdToggleZeroJump: "Toggle zero-jump inline syntax (Live Preview)",
  cmdNewTitlelessSheet: "New titleless sheet",
  cmdOpenSheetList: "Open sheet list sidebar",
  cmdSyncFilename: "Sync current filename from first line",
  cmdToggleDistractionFree: "Toggle distraction-free canvas",
  cmdTogglePureSource: "Toggle pure source mode",

  // Notices
  noticeTypewriter: "Typewriter mode:",
  noticeFocus: "Focus mode:",
  noticeBaseline: "Baseline highlight:",
  noticeOutdent: "Hanging outdent:",
  noticeZeroJump: "Zero-jump inline syntax:",
  noticeDistractionFree: "Distraction-free canvas:",
  noticePureSourceOn: "Switched to pure source mode",
  noticePureSourceOff: "Switched back to Live Preview",
  noticeOn: "on",
  noticeOff: "off",
  noticeNoActiveNote: "No active Markdown note to sync.",
  noticeRenamedTo: "Renamed to",
  noticeAlreadySynced: "Filename already matches first line (or note is empty).",

  // Settings headings
  secTypewriter: "Typewriter scrolling and baseline indicator",
  secFocus: "Focus mode",
  secTyping: "Ghost auto-pairing and keyboard ergonomics",
  secTypography: "Hanging outdent and optical typography",
  secCanvas: "Standalone canvas",
  secTitleless: "Titleless sheets and sheet list",

  // Settings: Typewriter
  setTwEnableName: "Enable typewriter scrolling",
  setTwEnableDesc: "Ulysses perceptual scroll: duration = 15ms × √|Δy| with EaseInEaseOut.",
  setTwModeName: "Scroll anchor mode",
  setTwModeDesc:
    "Variable starts at upper 1/3 and holds typing inside your eye-level comfort band (default 25%–55%); Top, Middle, and Bottom lock strictly to 30%, 50%, and 70%.",
  optTwVariable: "Variable (upper 1/3 to eye-level center)",
  optTwMiddle: "Fixed middle (strict 50% lock)",
  optTwTop: "Fixed top (30%)",
  optTwBottom: "Fixed bottom (70%)",
  optTwOff: "Off",
  setTwTopStartName: "First-line starting position (%)",
  setTwTopStartDesc: "Where line 1 sits on a fresh sheet (default: 33% upper third of viewport).",
  setTwBandTopName: "Variable comfort zone ceiling (%)",
  setTwBandTopDesc: "Upper trigger line before scrolling down (default: 25%).",
  setTwBandBottomName: "Variable comfort zone floor (%)",
  setTwBandBottomDesc:
    "Lowest vertical position before smoothly scrolling upward (default: 55% eye-level center).",
  setTwAnimateName: "Smooth perceptual animation",
  setTwAnimateDesc: "Animate scroll position with backing-pixel snapping.",
  setTwOverscrollName: "Overscroll top and bottom padding",
  setTwOverscrollDesc: "Allow the very first and last lines of a note to rest at the focal anchor.",
  setTwWheelName: "Wheel moves caret in fixed modes",
  setTwWheelDesc:
    "In Top, Middle, and Bottom modes, scrolling moves the caret line by line without fighting the lock.",
  setBaselineName: "Slim capsule baseline highlight",
  setBaselineDesc:
    "Draw Ulysses's fontSize/6 pill bar beneath the active line instead of shading the full line.",

  // Settings: Focus
  setFocusModeName: "Focus granularity",
  setFocusModeDesc:
    "Dim unfocused text to 20% opacity (Line, Sentence via Intl.Segmenter, or Paragraph).",
  optFocusOff: "Off",
  optFocusLine: "Line",
  optFocusSentence: "Sentence",
  optFocusParagraph: "Paragraph",
  setFocusOpacityName: "Unfocused opacity",
  setFocusOpacityDesc: "Ulysses default is 0.20.",

  // Settings: Ghost auto-pairing & Smart editing
  setGhostPairName: "Ghost auto-pairing",
  setGhostPairDesc:
    "Auto-pair **, _, `, ==, ~~, brackets, and quotes with overtype-collapse, paired backspace, and 1× Cmd+Z undo of the closing delimiter. Tip: disable Editor → Auto pair Markdown syntax and Auto pair brackets for clean single-step undo.",
  setContextTabName: "Context-aware Tab and Shift+Tab",
  setContextTabDesc:
    "Indent or outdent the whole paragraph or list from any cursor column in prose; insert a literal tab inside code blocks.",
  setSmartListName: "Smart list continuation and auto-renumbering",
  setSmartListDesc:
    "Continue bullets, tasks, numbers, and quotes on Enter, exit on empty items, and renumber following ordered items automatically.",
  setSmartHomeName: "Smart home (Home / Cmd+Left)",
  setSmartHomeDesc: "Toggle between the start of content (after #, -, 1., >) and column 0.",
  setProtectMarkupName: "Protect markup from OS smart punctuation",
  setProtectMarkupDesc:
    "Prevent smart dash or quote substitution inside code blocks or when typing ----, '', or ++.",

  // Settings: Hanging outdent & typography
  setOutdentName: "Hanging outdent for headings and blockquotes",
  setOutdentDesc:
    "Pull active # and > markers into the left margin so heading text stays steady with zero horizontal jump.",
  setInactiveMarkersName: "Show subtle heading markers on inactive lines (Live Preview)",
  setInactiveMarkersDesc:
    "Display quiet muted #, ##, and ### cues in the left margin of inactive Live Preview headings.",
  setZeroJumpName: "Zero-jump inline syntax (Live Preview)",
  setZeroJumpDesc:
    "Keep muted ghost syntax markers (**, *, _, `, ~~, ==) visible when Live Preview hides them, preventing horizontal line jitter and word-wrap reflow.",
  setMutedSyntaxName: "Three-channel muted syntax tokens",
  setMutedSyntaxDesc:
    "Keep Markdown formatting tokens calm and low-contrast while body text stays crisp.",
  setTypographyName: "Optical typography overrides",
  setTypographyDesc:
    "64ch reading measure, 1.6 prose line-height, 1.2 code-block line-height cap, inverse heading leading, and x-height normalization.",
  setMeasureName: "Reading measure (characters per line)",
  setMeasureDesc: "Ulysses default: 64.",
  setHeadingScaleName: "Restrained Ulysses heading scale",
  setHeadingScaleDesc:
    "Use Ulysses's refined H1–H6 scale (1.35em to 0.96em) so headings stay balanced across themes.",
  setCjkSpacingName: "CJK and mixed-script optical spacing",
  setCjkSpacingDesc:
    "Enable CSS text-autospace and subtle 0.025em tracking for crisp CJK and Latin typography.",
  setDimInactiveName: "Dim inactive split panes",
  setDimInactiveDesc: "Dim unfocused split editors to 33% opacity.",

  // Settings: Standalone canvas
  setHideInlineTitleName: "Hide inline filename title",
  setHideInlineTitleDesc:
    "Hide the inline filename header inside notes via scoped CSS for pure titleless writing.",
  setHideScrollbarsName: "Hide editor scrollbars",
  setHideScrollbarsDesc: "Keep a clean paper-like writing canvas without scrollbars.",
  setDistractionFreeName: "Distraction-free canvas",
  setDistractionFreeDesc:
    "Hide the tab bar, view header breadcrumb, and status bar (hover top edge to reveal).",

  // Settings: Titleless sheets & Sheet list
  setAutoTitleName: "Auto-name new or untitled sheets from first line",
  setAutoTitleDesc:
    "Silently rename newly created or untitled notes using their first non-empty body line. Existing user-named notes and daily notes are never touched.",
  setAutoTitleDelayName: "Auto-rename delay (ms)",
  setAutoTitleDelayDesc:
    "Wait this many milliseconds after typing stops (or immediately on switching notes) before renaming on disk.",
  setAutoTitleMaxLenName: "Maximum auto-generated filename length",
  setAutoTitleMaxLenDesc: "Long first lines are cleanly truncated to this character limit.",
  setPreviewLinesName: "Sheet list preview lines",
  setPreviewLinesDesc:
    "Number of excerpt lines shown below the first-line title in the sheet list sidebar.",
  optPreview1: "1 line",
  optPreview2: "2 lines (Ulysses default)",
  optPreview3: "3 lines",
  setStatusBarName: "Show status bar indicator",
  setStatusBarDesc: "Quick-toggle typewriter and focus modes from the status bar.",

  // Sheet list UI
  sheetFolderFilterAria: "Filter folder",
  sheetAllNotes: "All sheets",
  sheetRootFolder: "Vault root",
  sheetNewAria: "New titleless sheet",
  sheetSearchPlaceholder: "Filter by first line or excerpt…",
  sheetSortMtimeAria: "Sort: modified time (click to cycle)",
  sheetSortCtimeAria: "Sort: created time (click to cycle)",
  sheetSortTitleAria: "Sort: first-line title (click to cycle)",
  sheetSortMtimeShort: "modified",
  sheetSortCtimeShort: "created",
  sheetSortTitleShort: "title",
  sheetCountSuffix: "sheets",
  sheetEmptySearch: "No matching sheets",
  sheetEmptyFolder: "No sheets yet — click top right to create one",
  sheetUntitledFallback: "Empty sheet",
  sheetWordsSuffix: "words",
  sheetMenuOpenNewTab: "Open in new tab",
  sheetMenuSyncFilename: "Sync filename from first line",
  sheetMenuTrash: "Delete sheet",
  timeJustNow: "Just now",
  timeMinAgo: "m ago",
  timeHrAgo: "h ago",
  timeYesterday: "Yesterday",
  timeDayAgo: "d ago",
} as const;

export type I18nKey = keyof typeof EN;

const ZH: Record<I18nKey, string> = {
  // Ribbon & Views
  ribbonOpenSheetList: "打开 Ulysses 文稿列表",
  sheetListTitle: "Ulysses 文稿",

  // Status bar
  statusBarAria: "点击切换聚焦模式 · Shift+点击切换打字机模式",

  // Commands
  cmdCycleTypewriter: "切换打字机滚动模式",
  cmdCycleFocus: "切换聚焦模式",
  cmdToggleBaseline: "开关胶囊基线高亮",
  cmdToggleOutdent: "开关悬挂外凸语法",
  cmdToggleZeroJump: "开关零抖动行内语法（Live Preview）",
  cmdNewTitlelessSheet: "新建无标题文稿",
  cmdOpenSheetList: "打开文稿列表侧边栏",
  cmdSyncFilename: "按正文首行同步当前文件名",
  cmdToggleDistractionFree: "开关极简专注画布",
  cmdTogglePureSource: "切换纯源码零跳动模式",

  // Notices
  noticeTypewriter: "打字机模式：",
  noticeFocus: "聚焦模式：",
  noticeBaseline: "胶囊基线高亮：",
  noticeOutdent: "悬挂外凸：",
  noticeZeroJump: "零抖动行内语法：",
  noticeDistractionFree: "极简专注画布：",
  noticePureSourceOn: "已切换到纯源码模式",
  noticePureSourceOff: "已切回 Live Preview 实时预览",
  noticeOn: "开启",
  noticeOff: "关闭",
  noticeNoActiveNote: "当前没有可同步的 Markdown 笔记。",
  noticeRenamedTo: "已重命名为",
  noticeAlreadySynced: "文件名已与首行一致（或文稿为空）。",

  // Settings headings
  secTypewriter: "打字机滚动与基线指示器",
  secFocus: "聚焦模式",
  secTyping: "幽灵自动配对与键盘手感",
  secTypography: "悬挂外凸与光学排版",
  secCanvas: "独立专注画布",
  secTitleless: "无标题文稿与文稿列表",

  // Settings: Typewriter
  setTwEnableName: "启用打字机滚动",
  setTwEnableDesc: "还原 Ulysses 平方根感知动画时长：duration = 15ms × √|Δy|（EaseInEaseOut）。",
  setTwModeName: "滚动锚点模式",
  setTwModeDesc:
    "自由区间模式从上 1/3 起笔，并将连续写作稳托在护颈视野中心（默认 25%–55%）；固定顶部/居中/底部则严格锁定在 30%、50%、70%。",
  optTwVariable: "自由舒适区间（上 1/3 起笔 → 视野中心）",
  optTwMiddle: "固定居中（严格锁定 50%）",
  optTwTop: "固定偏上（30%）",
  optTwBottom: "固定偏下（70%）",
  optTwOff: "关闭",
  setTwTopStartName: "新文稿首行起始位置（%）",
  setTwTopStartDesc: "空白文稿打开时第 1 行的纵向起始位置（默认 33%，即视口上 1/3）。",
  setTwBandTopName: "舒适区上边界（%）",
  setTwBandTopDesc: "光标高于此位置时平滑向下滚屏（默认 25%）。",
  setTwBandBottomName: "舒适区下边界 / 视野止停线（%）",
  setTwBandBottomDesc: "光标到达此位置后平滑向上推页，避免低头看屏底（默认 55% 视野中心）。",
  setTwAnimateName: "平滑感知滚动动画",
  setTwAnimateDesc: "启用平滑缓动并按物理像素对齐（防文字发虚）。",
  setTwOverscrollName: "首尾留白（Overscroll）",
  setTwOverscrollDesc: "为文稿首尾预留足够滚动余量，确保首行与末行都能停在舒适焦点处。",
  setTwWheelName: "固定模式下滚轮驱动光标",
  setTwWheelDesc: "在固定顶部/居中/底部模式下，滚轮逐行移动光标，避免与焦点锁定抢滚动条。",
  setBaselineName: "细胶囊基线指示条",
  setBaselineDesc: "在当前行下方绘制 Ulysses 风格 fontSize/6 圆角细条，而非整行铺色降低对比度。",

  // Settings: Focus
  setFocusModeName: "聚焦粒度",
  setFocusModeDesc: "将非焦点文字平滑淡化至 20% 透明度（支持按行、按中英文分句、按段落聚焦）。",
  optFocusOff: "关闭",
  optFocusLine: "当前行",
  optFocusSentence: "当前句",
  optFocusParagraph: "当前段落",
  setFocusOpacityName: "非焦点区域透明度",
  setFocusOpacityDesc: "Ulysses 默认值为 0.20。",

  // Settings: Ghost auto-pairing & Smart editing
  setGhostPairName: "幽灵态自动配对",
  setGhostPairDesc:
    "自动配对 **、*、_、`、==、~~、括号与中文引号，支持越过折叠、成对退格及单次 Cmd+Z 仅撤销闭合符。提示：建议在「编辑器」中关闭原生自动配对以获得完整单步撤销手感。",
  setContextTabName: "上下文感知 Tab / Shift+Tab",
  setContextTabDesc: "在正文或列表任意列按 Tab 整行缩进、不撕裂句子；在代码块内自动插入字面制表符。",
  setSmartListName: "智能列表续行与序号自动重排",
  setSmartListDesc: "回车自动续行无序/有序/任务列表与引用块，空项回车自动退出，并实时重排后续有序序号。",
  setSmartHomeName: "Smart Home（Home / Cmd+左方向键）",
  setSmartHomeDesc: "在正文起点（跳过 #、-、1.、>）与行首第 0 列之间智能切换。",
  setProtectMarkupName: "潜在语法符号输入保护",
  setProtectMarkupDesc: "在代码块内或输入 ----、''、++ 等 Markdown 触发符时拦截系统智能标点替换。",

  // Settings: Hanging outdent & typography
  setOutdentName: "标题与引用悬挂外凸",
  setOutdentDesc: "将展开的 # 与 > 符号拉入左侧留白边距，使标题文字始终稳如磐石、零横向跳动。",
  setInactiveMarkersName: "非活动标题左侧淡色标记（Live Preview）",
  setInactiveMarkersDesc: "在 Live Preview 非焦点标题行左侧静默展示淡色 #、##、### 视觉锚点。",
  setZeroJumpName: "零抖动行内语法占位（Live Preview）",
  setZeroJumpDesc:
    "在 Live Preview 隐藏 **、*、_、`、~~、== 时以等宽淡色幽灵符号占位，点击进入时第 0 帧无缝切换，消除行内抖动与折行跳动。",
  setMutedSyntaxName: "三通道语法符号降噪着色",
  setMutedSyntaxDesc: "让 Markdown 语法标记保持低对比度退居幕后，突出正文阅读层次。",
  setTypographyName: "光学排版参数",
  setTypographyDesc: "启用 64 字符等宽阅读列（各标题拉直对齐）、1.6 正文行距、1.2 代码块行距封顶、标题反比行距与 x-height 归一化。",
  setMeasureName: "阅读行宽（字符数）",
  setMeasureDesc: "Ulysses 默认值为 64。",
  setHeadingScaleName: "克制的 Ulysses 标题字号梯度",
  setHeadingScaleDesc: "采用细腻克制的 H1–H6 比例（1.35em → 0.96em），在默认主题下也保持均衡耐看。",
  setCjkSpacingName: "中英文混排光学字距",
  setCjkSpacingDesc: "开启 CSS text-autospace 自动留白与 0.025em 呼吸感字距，无需额外 CSS 片段。",
  setDimInactiveName: "非活动分屏降噪",
  setDimInactiveDesc: "多栏分屏时将非活动编辑器平滑淡化至 33% 透明度。",

  // Settings: Standalone canvas
  setHideInlineTitleName: "隐藏编辑区行内文件名标题",
  setHideInlineTitleDesc: "通过作用域 CSS 隐藏正文上方的文件名标题框，开箱即享无标题写作（关闭插件自动恢复）。",
  setHideScrollbarsName: "隐藏编辑器滚动条",
  setHideScrollbarsDesc: "保持干净的纸张写作画布，无需额外安装 Hider 插件。",
  setDistractionFreeName: "极简专注画布",
  setDistractionFreeDesc: "隐藏顶部标签栏、文档路径栏与底部状态栏（鼠标悬停屏幕顶部边缘可平滑唤出）。",

  // Settings: Titleless sheets & Sheet list
  setAutoTitleName: "新建/未命名文稿自动按首行命名",
  setAutoTitleDesc:
    "自动提取新建或未命名笔记的正文首行静默重命名并维护双链；绝不触碰已命名的历史笔记与日期日记。",
  setAutoTitleDelayName: "自动改名防抖延迟（毫秒）",
  setAutoTitleDelayDesc: "停止输入该时长后（或切走笔记时立即）执行重命名，保护 iCloud 同步零冲突。",
  setAutoTitleMaxLenName: "自动生成文件名最大长度",
  setAutoTitleMaxLenDesc: "过长的首行会自动安全截断到此字符上限。",
  setPreviewLinesName: "文稿列表摘要预览行数",
  setPreviewLinesDesc: "侧边栏每张文稿卡片在首行标题下方展示的正文摘要行数。",
  optPreview1: "1 行",
  optPreview2: "2 行（Ulysses 默认）",
  optPreview3: "3 行",
  setStatusBarName: "显示状态栏快捷切换器",
  setStatusBarDesc: "在底部状态栏点击快速循环聚焦模式，Shift+点击循环打字机模式。",

  // Sheet list UI
  sheetFolderFilterAria: "筛选文件夹",
  sheetAllNotes: "全部文稿",
  sheetRootFolder: "根目录",
  sheetNewAria: "新建无标题文稿",
  sheetSearchPlaceholder: "筛选文稿首行或摘要…",
  sheetSortMtimeAria: "排序：最近修改（点击切换）",
  sheetSortCtimeAria: "排序：最近创建（点击切换）",
  sheetSortTitleAria: "排序：按首行标题（点击切换）",
  sheetSortMtimeShort: "按修改时间",
  sheetSortCtimeShort: "按创建时间",
  sheetSortTitleShort: "按标题",
  sheetCountSuffix: "篇文稿",
  sheetEmptySearch: "没有匹配的文稿",
  sheetEmptyFolder: "暂无文稿，点击右上角新建",
  sheetUntitledFallback: "空白新文稿",
  sheetWordsSuffix: "字",
  sheetMenuOpenNewTab: "在新标签页打开",
  sheetMenuSyncFilename: "按正文首行同步文件名",
  sheetMenuTrash: "删除文稿",
  timeJustNow: "刚刚",
  timeMinAgo: " 分钟前",
  timeHrAgo: " 小时前",
  timeYesterday: "昨天",
  timeDayAgo: " 天前",
};

/**
 * Detect current Obsidian UI language using official APIs
 * (`getLanguage()` on 1.8.7+, falling back cleanly to `moment.locale()` on 1.6.6–1.8.6).
 */
export function getActiveLocale(): SupportedLocale {
  const raw = (
    requireApiVersion("1.8.7") ? getLanguage() : moment.locale()
  ).toLowerCase();
  if (raw.startsWith("zh")) return "zh";
  return "en";
}

export function t(key: I18nKey): string {
  return getActiveLocale() === "zh" ? ZH[key] : EN[key];
}

# Ulysses Feel for Obsidian

[English](./README.md) | **简体中文**

**开箱即用的 Obsidian × Ulysses 写作体验插件** —— 基于**零 Obsidian 依赖的可迁移 CodeMirror 6 核心**（`@writer/cm6-ulysses-core`）与 **100% 非侵入官方标准适配层**构建。

只需安装这一个插件，在 Obsidian 原生默认主题（浅色/深色）以及 Minimal 等社区主题下，即可一步获得 Ulysses 级别的无抖动输入手感、护颈打字机滚动、聚焦淡化、无标题开写与文稿摘要侧边栏——零私有 API Hack、不修改用户全局配置、卸载零残留。

---

## 核心特性

| 能力模块 | 具体体验 |
| :--- | :--- |
| **Live Preview 零抖动行内语法** | 实时镜像 Live Preview 隐藏的行内语法符（`**`、`*`、`__`、`_`、`` ` ``、`~~`、`==`），以等宽淡色幽灵 Widget 占位，并对 `#`～`######` 标题与 `>` 引用执行第 0 帧悬挂外凸——**光标移入移出 0px 横向位移、不触发折行跳动**，同时完整保留 Live Preview 的表格、Callout、图片与 Mermaid 图表渲染。 |
| **光学排版与绝对拉直对齐** | 基于根字体的 `64rch` 阅读列宽（H1–H6 与正文严格对齐到同一条竖直像素轴）、`1.6` 正文行距、`1.2` 代码块行距封顶、标题反比行距、x-height 归一化、克制标题字号梯度，以及内置中英文混排 `text-autospace` 与呼吸感字距。 |
| **护颈感知打字机滚动** | 平方根动态缓动时长（`duration = 15ms × √|Δy|`，EaseInEaseOut，物理像素对齐）。新建空白文稿首行默认起笔于**视口上 1/3（`33%`）**，连续写作时光标稳托在**护颈视野中心区间（默认 `25%–55%`）**，全参数支持滑块微调；另提供固定偏上/居中/偏下（`30% / 50% / 70%`）模式与滚轮逐行驱动光标。 |
| **细胶囊基线指示条** | 在当前活动行基线下方绘制 `fontSize / 6` 胶囊圆角细条（浅色 `0.15` / 深色 `0.20` 透明度，失焦平滑淡出），紧贴阅读列宽，不铺满整行背景、不降低文字对比度。 |
| **行 / 句 / 段聚焦模式** | 将非焦点正文淡化至 `0.20` 透明度并轻微去饱和；句级聚焦采用原生 `Intl.Segmenter`，精准识别中英文混排句界；多栏分屏时非活动窗口淡化至 `0.33`。 |
| **单步撤销幽灵自动配对** | 双区间幽灵自动配对 `**`、`*`、`_`、`` ` ``、`==`、`~~`、括号与中文引号，配合 `isolateHistory.of("before")` 实现 **单次 `Cmd+Z` 仅撤销自动补全的闭合符**，并支持 `*`→`**` 升级、越过折叠、成对退格与选区包裹。 |
| **智能键盘编辑手感** | 上下文感知 `Tab` / `Shift+Tab`（正文任意列整行缩进、代码块内插字面 `\t`）、无序/有序/任务列表与引用智能续行、有序列表序号实时自动重排、Smart Home（`Home` / `Cmd+左方向键`）以及潜在 Markdown 语法触发符的智能标点保护。 |
| **无标题文稿与 Ulysses 文稿列表** | 执行「新建无标题文稿」直接落光标到正文第 1 行开写；仅对新建或未命名笔记在停顿防抖（默认 2 秒）或切走时按首行静默重命名（走官方 `fileManager.renameFile` 自动维护双链、保障 iCloud 零冲突，绝不动历史笔记与日期日记）；内置左侧 **Ulysses 文稿列表** 侧边栏（首行标题 + 1–3 行摘要预览 + 字数 + 文件夹筛选）。 |
| **独立专注画布** | 内置作用域开关：自动隐藏正文顶部 `.inline-title` 文件名框、隐藏文档滚动条、收起左侧边栏时自动联动隐藏最左侧功能区图标栏（Ribbon），以及可选**极简专注画布**（隐藏标签栏、顶部路径栏与状态栏，鼠标悬停顶部边缘平滑唤出）——原生默认主题下开箱即用，无需再装 Minimal Focus 或 Hider。 |
| **自动中英文界面 & 嵌套编辑器隔离** | 自动跟随 Obsidian 界面语言切换中/英文界面（设置页、命令面板、通知与文稿列表）；自动隔离 Live Preview 表格单元格等嵌套子编辑器，绝不撑高单元格或抢占表格 `Tab` / `Enter` 导航。 |

---

## 安装方式

### 方式一：Obsidian 社区插件市场
在 **设置 → 第三方插件 → 浏览** 中搜索 **Ulysses Feel** 安装（审核上架后生效）。

### 方式二：GitHub Release 手动安装（推荐）
1. 前往最新 [GitHub Release](https://github.com/AsIsacy/obsidian-ulysses-feel/releases) 下载 `main.js`、`manifest.json`、`styles.css` 三个文件。
2. 放入你的库目录 `<你的库>/.obsidian/plugins/ulysses-feel/`。
3. 重启或重载 Obsidian，在 **设置 → 第三方插件** 中启用 **Ulysses Feel**。

### 方式三：通过 BRAT 安装
1. 在 Obsidian 中安装 **BRAT** 插件。
2. 点击 **Add Beta plugin**，粘贴仓库地址：`https://github.com/AsIsacy/obsidian-ulysses-feel`。

### 方式四：源码构建
```bash
pnpm install
pnpm build
# 将 packages/obsidian-ulysses-feel/{main.js,manifest.json,styles.css}
# 复制到 <你的库>/.obsidian/plugins/ulysses-feel/
```

---

## 推荐快捷键与配合设置

- **将 `Cmd+N` / `Ctrl+N` 绑定为无标题开写**：在 **设置 → 快捷键** 中搜索 **`Ulysses Feel: 新建无标题文稿`** 并绑定 `Cmd+N`（macOS）或 `Ctrl+N`（Windows/Linux），按下即可直接在第 1 行开写，彻底告别起文件名焦虑。
- **关闭原生自动配对**：为了体验完整的「按一次 `Cmd+Z` 仅撤销自动闭合符」，建议在 **设置 → 编辑器** 中关闭 **自动配对 Markdown 语法** 与 **自动配对括号**。
- **常用命令面板指令**（搜索 `Ulysses Feel`）：
  - `新建无标题文稿`
  - `打开文稿列表侧边栏`
  - `切换打字机滚动模式`
  - `切换聚焦模式`
  - `开关极简专注画布`
  - `开关零抖动行内语法（Live Preview）`
  - `切换纯源码零跳动模式`
  - `按正文首行同步当前文件名`

---

## 架构与可迁移性

```text
packages/
├── cm6-ulysses-core/        # 纯 CodeMirror 6 扩展包（零 Obsidian 依赖）
│   ├── src/typewriter.ts        # 平方根打字机滚动、护颈舒适区间、固定模式滚轮控光标
│   ├── src/baseline-highlight.ts# fontSize/6 贴列宽胶囊基线指示条
│   ├── src/focus-mode.ts        # 行 / 句（Intl.Segmenter）/ 段聚焦淡化
│   ├── src/ghost-autopair.ts    # 双区间幽灵配对 + isolateHistory 单步撤销
│   ├── src/smart-editing.ts     # 上下文 Tab、有序列表自动重排、Smart Home、标点保护
│   ├── src/hanging-outdent.ts   # 第 0 帧标题/引用悬挂外凸
│   ├── src/zero-jump-syntax.ts  # Phase-2 Live Preview 行内幽灵语法占位
│   ├── src/sheet-title.ts       # 可移植首行标题、摘要与安全文件名提取器
│   └── test/core.test.ts        # Vitest 单元测试
└── obsidian-ulysses-feel/   # 轻量 Obsidian 官方标准适配层
    ├── src/main.ts              # registerEditorExtension + updateOptions + 命令注册
    ├── src/settings.ts          # 标准 PluginSettingTab 设置页
    ├── src/i18n.ts              # 自动跟随 Obsidian 语言切换中/英文
    ├── src/titleless-sheets.ts  # 无标题新建 + iCloud 安全防抖自动命名
    ├── src/sheet-list-view.ts   # Ulysses 风格文稿列表侧边栏视图
    └── styles.css               # 严格收敛在 body.ulysses-feel-enabled 作用域内
```

`@writer/cm6-ulysses-core` 也可直接引入到任何独立的 Web / Electron / Tauri CodeMirror 6 编辑器中复用：

```ts
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { createUlyssesExtension } from "@writer/cm6-ulysses-core";

const ulysses = createUlyssesExtension({
  typewriter: { mode: "variable", variableBandTop: 0.25, variableBandBottom: 0.55 },
  focusMode: { enabled: true, mode: "sentence" },
});

const view = new EditorView({
  state: EditorState.create({ doc: "# 你好，Ulysses\n", extensions: [ulysses.extension] }),
  parent: document.body,
});
```

---

## 本地开发与校验

```bash
pnpm install
pnpm build       # 构建核心库与 Obsidian 插件 main.js
pnpm typecheck   # 严格 TypeScript 类型检查
pnpm lint        # 运行 Obsidian 官方 eslint-plugin-obsidianmd 规则检查
pnpm test        # 运行 Vitest 单元测试
```

## 开源协议

[MIT](./LICENSE)

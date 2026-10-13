# 快读 · digest.today

> 手工作坊系列 #03：在任意网页按 `Alt+Shift+S`，3-8 秒生成一张复古纸墨风摘要卡片并朗读。
> 一句话总结 + 3-5 条要点 + "值得一读吗"盖章 + 关键词 + 原文金句。

Manifest V3 · React 18 + Tailwind 4 · 纯静态包零后端 · **BYO-Key**（LLM 端点自己配，免费档即可用）。

## 安装（开发者模式，5 分钟）

1. `npm install && npm run build`
2. 打开 `chrome://extensions` → 右上角开启「开发者模式」
3. 「加载已解压的扩展程序」→ 选中本项目的 **`dist/` 目录**
4. 首次装完会自动打开设置页；以后在任意文章页按 **Alt+Shift+S**（或点工具栏图标）即可

> 拿到 zip 的话：解压后把里面的 `dist/` 文件夹按上面第 2-3 步加载。要给别人用，跑 `npm run zip` 得到可直接上传 Chrome Web Store 的包。

## 配置一个免费端点（引导页 30 秒）

| 预设 | baseURL | 默认模型 | 说明 |
|---|---|---|---|
| 智谱 GLM-4-Flash ✅推荐 | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` | 官方免费档，中文好 |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` | 免费额度大、速度快 |
| OpenRouter 免费档 | `https://openrouter.ai/api/v1` | 任选 `:free` 模型 | 多个免费模型 |
| 本地 Ollama | `http://localhost:11434/v1` | `qwen2.5:3b` | 完全离线，隐私最优，零限流 |
| 自定义 | 任意 OpenAI 兼容地址 | — | 也包括自建 freellmapi 聚合网关 |

- Key 在各平台控制台申请；模型名可随意改
- 点「保存」时会弹**一次**授权框（只授权该端点的域名）——拒绝则保存失败，权限和知情同意对齐
- 测试连接通过才会真正保存

## 隐私（就三句，也是商店审核材料）

1. API Key 只存本机（`chrome.storage.local`），本项目没有任何服务器。
2. 文章正文只发给你自己在设置页配置的那个端点（设置页会明示当前域名）。
3. 历史记录只存本机，可一键清空或导出（导出文件里 Key 已打码）。

另外：扩展平时对任何页面零感知——只申请 `activeTab` + `scripting` + `storage`，只有你按下快捷键/点图标那一刻才临时访问当前标签页，不给 `<all_urls>` 常驻权限。

## 使用

- **生成**：文章页按 `Alt+Shift+S` 或点图标，全自动：抓正文 → 调 LLM → 出卡片
- **卡片**：标题 / TL;DR / 要点 / 盖章（值得一读·砖红 / 随便看看·墨绿 / 可以跳过·灰）/ 关键词 / 原文金句
- **复制 MD**：直接可贴进笔记的 Markdown（`## 标题` + `> TL;DR` + 要点 + `#关键词` + `[原文](url)`）
- **存 PNG**：2x 高清卡片图，社交分享用
- **▶ 朗读**：Web Speech API 读 TL;DR + 要点，支持暂停/停止和 0.8-1.5x 速率
- **⭐ 收藏**：进历史页"已收藏"分区，给 v2 的「本周我看了什么」周报攒原料
- **✎ 历史**：未收藏保留最近 30 条；收藏不被新摘要自动裁剪，保留至取消收藏或删除。可回看、单删、清空

## 开发

```bash
npm test          # vitest：摘要容错 / Markdown / 收藏保留 / 导出错误反馈（27 个用例）
npm run build     # 图标 → tsc → 主构建（popup/options/background）→ content script IIFE
npm run watch     # 双构建 watch；改完到 chrome://extensions 点刷新
npm run zip       # dist → digest-today-v1.0.0.zip（商店上传格式）
```

**构建说明（与原计划的差异）**：原计划用 @crxjs/vite-plugin，但本项目核心机制是"按需注入"——`chrome.scripting.executeScript({ files })` 需要稳定文件名，而 crxjs 会对脚本做哈希重写且无文档化的运行时注入模式，故改为双 Vite 配置手工构建：主配置出 popup/options/`background.js`，lib 模式单独出 IIFE 的 `content-extract.js`。源码目录结构保持 crxjs 形状，以后要 HMR 可平滑迁回。

**项目结构**：

```
digest-today/
├── manifest.json（public/，构建时原样拷贝）
├── vite.config.ts          # popup / options / background
├── vite.content.config.ts  # content-extract.js（IIFE，稳定文件名供按需注入）
├── scripts/
│   ├── icons.mjs           # 零依赖手写 PNG 编码生成图标（16/48/128/512）
│   ├── watch.mjs / zip.ps1
├── src/
│   ├── popup/    # App（状态编排）· SummaryCard · HistoryList · Onboarding
│   ├── options/  # 端点预设 + 测试连接 + 运行时授权 + 数据管理 + 隐私三句
│   ├── background/  # service worker（v1 很薄：装完打开设置页）
│   ├── content/extract.ts  # 页面内跑 Readability + 回退链，只回传 ≤8000 字符纯文本
│   ├── lib/      # llm（重试/友好报错）· summarize（三级容错解析）· md · storage · presets
│   └── shared/   # types.ts · retro.css（纸墨色板，与 #01/#02 同套）
└── dev/          # 组件视觉预览页（不进 dist）：npm run watch 后开 /dev/preview.html?view=card
```

**正文抽取回退链**：Readability（Firefox 阅读模式同款）→ 失败则 `title + meta description + innerText 前 3000 字` → 再失败明确提示"这个页面不是文章"，不硬摘要。

**坏 JSON 三级容错**：直接 `JSON.parse` → 摘出第一个配平的 `{...}` 块再 parse → 降级为"自由摘要"卡片。verdict 白名单校验，非法值归 `skim`。

## E2E 验收（v1.0.1 已过）

在隔离 Edge 实例（`--load-extension` + 临时 user-data-dir）+ 本地 mock 端点（`scripts/mock-llm.mjs`，端口 11434 正好匹配 Ollama 预设）里做过真实全链路验收，证据截图在 `docs/e2e/`：

- 加载扩展 → `onInstalled` 自动打开设置页 ✓
- 设置页保存端点：授权（`chrome.permissions` granted）→ 测试连接 → 落盘 ✓
- 真实文章页出卡：注入抽取 → Readability 抓到干净正文（标题/作者/正文，导航/评论被排除）→ 卡片渲染（TL;DR/要点/盖章/关键词/金句）✓
- 收藏 → 历史页「已收藏」分区 ✓；存 PNG → 344 KB 2x 图落盘 ✓
- 端点吐坏 JSON → 自动降级「自由摘要」卡片 + 历史存 raw ✓
- 由此揪出并修复一个真 bug：从设置页直接配置的用户会被误带回引导卡（现以"是否存在有效配置"为准）

自己复跑：`node scripts/mock-llm.mjs good` 起端点，加载 `dist/` 后在文章页按 Alt+Shift+S（`scripts/e2e-cdp.mjs` 是 CDP 驱动脚本，可参考）。注意：复制 MD 依赖弹窗聚焦（Chrome 对后台文档剪贴板的限制），真实使用（弹窗有焦点）不受影响。

## 已知限制（FAQ）

- **弹窗一关，朗读就停**：摘要和朗读都在弹窗里进行，v2 用 `sidePanel` 根治
- **v1 不支持 PDF**、不支持登录墙内的内容（付费墙只摘到可见部分）
- 免费端点限流时客户端会指数退避重试 2 次，仍失败会给出明确文案；推荐本地 Ollama 作零限流兜底
- 快捷键冲突可在 `chrome://extensions/shortcuts` 自行修改

## v2 路线

1. 「本周我看了什么」：收藏自动汇总成周报长图（html-to-image 导出）
2. 侧边栏 + 右键菜单"快读此页"
3. 流式输出 · PDF/YouTube 字幕摘要 · Firefox 移植

# SDD Spec: generate-ux-prototype 内网图标检索替换（EP 占位 → 公司图标库）

## 0. Open Questions
- [x] SVG 清洗（fill→currentColor）：用户拍板"源码清洗先不做了"（2026-09-22）
- [x] 主题跟随方案（二次决策，2026-09-22）：不改图标颜色，改为**深/浅两套图标整体下载**，按 data-theme 纯 CSS 切换（见 §1 In-Scope、§2 事实 7）
- [x] 检索服务接口细节（2026-09-22 回填，见 §2 事实 7-10）：三步 API（getConfig → getIconInfo → getIcon），全 GET，base URL `https://octo.hdesign.huawei.com`，无鉴权，JSON 响应（来源：`references/icon-api.md`）
- [x] 深浅两套区分（2026-09-22 回填）：getIcon 的 `theme` 参数（light/dark），深浅各请求一次 getIcon（用户明确"深色模式请求一次，浅色模式请求一次"）
- [x] 深色变体覆盖率（2026-09-22 回填）：getConfig 实际响应**无 `dark_colors` 字段**（见 getConfig.json 样本）；深色请求用**同 color id + theme=dark**。逐图标深色覆盖率仍未知，R-5 策略兜底（dark 返回空→沿用 light）
- [x] 超时预算（2026-09-22 回填）：10s（icon-api.md 未提及，取默认值兜底，可在 Plan 评审时调）
- [x] color 参数选择规则（2026-09-22 回填）：从 `config.colors` 中选 `style` 匹配项的第一个 `id`（style value 为中文："线性"/"面性"/"线性双色"/"面性双色"/"圆底托"/"方底托"）。默认选 style="线性" 匹配项的第一个 id（如 `GTS_线性_Gray-10`）
- [x] size/style 默认值（2026-09-22 回填）：size=24（key="24"），style=border（key="border"，value="线性"）。getIcon 参数用 style 的 **key**（如 "border"），不是 value

## 1. Requirements (Context)
- **Goal**: generate-ux-prototype（ep-coder 变体）在内网环境使用公司图标库替换 EP 图标：AI 照常写 EP 图标名，新增 fetch 脚本按用到的图标名检索公司向量库，命中的 SVG 落盘并在预览运行时替换 EP 图标；未命中的图标保持 EP 原样，页面天然完整。
- **In-Scope**:
  - 新增 `scripts/fetch-icons.mjs`：扫描 src/ 中 `@element-plus/icons-vue` 实际 import 的图标名 → 单轮批量请求检索服务 → **深浅两套 SVG** 落盘到工程 `src/assets/icons/`（`{name}.light.js` / `{name}.dark.js`）→ 生成 barrel `src/assets/icons/index.js`
  - barrel 语义：命中图标名导出**双份 SVG 组件**（同时渲染 light/dark 两个 svg，class 区分）+ barrel 顶部注入三条 CSS 切换规则（`.ux-icon-pair` 默认显 light；`[data-theme="dark"]` 下显 dark、隐 light）——主题跟随走纯 CSS，不改 SVG 颜色
  - 预览 moduleCache 把 `@element-plus/icons-vue` 键从 EP 图标 UMD 改为指向 barrel（含动态路径处理）
  - SKILL.md 增补图标检索步骤说明（工作流中 build 前执行）
  - 输出固定格式报告 `RESOLVED: n, MISSED: m`（fetch 脚本天然副产品）
- **Out-of-Scope**:
  - SVG 源码清洗（fill→currentColor）——用户拍板不做；主题跟随改走"深浅两套图标 + CSS 切换"（In-Scope）
  - 检索结果缓存（每次实时检索；单轮+超时+不重试已兜底等待问题）
  - manifest 名合法性校验——build 门禁已有 EP_ICONS 校验（build.mjs:230-237），零新增
  - EP 图标集之外的业务图标扩展口（`extra_icons`）——第一版不做
  - 外网/其他变体 skill（test1/test2 的 ai-for-gdesign/ai-for-design）的同等改造

## 1.1 Context Sources
- Requirement Source: 本会话对话（2026-09-22，用户四轮收敛：EP 占位/英文名检索/不清洗/不缓存不校验）
- Design Refs: 无新设计稿
- Chat/Business Refs: 内网环境无法用 EP 图标包在线源；公司图标在向量检索库，返回 SVG 源码可存文件
- Extra Context:
  - `ep-coder/skills/generate-ux-prototype/SKILL.md`（工作流与脚本契约）
  - `scripts/preview/index.gts.html`（moduleCache 接线点，L89-100）
  - `scripts/build.mjs`（图标名门禁 L230-237；bare import 白名单 L89-97）
  - `scripts/build-data.mjs`（preview-data 源码映射机制）
  - `scripts/verify/whitelists/element-plus-icons.json`（293 个合法图标名，已接入门禁）

## 1.5 Codemap Used (Feature/Project Index)
- Codemap Mode: feature（轻量，任务单元小，未生成独立 codemap 文件）
- Key Index:
  - 图标在预览的接线：`index.gts.html` L12 加载 `element-plus-icons-vue.iife.min.js` UMD → L95 moduleCache `"@element-plus/icons-vue": ElementPlusIconsVue`
  - 图标名门禁：`build.mjs` L86-88 加载 EP_ICONS 白名单 → L230-237 import 名校验（did-you-mean）→ L270-277 模板 PascalCase 标签必须 import
  - 源码映射：`build-data.mjs` `collectSources()` 收集 src/ 下 .vue/.js/.css/.json 文本 → `preview-data.js` 的 `window.__UX_PROTO_SRC__`；关键：**非文本扩展名的文件不进映射**，svg 是二进制资产路径（ASSET_EXT 处理），JS barrel 是文本会进映射
  - init 骨架：`init.mjs` L73-76 从 `scripts/preview/` 拷贝 html+library+src 骨架
- Dependencies / External Systems: 公司图标向量检索服务（HTTP 接口，细节待用户提供）

## 1.6 Context Bundle Snapshot (Lite)
- Bundle Level: `Lite`（需求在本会话收敛，无散落材料）
- Key Facts:
  1. 公司图标库无限、无法整库导出 → 只能按需检索
  2. 检索返回 SVG 源码，可存为 svg 文件
  3. EP 英文名作为检索词召回质量够用（用户确认）
  4. "检索不到就不管，还用 EP 的"是用户原话设计——miss 天然降级，无等待问题
  5. **主题跟随（二次决策 2026-09-22）**：不改 SVG 颜色，深浅两套整体下载；本 skill 主题系统即 `data-theme` 属性 + CSS 作用域（build.mjs L152 校验 `<html data-theme>`），纯 CSS display 切换与 token 换肤同一条级联链路，零 JS
- Open Questions: 检索接口格式（§0 待回填）

## 1.7 Minimum Chaos Unit Assessment
- Final Goal: 内网生成的页面用公司图标；图标名词汇表与工程源码保持 EP 形态不变，替换发生在解析层
- Current Task Unit: ep-coder skill 新增 fetch-icons 脚本 + moduleCache 换指向 + SKILL.md 说明
- Why this unit is small enough: 改动集中在 scripts/（1 新文件 + 2 小改）+ SKILL.md 一节；不触碰 vendor/、design-language、token 体系、build 门禁逻辑
- In-Scope Boundary: 见 §1 In-Scope
- Out-of-Scope Boundary: 见 §1 Out-of-Scope
- Verification Evidence: build 门禁全绿 + 构造工程冒烟（mock 一个本地检索服务验证命中/未命中两条路径）+ 预览人工确认图标渲染
- Failure / Rework Plan: moduleCache 换指向若引发 sfc-loader 加载问题 → 回退到"直接改写 preview-data 里 import 语句"的备选方案（见 §3 Option B）
- Model Autonomy Space: fetch 脚本内部实现细节（请求封装、错误聚合）、barrel 代码风格
- User Decision: Accepted（方案四轮收敛后用户确认，2026-09-22）

## 2. Research Findings
- 事实与约束:
  1. **替换生效点已确认**：预览 moduleCache（index.gts.html:95）把 `@element-plus/icons-vue` 映射到 UMD 全局 `ElementPlusIconsVue`。sfc-loader 解析 .vue/.js 的 import 时查 moduleCache，改此键的值即完成替换——**.vue 源码零改动**。
  2. **barrel 必须进 preview-data 映射**：moduleCache 键值不能是文件路径（sfc-loader 的 moduleCache 只接受模块对象），因此 barrel 需要经 `SRC` 路径加载或直接在 moduleCache 键上放"能 import 的模块对象"。实现取一：moduleCache 键值直接构造为一个代理模块（`new Proxy` 或预组装对象），其属性查找时从 `EP全量 + 命中覆盖` 合并解析——具体形态在 Plan 定签名。
  3. **EP 图标 UMD 形态**：`element-plus-icons-vue.iife.min.js` 暴露全局 `ElementPlusIconsVue`，含全部 293 个图标组件——未命中路径直接复用它，零成本。
  4. **svg 文件在预览中是 URL 资产**：build-data.mjs 的 TEXT_EXT 不含 .svg，svg 落 src/ 下会被 ASSET_EXT 路径处理（返回 URL）——所以**不能靠 `<img src>` 引 svg**，必须封装为 JS 组件模块（inline svg）才走文本映射与 import 链路。barrel + 图标组件 js 文件均为文本，进映射无障碍。
  5. **检索词即图标名**：import 扫描可直接复用 build.mjs 的 importRe 逻辑（L211）或更简单的定向正则——只提取 `from '@element-plus/icons-vue'` 的命名导入。
  6. **接口已回填**（2026-09-22，见事实 7-10）：fetch 脚本封装三步 API 调用，接口细节集中在内部函数。
  7. **API 三步流程**（来源 `references/icon-api.md`）：① `GET /assetRepository/iconPlus/getConfig` → 获取配置（size/style/category/colors/dark_colors/fileType）→ ② `GET /assetRepository/iconPlus/getIconInfo?keyword=...` → 按关键词搜索（支持逗号分隔批量，返回 `[{keyword, icons:[{icon_id,name,englishName,url,score,...}]}]`）→ ③ `GET /assetRepository/iconPlus/getIcon?url=...&size=...&style=...&color=...&theme=light|dark` → 获取 SVG 文本（响应 `data` 字段，支持 url 逗号分隔批量）
  8. **深浅区分 = getIcon 的 theme 参数**：`theme=light`（默认）取浅色 SVG，`theme=dark` 取深色 SVG——**深浅各请求一次 getIcon**（用户明确）。color 参数配合：浅色从 `config.colors` 取 id，深色从 `config.dark_colors` 取 id
  9. **批量优化**：getIconInfo 的 keyword 支持逗号分隔（一次搜全部图标名）；getIcon 的 url 支持逗号分隔（一次取全部命中图标的 SVG）——**单轮批量 = 4 次 HTTP 请求**：getConfig(1) + getIconInfo(1) + getIcon-light(1) + getIcon-dark(1)
  10. **getIcon 必填参数**：`url`（来自 getIconInfo 响应）、`size`（来自 getConfig.size，如 "24"）、`style`（来自 getConfig.style，如 "line"）、`color`（来自 getConfig.colors/dark_colors 的 id）；`theme` 默认 light 可选 dark；`fileType` 默认 svg。base URL `https://octo.hdesign.huawei.com`（可通过 `--base-url` 覆盖），无鉴权
  11. **外网降级机制**（icon-api.md 提及）：IconPlus 不可达时降级为 Lucide CDN 拉取（`<img :src>` 模式，与当前 Spec 的 moduleCache+CSS 切换方案不同）——是否纳入本任务 scope 待确认
  12. **getConfig 实际响应**（来源：`getConfig.json` 样本）：size=[12,14,16,20,24,32,36,40,48,60]；style=[{key:"border",value:"线性"},{key:"filled",value:"面性"},{key:"two_colors1",value:"线性双色"},{key:"two_colors2",value:"面性双色"},{key:"round_bottom2",value:"圆底托"},{key:"square_bottom2",value:"方底托"}]；colors=12 项（每项含 id/key/value/domain/type/style，style 用中文如"线性"/"面性"）；**无 dark_colors 字段**（文档描述有但实际响应没有→深色用同 color id + theme=dark）；无 category/fileType 字段
  13. **getIcon style 参数用 key 不是 value**：getIcon 的 style 参数从 getConfig.style 的 **key** 选取（如 "border"），不是 value（"线性"）。color 参数从 getConfig.colors 的 **id** 选取（如 "GTS_线性_Gray-10"），需与 style 匹配（colors 的 style 字段=对应 style 的 value）
- 风险与不确定项:
  - R-1: ~~检索服务接口格式未知~~（**已解决 2026-09-22**，见事实 7-13）；color/size/style 默认选取规则已定（§0 已勾选）
  - R-2: moduleCache 换指向后，EP 图标组件对象（defineComponent 形态）与公司 SVG 封装组件在 `<el-icon>` 内的兼容性——EP 的 ElIcon 对子组件无特殊要求（默认插槽渲染），风险低，冒烟覆盖
  - R-3: 公司 SVG 可能有 `width/height` 写死、无 viewBox 等畸形——不清洗（用户拍板），畸形时预览视觉问题留给人工，不在本单元处理
  - R-4: 内网检索服务并发/延迟未知——单轮批量+超时 10s+失败不重试兜底
  - R-5: 深色变体覆盖率——getConfig 无 dark_colors，深色用同 color+theme=dark；逐图标深色覆盖率未知，dark 请求返回空/错误时沿用浅色图（R-5 策略不变）

## 2.1 Next Actions
- [x] **交接外部回答人**：三个 Open Question（接口格式/深浅区分/深色覆盖率+超时）由他人回答（handoff 包：`ep-coder/spec/handoff/2026-09-22_15-02_ep-coder-intranet-icon-fetch_handoff.md`）
- [x] 回答落回 Spec（§0 勾选 + §2 回填）→ Plan 复核（§4.2 已从 requestIcon 修订为三步 API fetchIcons）
- [x] §0 剩余四项确认（深色覆盖率/超时/color 选取规则/size+style 默认值）→ 已全部回填
- [x] `Plan Approved` → Execute → Review PASS

## 2.2 Resume / Handoff（2026-09-22 19:50 更新——Execute 完成，Review PASS）
- **Phase**: Review（已完成）| **Approval Status**: Plan Approved → Execute 完成
- **代码状态**: checklist 1-7 全部完成
  - `scripts/fetch-icons.mjs`：新增（import 扫描 + 三步 API + 双份组件 + barrel 生成）
  - `scripts/preview/index.gts.html`：修改（barrel Proxy 合并模块 + loadModule 时序）
  - `SKILL.md`：修改（工作流增 ③.5 + §③.5 节说明）
- **Review Verdict**: PASS（§6）
- **Limitations**: 真实 API 联调未执行（外网环境不可达 `octo.hdesign.huawei.com`）；内网环境需用户验证完整三步 API 流程
- **Next Action**: 用户内网环境验证真实 API 流程；验证通过后可执行 archive

## 3. Innovate
### Option A: moduleCache 换指向（选中）
- Pros: .vue 源码零改动；替换发生在解析层，工程源码拷入真实工程后仍是标准 EP import（真实工程接入公司图标用各自机制，与本 skill 解耦）；改动面最小
- Cons: 预览层引入一个动态解析模块，需冒烟验证

### Option B: 改写 preview-data 里的 import 语句
- Pros: 不动 moduleCache
- Cons: 生成期篡改源码文本，工程源码与预览源码出现分叉（拷入真实工程的是改写后还是改写前？），违背"源码是唯一交付物"原则；字符串改写脆弱

### Option C: AI 生成期直接写公司图标 import
- Cons: 引入路径错误风险回归（AI 手写路径）；检索嵌进生成循环（等待问题回归）；被用户原始诉求直接否决

### Decision
- Selected: Option A
- Why: 唯一同时满足"源码零改动 + 零路径错误 + 零等待"的方案；moduleCache 是既有机制（locale 映射同模式），非新发明
- Skip: false

## 4. Plan (Contract)
### 4.1 File Changes
- `ep-coder/skills/generate-ux-prototype/scripts/fetch-icons.mjs`: **新增**。图标检索落盘脚本（详见 §4.2）
- `ep-coder/skills/generate-ux-prototype/scripts/preview/index.gts.html`: **修改**。moduleCache `@element-plus/icons-vue` 键值改为动态合并模块；新增 barrel 存在性判断逻辑（有 barrel 走合并模块，无 barrel 保持 EP UMD 原样）
- `ep-coder/skills/generate-ux-prototype/SKILL.md`: **修改**。工作流 ③/④ 之间插入图标检索步骤说明 + 脚本输出格式
- `ep-coder/skills/generate-ux-prototype/references/`（如需）: 无新文件；SKILL.md 内嵌说明即可（任务单元小，不散落文档）

### 4.2 Signatures
- `fetch-icons.mjs`（CLI）:
  - 用法: `node scripts/fetch-icons.mjs --dir "<artifact-folder>/<slug>" [--base-url <url>] [--timeout <ms>]`
  - 默认 base-url: `https://octo.hdesign.huawei.com`（来源 `references/icon-api.md`）
  - 流程: 读 `<dir>/src/` 下所有 .vue/.js → 正则提取 `@element-plus/icons-vue` 命名导入并去重 → 若结果为空，输出 `RESOLVED: 0, MISSED: 0` 直接退出（不打服务）→ 否则执行三步 API：
    1. `getConfig()` → 获取配置（size/style/colors），选取默认参数：size=key "24"、style=key "border"（value "线性"）、color=colors 中 style="线性" 匹配项的第一个 id（如 `GTS_线性_Gray-10`）。**无 dark_colors**，深色用同 color id + theme=dark
    2. `getIconInfo(keyword=逗号分隔的全部图标名, topK=5)` → 按 englishName 匹配，取 score 最高者；无匹配 = miss
    3. `getIcon(url=逗号分隔的全部命中 url, theme=light, color, size, style)` → 批量取浅色 SVG
    4. `getIcon(url=同上, theme=dark, color, size, style)` → 批量取深色 SVG（用户明确"深色模式请求一次，浅色模式请求一次"）
    5. 每个命中名写两个文件 `<dir>/src/assets/icons/<name>.light.js` / `<name>.dark.js`（各封装为 Vue 函数式组件，模板 inline svg，根元素 class `ux-icon-light` / `ux-icon-dark`）→ 重写/生成 `<dir>/src/assets/icons/index.js` barrel：每个命中名导出一个**组合组件**（渲染 `<span class="ux-icon-pair">` 内含 light+dark 两个 svg）+ barrel 顶部注入三条 CSS 切换规则（`.ux-icon-pair .ux-icon-dark { display:none }`；`[data-theme="dark"]` 下反转）→ 未命中名不出现（由 moduleCache 合并模块回退 EP）
  - miss 矩阵: 双套齐 → 正常切换；仅浅色（dark 请求返回空/错误）→ 深色模式沿用浅色图（R-5）；全 miss → 纯 EP（自带 currentColor 跟随）
  - 输出（固定格式，沿用 D-22 精神）:
    ```
    RESULT: OK
    RESOLVED: <n>, MISSED: <m>
    MISSED_LIST: <逗号分隔，无则省略>
    ICONS_DIR: <绝对路径>
    ```
    失败: `RESULT: FAIL | <原因>`（请求异常/超时整体 FAIL，**不重试**；已落盘的命中文件保留——部分成功也是有效状态，重跑幂等）
  - API 函数隔离: `fetchIcons(iconNames, baseUrl, timeoutMs)` 内聚全部 API 调用（getConfig → getIconInfo → getIcon×2）；内部子函数 `getConfig()` / `getIconInfo(keywords)` / `getIcon(urls, theme, color, size, style)` 各自封装一个 HTTP GET，超时统一由 `AbortController` 控制
- `index.gts.html` 合并模块（moduleCache 键值）:
  - 当 `src/assets/icons/index.js` 存在于 SRC 映射时：moduleCache 键 `"@element-plus/icons-vue"` 指向一个动态模块——属性 `p` 命中 barrel 的导出集合时返回 barrel 组件，否则回退 `ElementPlusIconsVue[p]`。实现用 `new Proxy`，`get` trap 内同步查 barrel 导出表（barrel 加载时机：`loadModule('/src/assets/icons/index.js')` 先行，缓存其导出对象）
  - 当 barrel 不存在时：保持现状 `"@element-plus/icons-vue": ElementPlusIconsVue`（纯 EP，零行为变化）

### 4.3 Implementation Checklist
- [x] 1. `fetch-icons.mjs`：import 扫描 + 去重 + 空集早退 + 骨架输出（不接真服务，base-url 参数预留）
- [x] 2. `fetch-icons.mjs`：SVG→双份组件文件生成器（light/dark 各一）+ 组合组件 barrel 生成器（含三条 CSS 切换规则；输入用 mock SVG 验证）
- [x] 3. `fetch-icons.mjs`：三步 API 网络函数（getConfig → getIconInfo → getIcon×2，AbortController 超时/单轮/FAIL 不重试/部分成功保留）——接口细节已回填（§2 事实 7-13），color/size/style 默认选取规则已定（§0 已勾选）
- [x] 4. `index.gts.html`：barrel 存在性判断 + Proxy 合并模块 + loadModule 时序处理
- [x] 5. 构造冒烟工程：API 不可达→FAIL 路径验证通过；手动 mock barrel→build 通过；barrel 进入 preview-data 映射验证通过
- [x] 6. SKILL.md 增补图标检索步骤 + 输出格式说明
- [x] 7. 回归：跑一个既有试点工程的 build（无 barrel 时 moduleCache 走原路径，确认零回归）

### 4.5 Route Alignment (Water Flow Check)
- Original assumption: 需要 manifest（AI 写检索词表）+ 名字校验（新门禁）+ 缓存
- Current implementation route: 无 manifest（图标名即检索词，import 扫描自动发现）；无新校验（门禁已存在）；无缓存
- Why it fits code terrain: EP_ICONS 白名单+门禁已在（build.mjs:230-237）；moduleCache 是既有机制
- Scope impact: Changed（比初始讨论大幅收敛，用户四轮拍板）
- User Decision: Accepted（2026-09-22 对话逐项确认）

## 5. Execute Log
- [x] Step 1: `fetch-icons.mjs` 创建——import 扫描（walkFiles 递归 .vue/.js，跳过 assets/icons 避免自引用，正则提取 @element-plus/icons-vue 命名导入并去重）+ 空集早退 + 骨架输出。语法检查通过（`node --check`）
- [x] Step 2: SVG→双份组件文件生成器（light/dark 各一，Vue Options API render 函数 h('span',{class,innerHTML:svg})）+ barrel 生成器（含三条 CSS 切换规则，document.createElement('style') 注入）
- [x] Step 3: 三步 API 网络函数（apiGetConfig/apiGetIconInfo/apiGetIcon，fetch + AbortController 超时，单轮批量，FAIL 不重试）。selectConfigDefaults：size="24"/style="border"/color=colors 中 style="线性" 第一个 id
- [x] Step 4: `index.gts.html` 修改——barrel 存在性判断（SRC["/src/assets/icons/index.js"]）+ Proxy 合并模块（new Proxy(ElementPlusIconsVue, { get: barrel[prop] ?? target[prop] })）+ loadModule 时序（initPromise.then → createApp）
- [x] Step 5: 冒烟验证——(a) API 不可达时 `RESULT: FAIL | fetch failed`（正确）；(b) 手动创建 mock barrel（Search 命中）→ build.mjs `RESULT: OK`（1 page, 1 component, 0 el-tag uses）；(c) barrel 文件正确进入 preview-data.js 映射
- [x] Step 6: SKILL.md 增补 §③.5 fetch-icons 步骤（工作流图 + 用法说明 + 输出格式 + miss 正常说明）
- [x] Step 7: 回归——无 barrel 工程（regression-test）build.mjs `RESULT: OK`（1 page, 1 component, 0 el-tag uses），preview-data.js 不含 icons 路径，零回归

## 6. Review Verdict
- **Review Matrix**:
  - Spec Compliance: ✅ 全部 In-Scope 实现（fetch-icons.mjs 新增 + index.gts.html Proxy + SKILL.md 增补）；Out-of-Scope 未触碰
  - Code Quality: ✅ fetch-icons.mjs 语法检查通过；barrel 组件用 Vue Options API（兼容预览 UMD 运行时）；CSS 切换规则用 document.createElement 注入（幂等，style.id 检查）
  - Build Gate: ✅ build.mjs 通过（有 barrel + 无 barrel 两种路径）
  - Regression: ✅ 无 barrel 时 moduleCache 保持原样（SRC 查不到 → initPromise=Promise.resolve → 原始 EP 图标）
  - Risk Coverage: R-1 已解决（接口已回填）；R-2 低风险（Proxy 对 ElIcon 透明）；R-3 不处理（用户拍板）；R-4 兜底（10s 超时+不重试）；R-5 兜底（dark miss → reuse light）
- **Overall Verdict**: PASS
- **Limitations**: 真实 API 联调未执行（外网环境不可达 `octo.hdesign.huawei.com`）；内网环境需用户验证完整三步 API 流程

## 7. Plan-Execution Diff
- §4.2 fetch-icons.mjs 签名 vs 实现：一致（三步 API + 双份组件 + barrel + CSS 切换 + miss 矩阵 + 输出格式）
- §4.2 index.gts.html Proxy vs 实现：一致（barrel 存在性判断 + Proxy get trap + loadModule 时序），实现用 `.catch` fallback（barrel 加载失败时 console.warn 并保持 EP）
- §4.3 checklist 1-7：全部按计划执行，无偏差
- 偏差：无

## 9. Project Sync Candidates
- 候选: "内网图标替换机制"若验证成立，属可复用工程事实 → 建议同步至 [[ep-coder-generate-ux-prototype]] 记忆
- Sync decision: Not synced（任务收口时处理）

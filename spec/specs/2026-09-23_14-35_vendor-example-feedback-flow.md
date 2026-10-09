# Spec：vendor 新增 007 操作反馈流示例（消息/通知/对话框）

- **日期**：2026-09-23 14:35
- **层级**：Feature Spec
- **状态**：DONE（2026-09-24 验收通过；执行记录见 §6）
- **任务来源**：2026-09-23 会话——组件规范 51 文档沉淀评估（探查 agent 通读），唯一"文档规则密度高 + 与现有 6 示例零重叠 + 纯白名单内"三占候选。②步骤向导（等真实需求）③页签导航局部（与单页骨架冲突）本轮不做。

## 1. 最终目标与边界

**Goal**：给 `skills/generate-ux-prototype/vendor/code-example/references/` 新增 **007 feedback-flow**（操作反馈流整页示范）：用户操作触发的三层反馈——即时消息（ElMessage）、系统通知（ElNotification）、确认与高危确认（ElDialog + ElCheckbox），对应《组件规范/反馈类》消息.md + 通知.md + 对话框.md 三份真值。

**In Scope**
- 示例目录 `references/feedback-flow/`：`index.vue` + `components/` 子组件
- `references/README.md` 索引登记（总览表 007 行 + 详情节 + 分类索引两处）
- `vendor/code-example/SKILL.md` 路由表加一行
- 浮层语义样式经 customClass + 非 scoped 全局样式块实现（挂 body 的浮层 scoped 够不到）
- 试点工程复用 `frost-states-pilot`（用户已裁决保留，入口页加第三项切换）

**Out of Scope**
- 不改 bridge.less 主题槽位（el-message/el-notification 接线进主题层 = 独立后续任务，与 data-material 接线同类）
- 不改 gen-tokens.mjs / build.mjs / init.mjs 等 scripts/
- 不做 ② 步骤向导 / ③ 页签导航 / ④ KPI 记分卡（白名单外自定义实现，等需求）
- ElMessageBox 不纳入（文档真值只有对话框.md 一份，EP MessageBox 语义重复；示例用 ElDialog 覆盖确认场景）

## 2. Research Findings（已核验事实）

1. **消息.md 真值**：全局消息顶部居中、距顶部导航 20px、投影 shadow-3；无关闭图标自动消失 ≥3s，提示/成功 5s、警告/错误 10s；嵌入式消息挤开内容、不自动消失、无阴影、1px `color-brand` 边框（`border-width-normal`）。6 组语义背景：`color-error-subtle`/`color-alert-subtle`/`color-warning-subtle`/`color-success-subtle`/`color-info-subtle`/`color-none-subtle`，图标色 `color-error`/`color-alert`/`color-warning`/`color-success`/`color-info`/`color-none`，文字 `color-text-primary`。内距左右 16px 上下 8px、图标文字间距 8px、圆角 `radius-size-normal`。
2. **通知.md 真值**：右上角、距顶/边 20px、纵向排列**最多 3 条**、最新在顶；自动关闭 ≥3s 同上分档；标题+说明结构；容器内距 16px、标题说明间距 8px、外部边距 `space-size-20`、投影 shadow-3、圆角 `radius-size-normal`；同一套 6 组语义映射。
3. **对话框.md 真值**：L1–L5 尺寸阶梯（6/8/12/16/24 栅格 = 458/616/932/1248px/全屏），L1–L4 垂直居中；**高危确认三原则**：复选框默认不勾选、未确认禁用执行按钮、默认焦点置取消按钮；执行中按钮 loading 防重复触发；右上关闭与取消等效；容器内距/标题内容操作区间距 `space-size-20`、按钮间距 `space-size-16`、圆角 `radius-size-medium`、投影 shadow-6、边框 `border-width-independent`；产品名称作次级信息用 `color-text-secondary`。
4. **token 全就位**：21 个引用 token（含 6 组 subtle/主色对、shadow-3/6、border-width-normal/independent、space-size-20 等）在 default.less 与 dark.less 双主题逐一 grep 确认各 1–2 处。
5. **白名单**：ElMessage/ElNotification/ElDialog 在 element-plus-exports.json；el-dialog/el-checkbox 在 element-plus-components.json。ElMessageBox 不用（避免混淆）。
6. **浮层接线缺口**：bridge.less grep `el-message|el-notification` = 0 行。两组件挂 body，页面 scoped 样式不可达 → 必须走 005 先例"路线一"：`customClass` prop + 组件非 scoped 样式块自实现语义映射。ElDialog 渲染在 mount 点内遮罩层可被 scoped 部分命中，但为统一口径同样走 customClass。
7. ~~**EP 内建能力可直接表达规则**：~~（**执行期修正**：ElNotification **无** `max` prop——拆 2.13.5 UMD 核验，下表"max(条数上限)"为 Plan 期误判）EP 内建能力可直接表达规则：ElMessage `offset`/`duration`/`showClose`/`customClass`；ElNotification `offset`/`duration`/`position`(top-right)/`customClass`（条数上限以队列守卫实现）；ElDialog `width`/`align-center`(2.13.5 支持)/`close-on-click-modal`。
8. **文档歧义定夺**：交互状态列 4 类（提示/成功/警告/错误）与视觉参数列 6 组背景（多 告警alert/失效none 两对）——EP 消息组件仅 4 类型；告警/失效两对在**嵌入式消息区**补齐演示（嵌入式消息自绘不受 EP 类型限制），全局消息/通知走 EP 4 类型映射。
9. **先例**：005/006 均页面级自带实现、零主题层改动；试点复用 + 入口 ElSegmented 加项是 frost-states 已验证模式。

## 3. Detailed Design & Implementation（Plan）

### 3.0 File Changes 总表

| # | 文件 | 动作 |
|---|---|---|
| F1 | `vendor/code-example/references/feedback-flow/index.vue` | 新建 |
| F2 | `vendor/code-example/references/feedback-flow/components/danger-dialog.vue` | 新建 |
| F3 | `vendor/code-example/references/README.md` | 编辑（总览表 + 007 详情节 + 分类索引两处） |
| F4 | `vendor/code-example/SKILL.md` | 编辑（路由表加 1 行） |
| F5 | 试点工程 `frost-states-pilot` 入口页改造（FrostStates/index.vue VIEWS 加"操作反馈流"项 + 拷入子组件） | 编辑 |
| F6 | `.uxproto-pilot/cdp-feedback-flow.mjs` | 新建（冒烟脚本，端口 9232） |

### 3.1 F1：feedback-flow/index.vue（页面结构）

单页三区对照展台，全 token 无 hex，类名连字符形态（禁 `xx--yy`+`::`）。

**区块 1 全局消息**（ElMessage 触发区）：4 个 ElButton（提示/成功/警告/错误）各调 `ElMessage({ type, message, offset: 20, duration, customClass: 'gts-msg gts-msg-<type>' })`，duration 按 5s/5s/10s/10s 分档（演示时配置实际值，注释说明规则）；showClose=true 演示手动关闭路径。

**区块 2 嵌入式消息**（自绘非浮层）：页面内 6 条语义全对照（含 EP 消息没有的 告警/失效 两对）——div.msg-inline + `data-severity` 属性（`error|alert|warning|success|info|none`），scoped 样式 `[data-severity='x'] { background: var(--color-x-subtle); }` 图标色同理；边框 1px `color-brand` + `border-width-normal`、无阴影、不自动消失、ElButton 手动关闭（v-if 演示"挤开内容"重排）。

**区块 3 系统通知**（ElNotification 触发区）：4 类型按钮 + 压力按钮"连发 5 条"验证 `max: 3` 截断；`position: 'top-right', offset: 20, max: 3, duration` 分档同消息；customClass + 全局样式实现标题说明 8px 间距与 6 组语义背景（EP notification 类型 4 种，全局样式只映射 4 类，告警/失效仅嵌入式区演示）。

**区块 4 确认对话框**：普通确认（L1 458px：删除项确认，error 图标 + 取消/执行）+ 高危确认（F2 子组件）。

**全局样式块**（非 scoped，与 005 frost-surface 同款纪律）：`.gts-msg-*` / `.gts-notify-*` 定义背景/图标/文字 token 映射、`radius-size-normal`、shadow-3；注释说明"主题槽位接线进 bridge 是独立任务，当前按路线一示例自实现"。

### 3.2 F2：danger-dialog.vue（高危确认，对话框真值核心）

- ElDialog `width="458px"`（L1，内容单列）、`align-center`（垂直居中）、`close-on-click-modal: false`（关闭按钮与取消等效但点遮罩不放行高危）。
- 结构：标题 + 高危说明（`color-text-secondary` 产品名称行）+ 风险清单文案 + ElCheckbox"我已确认风险"（默认不勾选）+ 底部 取消/执行。
- 三原则硬实现：`checkbox.checked=false` 起步；`:disabled="!confirmed"` 在执行按钮；打开时 `nextTick` focus 取消按钮（对话框真值"默认焦点置于取消按钮"）；执行按钮 `:loading="executing"` 防重复触发，完成后 emit + 关闭。
- scoped 样式：容器内距/区间距 `space-size-20`、按钮间距 `space-size-16`、圆角 `radius-size-medium`；dialog 主题边框 shadow-6 经 customClass 全局样式或 `:deep()` 接线（执行时以 build 通过为准）。

### 3.3 F3/F4：索引登记

**README.md**：总览表 `007 feedback-flow | 操作反馈流：全局消息/嵌入式消息/系统通知/确认与高危确认对照 | ElMessage, ElNotification, ElDialog, ElCheckbox, ElButton | references/feedback-flow/`；详情节含通用规则（时长分档 5s/10s、通知 max 3、高危三原则、嵌入式无阴影不自动消失）；分类索引"按功能类型"加"操作反馈"、按组件表 ElMessage/ElNotification/ElDialog→007。

**SKILL.md** 路由表加：`| 操作结果反馈（消息/通知/确认弹窗） | feedback-flow |`

### 3.4 F5 试点复用

FrostStates/index.vue VIEWS 加 `{ label: '操作反馈流', value: 'feedback-flow' }`，import `./components/feedback-flow.vue`（拷 F1 改名）+ `./components/danger-dialog.vue`（拷 F2）。原两视图不动。重跑 build。

### 3.5 Checklist（原子步骤）

- [x] 1. 写 F1 `feedback-flow/index.vue`（四区块 + customClass 全局语义样式）
- [x] 2. 写 F2 `danger-dialog.vue`（高危三原则硬实现）
- [x] 3. 拷入 frost-states-pilot + 入口页加项（F5）
- [x] 4. build → 修错 → OK
- [x] 5. 写 F6 冒烟脚本（断言见 3.6）→ 全 PASS
- [x] 6. F3/F4 索引登记（验证通过后写）
- [x] 7. 截图 light/dark 用户过目（还原循环协议）
- [x] 8. 记忆锚点追加 + Spec 反向同步 DONE

### 3.6 验证方式

| 层 | 内容 | 判据 |
|---|---|---|
| build 门禁 | 编译 + token/白名单/hex 检查 | RESULT: OK 零 WARN |
| CDP 冒烟 | C1: 消息 4 类型触发后 body 出现 `.gts-msg-*` 且背景 = 对应 `--color-*-subtle` 计算值；C2: 嵌入式 6 条 data-severity 语义全对；C3: 通知连发 5 条时 body 内 `.el-notification` 实例 ≤3；C4: 高危对话框初始执行按钮 disabled + checkbox 点击后 enabled + 焦点在取消；C5: 双主题下 `.gts-msg-error` 背景色随主题变化（dark 断言） | 全 PASS |
| 双主题截图 | light/dark 各 1 张（消息触发态） | 用户过目 |

## 4. 风险与预案

| 风险 | 预案 |
|---|---|
| customClass 全局样式被 build token 检查误伤（非 scoped less 内 var() 引用） | 005 已有非 scoped 块先例通过；若 FAIL 则样式改为 CSS 变量直引主题生成的 var（本来就是同机制），排查类名 |
| ElMessage/ElNotification UMD 挂 body 的组件 SSR/时序问题 | 冒烟用 awaitPromise + 轮询 body 查询，先例 cdp 脚本模式 |
| `align-center` prop 在 EP 2.13.5 不存在 | 回退 `top="15vh"` 近似垂直居中（文档 L1–L4 垂直居中语义保底） |
| 高危"焦点置取消"实现依赖 dialog open 事件时序 | 用 `@open` + nextTick + ref.focus()；UMD 下 defineExpose 已知坑不涉及（仅读 ref） |
| 嵌入式消息"挤开内容"演示破坏页面布局验收 | 用固定高度容器内 v-if 切换，溢出由容器吸收 |
| 告警/失效 6 组 vs EP 4 类型错配造成误导 | 注释显式说明：EP 浮层仅 4 类型，6 组完整对照在嵌入式区；生成时以此口径 |

## 4.1 Done Contract

- 007 示例文件落地且 build OK + 冒烟全 PASS
- README/SKILL.md 索引登记一致
- 双主题截图用户过目
- 记忆锚点更新 + Spec 反向同步 DONE

## 5. Resume / Handoff

- **恢复锚点**：本 Spec 唯一真相源；中断恢复先看 §3.5 Checklist 断点。
- **关键结论**：① 浮层 token 映射走 customClass + 非 scoped 全局样式（bridge 零接线、scoped 不可达 body）；② 时长/条数/位置规则用 EP 原生 props（duration/offset/max/position）表达，不自造；③ 高危三原则是 F2 验收核心（disabled 绑定 + 焦点置取消 + loading 防重复）；④ 6 组语义 vs EP 4 类型的错配口径 = 嵌入式区补全演示。
- **下一步动作**：等 `Plan Approved` → 按 Checklist 1→8 执行（batch 需用户说"全部"，默认单步）。

## 6. 执行记录（2026-09-23 → 2026-09-24，DONE）

**F1–F6 全部完成**，最终验证链：build `RESULT: OK (2 pages, 6 components, 0 el-tag uses)` + CDP 冒烟 `RESULT: OK | 19/19 PASS`（cdp-feedback-flow.mjs，端口 9232）+ 双主题截图（feedback-light.png / feedback-dark.png）用户验收通过。

**Plan 期偏差与修正**（按 §3 Change Log 纪律）：

| # | Plan 期认知 | 执行期真相 | 处置 |
|---|---|---|---|
| 1 | ElNotification 有 `max` prop（finding #7） | 2.13.5 UMD 无 max（拆包核验） | "最多 3 条"改队列守卫实现（notifyQueue ref 数组，while ≥3 shift 最老 handle.close()）；vendor 文件内所有 max 字样清除 |
| 2 | 默认焦点 `@open` + nextTick 可行 | focus-trap 在 open 期间抢走焦点 | 改 `@opened`（入场动画 + focus-trap 初始化完成后）+ nextTick + ref.$el.focus() |
| 3 | F1 一次成型 | `<style scoped lang="less">` 开标签重复 → sfc-loader **静默**不注入样式块（无报错，冒烟 15→17 才暴露） | 删重复标签；此失败模式记入 SKILL.md UMD 已知坑 |
| 4 | 通知可见性判定用 offsetParent | fixed 定位元素 offsetParent 恒 null；关闭后 DOM 残留 display:none 节点 | 冒烟改 `getComputedStyle(n).display !== 'none'` 过滤 |
| 5 | build 两错：ElIcon 未 import + `--color-fill-1`（不存在） | 正确 token 为 `--color-fill-subtle` | 修正 import 与 token |

**验收插曲**：用户对嵌入式 6 行统一蓝色边框提出质疑——回查《消息》规范原文（"边框为系统高亮默认色、1px"+ 视觉参数 "border-width-normal + color-brand"）确认系**规范明文**（语义只分背景/图标色，边框统一 brand），按规范裁决通过，实现未改。

**遗留**（Out of Scope 重申）：浮层语义配色 bridge.less 槽位接线 = 独立后续任务；SKILL.md UMD 已知坑小节未同步 sfc-loader 样式标签重复条目（可作后续微补）。

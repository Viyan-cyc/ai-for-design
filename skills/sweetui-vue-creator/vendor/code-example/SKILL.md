# code-example —— 优秀整页实践（占位）

整页参考代码库：完整的页面结构 + 组件组合，可直接作为生成起点。
**示例文件尚未生成**——示例须在内网以 SweetUI 5.6.5 实跑重写（离线无法验证组件行为），
本目录当前只含索引结构与归档规范。

## 内网重写流程（HANDOFF 驱动）

1. 以 EP 版（`generate-ux-prototype/vendor/code-example/`）的 7 个示例为形态蓝本
   （见其 `references/README.md`：001–007 的用途/结构/通用规则说明仍然有效）；
2. 逐个以 SweetUI 组件重写并**实跑验证**（`scripts/preview/` 环境或真实工程）：
   - 001 table-search-drawer：El* → sweet-*（表格/分页/抽屉/标签/表单），
     分页 current-page 走 v-model 绑 ref；
   - 002 mixed-chart：vue-echarts VChart → sweet-barline-chart（或 sweet-echarts 基底 +
     option），配色 readToken 从 `document.body` 读 `--color-chart-*`；
   - 003 glow-cards / 004 frost-decor-card / 005 frost-material：纯 CSS 形态，token 名不变，
     核对 `--color-*-subtle`、`--frost-*` token 在双主题下均可用；
   - 006 content-states：ElSegmented → sweet-radio-group（按钮形态）或 sweet-tabs；
     ElResult/ElSkeleton/ElEmpty → sweet-result/sweet-skeleton/sweet-empty；
   - 007 feedback-flow：ElMessage → sweet-message 命令式、ElNotification → $sweetNotify
     （**无 max 参数**——队列守卫逻辑保留）、确认弹窗 → $confirm Promise；
3. 重写完成后按下方「归档规范」落盘并更新索引，删除本 README 的「占位」说明。

## 核心原则

- **按需加载**：只加载与当前任务相关的示例文件。
- **禁止全量读取**：不得一次性读取 references 下所有示例。
- **精准匹配**：按需求类型从索引选最接近的示例。

## 使用流程

1. 读 `references/README.md`（示例索引：编号 / 用途 / 核心组件 / 路径）。
2. 按需求类型定位示例，只读选定示例的文件，每次最多 **2 个**（主文件 + 一个组件文件）。
3. 在示例结构上填充业务内容，不改示例自身文件。

## 归档新示例

完成一个新的优秀页面后可归档：在 `references/` 下建示例目录（主文件 `index.vue` +
`components/` 子组件，子组件文件小写中划线命名），并更新 README 索引表。

**命名与代码规范**：

- 示例目录小写中划线（如 `table-search-drawer`），主文件 `index.vue`；
- 组件按需 import，模板标签 kebab-case（`sweet-*`），图标 `<icon-plus name="X" />`；
- 样式 `<style scoped lang="less">`，GTS Token 取值，不写静态内联 style、不写 hex；
- 分页 current-page 绑 ref；多行文本 sweet-input type="textarea"；确认走 $confirm。

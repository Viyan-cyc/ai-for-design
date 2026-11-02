# 工作台与对话资产：内网补齐验收报告

## 版本信息
- SweetUI: 5.7.0 (npm @hw-seq/sweet-ui-base)
- Vue compiler-sfc: 3.5.29
- Node: v24.18.0 (system)
- skill 内部 name: gts-sweetui-coder (包路径 gts-sweetui-coder1)

## 执行操作

1. **ensure-env**: RESULT OK — compiler lock hash 一致
2. **verify-build**: 31/31 PASS — 全部回归通过
3. **init sweetui-foundation-check**: 创建验收工程
4. **copy-foundation**: workbench-shell.vue + conversation-composer.vue 复制到 components/foundation/
5. **验收页改造**: 将 workbench-conversation/index.vue 复制为验收页入口，补充 references (2条) 和 commands (2条) 以触发 @/ 建议
6. **cleanup + build**: 通过，1 个预期 WARN（dynamic icon binding: item.icon，由 menus 数据驱动，属正常设计）
7. **search-detail 独立工程**: init → 组件复制 → build 通过

## 定向 API 核对结果

以实际 npm 5.7.0 ES 源码逐一比对：

| 组件 | 属性/事件 | npm 实际类型 | 资产用法 | 兼容 |
|---|---|---|---|---|
| SweetButton | `text` | Boolean | `text` (无绑定) | ✅ |
| SweetButton | `loading` | Boolean | 未使用 | N/A |
| SweetButton | `disabled` | Boolean | `:disabled="busy"` / `:disabled="!canSend"` | ✅ |
| SweetButton | `type` | String, values含 "primary"/"text" 等共12种 | `type="primary"` | ✅ |
| SweetInput | `modelValue` | [String,Number,Object], default "" | `v-model="query"` | ✅ |
| SweetInput | `clearable` | Boolean | `clearable` | ✅ |
| SweetSelect | `modelValue` | [Array,String,Number,Boolean,Object] | `:model-value="model"` | ✅ |
| SweetSelect | `update:modelValue` | emit | `@update:model-value="..."` | ✅ |
| SweetOption | `value` | [String,Number,Boolean,Object], required | `:value="item.id"` | ✅ |
| SweetOption | `label` | [String,Number] | `:label="item.label"` | ✅ |
| SweetIcon | `iconClass` | String (JS prop name, 模板用 icon-class) | `icon-class="..."` | ✅ |
| SweetIcon | `size` | [Number,String] | `:size="18"` / `:size="16"` | ✅ |
| SweetDrawer | `modelValue` | Boolean (继承自 dialogProps) | 未在当前资产使用 | N/A |
| SweetDrawer | `size` | [String,Number], default "30%" | 未在当前资产使用 | N/A |

**结论**: 全部定向接口与 npm 5.7.0 实际声明一致，无需修改。

## 图标核实

资产使用的 7 个图标全部在 sweetui-icons.json 白名单中，无强制色 (hasForcedColor: false)：
- sweetui-icon-menu-l, sweetui-icon-nav-fold, sweetui-icon-close, sweetui-icon-add-l, sweetui-icon-file-l, sweetui-icon-stop-l, sweetui-icon-arrow-up

字体图标在浏览器中的实际可见性、渲染尺寸需浏览器确认（本环境无浏览器）。

## 废弃文件清理

- assets/foundation/manifest.json: 不存在（已在前轮清理）
- assets/foundation/1.0.0/: 不存在（已在前轮清理）
- .gts-assets.json: 验收工程内不存在

## 浏览器验收项（未验证）

以下项目需要用户在真实浏览器中操作确认，本环境未运行浏览器：

1. **工作台交互**: 收展导航、搜索过滤、菜单选中、工作区新增/切换/关闭、全关闭空态、会话面板显隐；窄宽度不横向滚动
2. **输入器交互**: 中文输入法 composing 时不误发、Enter 发送、Shift+Enter 换行、空输入禁发、busy 禁止重发、stop 取消定时器；模型选项变化事件
3. **附件交互**: 选择/移除、重选同一文件、仅附件发送；文件仅本地
4. **@/ 建议**: 输入 @ 或 / 触发建议列表、上下键选择、Enter 确认、Escape 关闭
5. **主题切换**: setTheme('uDesign2.2-dark') / setTheme('uDesign2.2-light') 下正文、边界、选中、焦点色及图标是否正常
6. **国际化**: 切换语言后 labels、菜单/页签、placeholder/disclaimer 翻译是否生效，输入和分页状态不丢失
7. **npm Vue 工程验证**: 验收页在 vite/Vue 工程（如 sweetui-vue-check）中直接 import 真实 SweetUI 全量注册后组件交互

## 不涉及项

- **图表/看板**: 本轮不引入 dt-ui/ECharts，无图表运行库
- **SweetUI 原生接线**: theme.js、i18n/index.js、runtime.js、UMD/CSS 未修改
- **旧包 gts-sweetui-coder**: 未修改 EP 及旧包内容
- **全量 token/图标调查**: 不重新提取，维护现有 whitelist

## 回传文件

- `output/sweetui-foundation-check/` — 工作台+输入器验收工程（构建通过）
- `output/sweetui-search-detail-check/` — 查询详情独立验收工程（构建通过）
- `output/sweetui-coder-handoff/foundation-changes.patch` — 验收页补丁（+references/commands）
- `output/sweetui-coder-handoff/foundation-acceptance.md` — 本报告
# WorkbenchShell

顶部导航 48px，主导航收起 48px/展开 216px，工作区页签行 48px。高度由容器提供；主内容使用插槽，不固定左右分栏。主导航与“最近会话”是不同状态；后者由调用方实现。

复制 workbench-shell 后，从 `./components/foundation/workbench-shell.vue` 导入。

| 接口 | 内容 |
|---|---|
| brand / workspaceName | 品牌与工作台名称 |
| menus | `{id,label,icon,tone}` 数组；icon 为显式导入的 EP 图标，tone 可为 blue/green/purple |
| tabs | `{id,title,status,closable}` 数组；status: done/pending/idle，closable 默认可关闭 |
| activeTab / activeMenu | 调用方控制选中 ID |
| select-menu / select-tab / close-tab | 传对应 ID，调用方更新状态 |
| new-tab / sessions | 请求新增页签或切换业务面板 |
| tools 插槽 | 右上角工具，不自动加入主题/语言切换 |
| default 插槽 | 业务内容，流式宽度，min-height:0，自行定义滚动区域 |

内部只管理导航收展、菜单搜索与临时收藏；收藏不持久化。导航项须有实际目标，未接入的模块应明确说明。调用方关闭活动页签后选相邻页签，关闭全部后展示可操作空态；数据列表用 ref。多页签实例需要保留输入时使用 v-show/既有缓存策略；忙碌任务切页或关闭后的资源清理由业务负责。

主题继承 html[data-theme]，组件不改主题，也不定义 --el-*。只替换配置及业务插槽即可复用；不在常规集成中改写固定外观。需要不同骨架时按参考/场景生成，不为了复用强套。

无业务 API、无 mock、无全局 store 依赖。原生按钮是该资产的复合结构实现，不作为普通页面放弃 EP 的先例。

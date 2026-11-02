# SweetUI 新结构内网交接

仅在 D:\project\gts\ai-for-design\skills\gts-sweetui-coder1 更新；旧 gts-sweetui-coder 只读，内部 name 保持 gts-sweetui-coder。先保存本地差异，再同步新版文本文件。不要用外网占位资源覆盖内网实际 public/library。

新版结构：references 规则、components 组件用法、components/conversation-composer.vue 独立输入器、patterns/workbench 工作台组合、其他 patterns 查询表单等、scripts/preview 运行模板。copy-components.mjs 替代 copy-foundation.mjs。旧 vendor 和 assets 下的参考代码已迁移；确认未有内网独有改动后再清理旧路径，不保留重复源。以本次 Git diff 删除清单为准。

当前外网工作台仅完成结构整理，仍是简化布局；不得声称已完成 EP 完整视觉迁移。请以 EP 的 patterns/workbench 为参考，在 SweetUI 同名目录补齐会话、分析结果和证据布局，使用真实 npm API、token、图标。不要恢复模拟模型回复和定时生成逻辑，不增加字体变量或覆盖官方主题。

npm：D:\project\gts\ai-for-design\node_modules\@hw-seq\sweet-ui-base。保持现有 UMD、主题、i18n 接线及 index.gts.html。检查工作台原生发送/停止事件与业务请求接口；示例不调用真实模型。

验证：运行 node scripts/verify-build.mjs；按 patterns/workbench/README.md 从新目录装配，再构建。浏览器检查布局、发送事件、中文输入法、附件、模型选择、查询分页抽屉、主题和语言切换。与 EP 同窗口状态对照，保留用户认可的视觉结构。

回传到 D:\project\gts\ai-for-design\output\sweetui-coder1-structure-handoff：全部变更文本 ZIP、真实 diff、删除路径、测试记录与截图（能获取时）。核对 ZIP 依赖完整，不修改旧包或 EP。

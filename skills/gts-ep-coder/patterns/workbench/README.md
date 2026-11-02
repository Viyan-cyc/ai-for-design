# 工作台模式装配

1. 使用 init 创建 workbench-foundation 工程，PAGE 为 WorkbenchFoundation。
2. 将本目录 index.vue、workbench-shell.vue、components/ 和 api/（存在时）复制到 src/pages/WorkbenchFoundation/，保留相对位置。不要复制 README。App.vue 保持挂载该页面。
3. 在 skill 根目录执行 `node scripts/copy-components.mjs --dir "<工程>" --page WorkbenchFoundation --assets conversation-composer`。
4. 按 SKILL.md 完成图标处理、cleanup-starter 和 build。

主题和运行资源只使用 init 提供的文件。输入器复制到页面 components/foundation/；该路径保留现有工程兼容性，不是另一份源文件。发送只提供输入 payload，不模拟模型回复；真实请求、busy 和停止由调用方接入。示例报告仅用于展示排版。

入口通过 send 事件提供 `{sessionId,text,files,model}`，stop 提供 sessionId；调用方通过 busyBySession 对象控制各会话忙碌状态，示例自身不模拟请求。

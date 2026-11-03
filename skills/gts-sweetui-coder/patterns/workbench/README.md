# 工作台模式装配

1. 使用 init 创建工程：`node scripts/init.mjs "<输出目录>" "workbench-foundation"`，PAGE 取名 WorkbenchFoundation。
2. 将本目录文件复制到 `src/pages/WorkbenchFoundation/`，按以下布局（不要复制 README）：
   ```
   index.vue                                  ← 页面入口
   workbench-shell.vue                        ← Shell 外框（与 index.vue 同级）
   components/
     ai-workspace.vue                         ← AI 工作区
     resource-workspace.vue                   ← 资源工作区
     session-panel.vue                        ← 会话面板
   api/
     workbench.js                             ← API 抽象层
     mock/workbench-data.js                   ← Mock 数据
   ```
3. 在 skill 根目录执行 `node scripts/copy-components.mjs --dir "<工程>" --page WorkbenchFoundation --assets conversation-composer`。此命令将 `components/conversation-composer.vue` 安装到 `components/foundation/conversation-composer.vue`，ai-workspace.vue 的 import `./foundation/conversation-composer.vue` 指向此文件。
4. 按 SKILL.md 完成图标处理、cleanup-starter 和 build。

主题和运行资源只使用 init 提供的文件。输入器复制到页面 components/foundation/；该路径保留现有工程兼容性，不是另一份源文件。发送只提供输入 payload，不模拟模型回复；真实请求、busy 和停止由调用方接入。示例报告仅用于展示排版。

入口通过 send 事件提供 `{sessionId,text,files,model}`，stop 提供 sessionId；调用方通过 busyBySession 对象控制各会话忙碌状态，示例自身不模拟请求。

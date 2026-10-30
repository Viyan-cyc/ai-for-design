# ConversationComposer

独立的一体化对话输入器，不要求 WorkbenchShell。复制 conversation-composer 后，从 `./components/foundation/conversation-composer.vue` 导入。

| 接口 | 内容 |
|---|---|
| modelValue / update:modelValue | 受控文本，可用 v-model |
| model / update:model | 模型 ID，可用 v-model:model |
| models | `{id,label}` 数组，调用方明确设置初始 model |
| busy | 调用方控制生成状态；为 true 时禁用发送，显示停止按钮 |
| placeholder | 可覆盖输入提示；关闭引用/命令能力时同步修改提示 |
| references | 可选 `{id,label}` 数组，尾部 @ 触发建议 |
| commands | 可选 `{id,label,value}` 数组，尾部 / 触发建议 |
| send | `{text, files: File[], model}`；仅通知，不上传/调用模型 |
| stop | 请求调用方取消当前生成 |

文本最多 4000 字；Enter 发送，Shift+Enter 换行，IME composing 时不发送。支持建议上下键、Enter、Escape。输入高度最大 140px，之后内部滚动。引用是文本标记，不自动读取引用文件。附件由用户主动选择，仅在浏览器持有 File；关闭/重建组件会丢失未提交附件。

调用方 send 事件需立即复制并保存请求内容，再设置 busy 并调用服务；失败时显示失败，按业务需要恢复草稿。当前组件发出 send 后清空文本与附件，附件失败重试应使用父级保存的请求副本；不声称上传成功。父级 stop 必须取消实际请求/定时器；仅切换图标不算实现停止。

主题跟随 GTS，保持单一输入外轮廓。内部语义化 textarea/select/button 为复合资产例外，不通过 :deep 改写 EP。不要在外面再套一个带边框的表单输入框。

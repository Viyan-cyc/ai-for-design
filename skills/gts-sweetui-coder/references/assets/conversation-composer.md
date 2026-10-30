# ConversationComposer

从 ./components/foundation/conversation-composer.vue 导入，可独立使用。

|接口|含义|
|---|---|
|modelValue / update:modelValue|受控草稿|
|model / update:model|受控模型 ID；models 为 {id,label} 数组，空数组隐藏选择器|
|busy|生成中显示停止，禁止发送|
|placeholder / disclaimer|由业务提供；不默认宣称是演示或真实模型|
|references / commands|可选 {id,label} / {id,label,value}；尾部 @ 和 / 触发建议，不读取文件|
|labels|可响应式覆盖 suggestions/references/commands/remove/input/attach/model/busy/stop/send；国际化使用父级 computed + 公共 t.value|
|send|{text,files:File[],model}，仅发事件，不上传或调用模型|
|stop|父级取消实际请求/定时器，不能只改变 busy|

Enter 发送，Shift+Enter 换行，中文输入法 composing 时不发送；建议支持上下键/Enter/Escape。文本最多 4000 字，输入区最大 140px 后内部滚动。附件只在浏览器持有。
父级 send 中立即保存请求副本，再设置 busy。发送后输入器清空已发送草稿和附件；失败重试使用父级保存的请求，不能覆盖用户随后输入的新草稿。未提交附件在组件销毁时丢失，切换工作区需保留实例。
不要在外层重复套输入框边界；原生 textarea 是一体化输入结构需要，普通表单仍使用 SweetInput。

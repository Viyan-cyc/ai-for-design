# SweetForm / SweetFormItem
显式导入 SweetForm、SweetFormItem。SweetForm 使用 :model、:rules、ref；SweetFormItem 使用 label、prop，prop 对应 model 中的字段。
提交先 await formRef.value.validate()，验证通过才调用服务；校验拒绝与服务失败分开处理，不把校验不通过提示为网络错误。可用方法：validate、validateField、resetFields、clearValidate、scrollToField、getField。
resetFields 恢复挂载时值，编辑不同记录时显式同步 model，必要时 nextTick 后 clearValidate。不要假定校验接口在预览中不可用；内网验收使用真实组件 ref 检查。

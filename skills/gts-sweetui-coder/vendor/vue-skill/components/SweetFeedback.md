# 消息与确认
~~~js
import { SweetMessage, SweetMessageBox, SweetNotification } from '@hw-seq/sweet-ui-base'
SweetMessage.success('保存成功')
SweetMessage.error('保存失败')
SweetNotification({ title: '提醒', message: '操作已完成', type: 'success' })
~~~
SweetMessageBox.confirm(message, title, options) 返回 Promise，确认后再执行服务；取消单独处理，不弹网络错误。命令式 API 不作模板标签使用。

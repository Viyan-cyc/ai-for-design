// AlarmInsight — 页面词条（单文件双语言；free 模式：无 G 组件，全部手写）

export const messages = {
  title:    { zh: '告警洞察', en: 'Alarm Insight' },
  subtitle: { zh: '近 7 日告警趋势与未闭环明细', en: '7-day alarm trend and open items' },
  trend:    { zh: '告警趋势（近 7 日）', en: 'Trend (last 7 days)' },
  openList: { zh: '未闭环告警', en: 'Open Alarms' },
  level:    { zh: '级别', en: 'Level' },
  count:    { zh: '数量', en: 'Count' },
  device:   { zh: '设备', en: 'Device' },
  time:     { zh: '触发时间', en: 'Triggered At' },
  ack:      { zh: '确认', en: 'Acknowledge' },
  ackOk:    { zh: '已确认', en: 'Acknowledged' },
}

// 页面显示语言：'zh' | 'en'（原型期常量；运行时切换随 vue-i18n 引入）
const LANG = 'zh'

export const t = Object.fromEntries(
  Object.entries(messages).map(([key, val]) => [key, typeof val === 'string' ? val : val[LANG] || val.zh]),
)

// AlarmInsight — Mock 数据 + API 请求模拟（free 模式验证页）

const handTrend = [
  { date: '09-06', critical: 3, warning: 9, info: 14 },
  { date: '09-07', critical: 5, warning: 7, info: 11 },
  { date: '09-08', critical: 2, warning: 12, info: 9 },
  { date: '09-09', critical: 6, warning: 8, info: 15 },
  { date: '09-10', critical: 4, warning: 10, info: 12 },
  { date: '09-11', critical: 1, warning: 6, info: 8 },
  { date: '09-12', critical: 3, warning: 9, info: 10 },
]

const handAlarms = [
  { id: 'A-1021', level: 'critical', device: '配电监测终端-PM-102', message: '三相电流不平衡超限', time: '2026-09-12 09:31' },
  { id: 'A-1020', level: 'warning',  device: '能耗采集器-EM-090',   message: '功率因数低于阈值', time: '2026-09-12 09:12' },
  { id: 'A-1019', level: 'critical', device: '风机控制器-FC-311',   message: '轴承温度越限', time: '2026-09-12 08:47' },
  { id: 'A-1018', level: 'info',     device: '液位计-LT-508',       message: '数据上报延迟', time: '2026-09-12 08:20' },
  { id: 'A-1017', level: 'warning',  device: '视频摄像头-IPC-221',  message: '码流异常波动', time: '2026-09-12 07:55' },
  { id: 'A-1016', level: 'info',     device: '门禁控制器-AC-033',   message: '离线超过 10 分钟', time: '2026-09-12 07:30' },
]

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchTrend() {
  await delay(200)
  return { list: handTrend }
}

export async function fetchOpenAlarms({ level = '', page = 1, pageSize = 20 } = {}) {
  await delay()
  let list = handAlarms
  if (level) list = list.filter((a) => a.level === level)
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total }
}

export async function acknowledgeAlarm(id) {
  await delay(200)
  return { success: true, id }
}

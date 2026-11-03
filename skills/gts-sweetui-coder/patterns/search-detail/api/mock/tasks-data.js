const types = ['bug', 'feature', 'task']
const statuses = ['running', 'warning', 'error', 'idle']
const statusLabels = { running: '运行中', warning: '告警', error: '错误', idle: '空闲' }
const prefixes = ['华北', '华南', '华东', '西南', '西北']
const names = ['监控采集', '日志分析', '告警聚合', '数据同步', '权限校验', '配置下发', '拓扑发现', '性能基线', '容量预测', '变更审计']
export const tasks = []
for (let i = 1; i <= 35; i++) {
  const type = types[(i - 1) % types.length]
  const status = statuses[(i - 1) % statuses.length]
  const prefix = prefixes[(i - 1) % prefixes.length]
  const name = names[(i - 1) % names.length]
  const month = String(((i - 1) % 12) + 1).padStart(2, '0')
  const day = String(((i - 1) % 28) + 1).padStart(2, '0')
  tasks.push({
    id: i,
    name: `${prefix}-${name}-${String(i).padStart(2, '0')}`,
    type,
    status,
    date: `2026-${month}-${day}`,
    value: Math.round(50 + Math.sin(i) * 80 + 80),
    region: prefix,
    owner: ['基础设施组', '平台工程组', '网络运维组'][(i - 1) % 3],
    updated: `2026-${month}-${day} ${String(8 + ((i - 1) % 12)).padStart(2, '0')}:${String(((i - 1) * 7) % 60).padStart(2, '0')}`
  })
}

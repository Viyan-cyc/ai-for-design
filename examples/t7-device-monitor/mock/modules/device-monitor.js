// DeviceMonitor — Mock 数据 + API 请求模拟
// 约定：函数签名按 REST 语义设计（页面消费形状与真实接口一致）
// 二次开发时：只改 src/api/device-monitor.js，本文件保持不动

// 手写前 10 条保状态多样性；其余生成器扩展（D13④ 混合策略）
const handwritten = [
  { id: '1',  name: '边缘网关-GW-001',   region: 'east',      status: 'running',     cpu: 62, updatedAt: '2026-09-12 09:41' },
  { id: '2',  name: '温湿度传感器-TH-014', region: 'east',    status: 'running',     cpu: 31, updatedAt: '2026-09-12 09:38' },
  { id: '3',  name: '配电监测终端-PM-102', region: 'north',   status: 'maintenance', cpu: 88, updatedAt: '2026-09-12 09:30' },
  { id: '4',  name: '视频摄像头-IPC-221',  region: 'south',   status: 'running',     cpu: 45, updatedAt: '2026-09-12 09:40' },
  { id: '5',  name: '门禁控制器-AC-033',  region: 'north',    status: 'stopped',     cpu: 0,  updatedAt: '2026-09-11 22:15' },
  { id: '6',  name: '液位计-LT-508',      region: 'southwest', status: 'pending',    cpu: 12, updatedAt: '2026-09-12 08:52' },
  { id: '7',  name: '烟感探测器-SD-176',  region: 'east',     status: 'running',     cpu: 23, updatedAt: '2026-09-12 09:39' },
  { id: '8',  name: '能耗采集器-EM-090',  region: 'south',    status: 'running',     cpu: 71, updatedAt: '2026-09-12 09:35' },
  { id: '9',  name: '红外对射-IR-004',    region: 'north',    status: 'idle',        cpu: 5,  updatedAt: '2026-09-12 07:10' },
  { id: '10', name: '风机控制器-FC-311',  region: 'southwest', status: 'stopped',    cpu: 0,  updatedAt: '2026-09-10 18:44' },
]

const statuses = ['running', 'running', 'running', 'idle', 'maintenance', 'stopped', 'pending']
const regions = ['east', 'north', 'south', 'southwest']
const more = Array.from({ length: 38 }, (_, i) => ({
  id: String(i + 11),
  name: `接入设备-${String(i + 11).padStart(3, '0')}`,
  region: regions[i % regions.length],
  status: statuses[i % statuses.length],
  cpu: (i * 13) % 95,
  updatedAt: `2026-09-1${i % 3} ${String(8 + (i % 3)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`,
}))

const mockData = [...handwritten, ...more]

function delay(ms = 300) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchList({ keyword = '', page = 1, pageSize = 20 } = {}) {
  await delay()
  let list = mockData
  if (keyword) list = list.filter((item) => item.name.includes(keyword))
  const total = list.length
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, pageSize }
}

export async function fetchSummary() {
  await delay(200)
  const online = mockData.filter((d) => d.status === 'running').length
  const offline = mockData.filter((d) => d.status === 'stopped').length
  const cpuSum = mockData.reduce((acc, d) => acc + d.cpu, 0)
  return {
    online: { value: String(online), delta: '+3', trend: 'up' },
    alarm: { value: '6', delta: '-2', trend: 'down' },
    offline: { value: String(offline), delta: '0', trend: 'up' },
    cpu: { value: `${Math.round(cpuSum / mockData.length)}%`, delta: '+1.2%', trend: 'up' },
  }
}

export async function createRecord(payload) {
  await delay()
  const record = { id: String(Date.now()), status: 'pending', cpu: 0, ...payload }
  mockData.unshift(record)
  return { data: record }
}

export async function deleteRecord(id) {
  await delay()
  const idx = mockData.findIndex((item) => item.id === String(id))
  if (idx !== -1) mockData.splice(idx, 1)
  return { success: true }
}

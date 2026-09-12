// EventOpsCenter — Mock 数据 + API 请求模拟
// 约定：函数签名按 REST 语义设计（页面消费形状与真实接口一致）
// 二次开发时：只改 src/api/event-ops-center.js，本文件保持不动

const mockData = [
  { id: '1', name: 'EventOpsCenter示例-01', status: 'running' },
  { id: '2', name: 'EventOpsCenter示例-02', status: 'stopped' },
  { id: '3', name: 'EventOpsCenter示例-03', status: 'pending' },
  { id: '4', name: 'EventOpsCenter示例-04', status: 'idle' },
  { id: '5', name: 'EventOpsCenter示例-05', status: 'maintenance' },
]

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

export async function fetchDetail(id) {
  await delay(200)
  return { data: mockData.find((item) => item.id === String(id)) || null }
}

export async function createRecord(payload) {
  await delay()
  const record = { id: String(Date.now()), status: 'pending', ...payload }
  mockData.unshift(record)
  return { data: record }
}

export async function deleteRecord(id) {
  await delay()
  const idx = mockData.findIndex((item) => item.id === String(id))
  if (idx !== -1) mockData.splice(idx, 1)
  return { success: true }
}

import { tasks } from './mock/tasks-data.js'
export async function getTaskList({ keyword = '', type = '', dateRange = [], page = 1, pageSize = 20 } = {}) {
  const rows = tasks.filter(row => row.name.includes(keyword.trim()) && (!type || row.type === type) &&
    (!dateRange?.[0] || row.date >= dateRange[0]) && (!dateRange?.[1] || row.date <= dateRange[1]))
  const start = (Math.max(1, page) - 1) * pageSize
  return { list: rows.slice(start, start + pageSize).map(row => ({ ...row })), total: rows.length }
}

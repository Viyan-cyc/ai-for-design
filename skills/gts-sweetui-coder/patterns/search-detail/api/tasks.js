import { tasks } from './mock/tasks-data.js'
export async function getTaskList({ keyword = '', type = '', status = '', page = 1, pageSize = 10 } = {}) {
  const rows = tasks.filter(row =>
    row.name.includes(keyword.trim()) &&
    (!type || row.type === type) &&
    (!status || row.status === status)
  )
  const start = (Math.max(1, page) - 1) * pageSize
  return { list: rows.slice(start, start + pageSize).map(row => ({ ...row })), total: rows.length }
}

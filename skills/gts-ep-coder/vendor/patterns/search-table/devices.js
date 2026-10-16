import { devices } from './mock/devices.js'
export async function getDevices({ keyword = '', page = 1, pageSize = 10 } = {}) {
  const rows = devices.filter(row => row.name.toLowerCase().includes(keyword.trim().toLowerCase()))
  return { list: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length }
}

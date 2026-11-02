import { records } from './mock/records.js'
export async function getRecords() { return records.map(row => ({ ...row })) }
export async function saveRecord(record) {
  const name = record.name.trim()
  if (!name) throw new Error('名称不能为空')
  const row = records.find(item => item.id === record.id)
  if (!row) throw new Error('记录已不存在')
  Object.assign(row, { name, status: record.status })
  return { ...row }
}

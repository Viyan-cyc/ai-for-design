export async function createRecord(input) {
  const name = String(input.name || '').trim()
  if (!name) throw new Error('名称不能为空')
  return { id: Date.now(), name, category: input.category }
}

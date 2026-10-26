export async function createRecord(input){
  const name=String(input.name||'').trim()
  if(!name)throw new Error('资源名称不能为空')
  return {id:Date.now(),name}
}
export async function deleteRecord(id){if(!id)throw new Error('资源ID不能为空');return {id}}

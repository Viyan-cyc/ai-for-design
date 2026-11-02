import { operationResult } from './mock/operation-result.js'
export async function executeDemoOperation() {
  await new Promise(resolve => setTimeout(resolve, 600))
  return { ...operationResult }
}

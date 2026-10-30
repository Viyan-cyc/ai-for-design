import { events } from './mock/events-data.js'
export async function getEvents() {
  await new Promise(resolve => setTimeout(resolve, 600))
  return events.map(row => ({ ...row }))
}

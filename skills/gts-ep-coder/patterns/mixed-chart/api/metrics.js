import { metrics } from './mock/metrics-data.js'
export async function getMetrics() {
  return { months: [...metrics.months], production: [...metrics.production], growth: [...metrics.growth] }
}

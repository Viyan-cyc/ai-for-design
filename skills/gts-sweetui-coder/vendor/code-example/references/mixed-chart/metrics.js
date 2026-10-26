import { points } from './mock/metrics-data.js'
export async function getMetrics(){return points.map(x=>({...x}))}

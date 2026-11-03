import { chartData } from './mock/demo-data.js'
export async function getChartData() { return { categories: [...chartData.categories], values: [...chartData.values] } }

import { samples } from './mock/chart-data.js'
export async function getCharts(mode) { return samples.filter(row => mode === 'all' || row.id === mode) }

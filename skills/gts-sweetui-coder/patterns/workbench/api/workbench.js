import { resources, sessions, evidence, report } from './mock/workbench-data.js'
const clone = data => JSON.parse(JSON.stringify(data))
export async function getResources() { return clone(resources) }
export async function getSessions() { return clone(sessions) }
export async function getEvidence() { return clone(evidence) }
export async function getReport() { return clone(report) }

import { resources, sessions, evidence } from './mock/foundation-data.js'
const clone = data => JSON.parse(JSON.stringify(data))
export async function getResources() { return clone(resources) }
export async function getSessions() { return clone(sessions) }
export async function getEvidence() { return clone(evidence) }

import { report } from './mock/foundation-data.js'
export async function getReport(){return clone(report)}

import { resources, sessions, evidence } from './mock/foundation-data.js'
const clone = data => JSON.parse(JSON.stringify(data))
export async function getResources() { return clone(resources) }
export async function getSessions() { return clone(sessions) }
export async function getEvidence() { return clone(evidence) }
export async function getDemoReply(text) { return `演示回复：已收到“${text}”。这里展示组件的发送与生成状态，未连接真实模型；附件仅保留在当前浏览器会话中。` }

import { report } from './mock/foundation-data.js'
export async function getReport(){return clone(report)}

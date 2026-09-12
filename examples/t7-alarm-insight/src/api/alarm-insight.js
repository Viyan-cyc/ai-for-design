// AlarmInsight — 接口适配层（二次开发唯一必改文件）
// 原型态：直接转发 mock；上线态：把每个导出换成真实 HTTP 请求。

import {
  fetchTrend as mockFetchTrend,
  fetchOpenAlarms as mockFetchOpenAlarms,
  acknowledgeAlarm as mockAcknowledgeAlarm,
} from '../../mock/modules/alarm-insight.js'

function fetchTrend() { return mockFetchTrend() }
function fetchOpenAlarms(params) { return mockFetchOpenAlarms(params) }
function acknowledgeAlarm(id) { return mockAcknowledgeAlarm(id) }

export { fetchTrend, fetchOpenAlarms, acknowledgeAlarm }

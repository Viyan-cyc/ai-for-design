// DeviceMonitor — 接口适配层（二次开发唯一必改文件）
// 【二开演练态】T7 验收：mock 实现换成「假 axios」调用，页面零改动。

import request from './request.js'
import * as mock from '../../mock/modules/device-monitor.js'

// 假 axios 路由表：URL/方法与真实后端一致，handler 挂 mock 实现
request.on('GET', '/api/device-monitor', (params) => mock.fetchList(params))
request.on('GET', '/api/device-monitor/summary', () => mock.fetchSummary())
request.on('POST', '/api/device-monitor', (payload) => mock.createRecord(payload))
request.on('DELETE', /^\/api\/device-monitor\/.+$/, (id) => mock.deleteRecord(id))

async function fetchList(params) { return (await request.get('/api/device-monitor', { params })).data }
async function fetchSummary() { return (await request.get('/api/device-monitor/summary')).data }
async function createRecord(payload) { return (await request.post('/api/device-monitor', payload)).data }
async function deleteRecord(id) {
  return (await request.delete(`/api/device-monitor/${id}`)).data
}

export { fetchList, fetchSummary, createRecord, deleteRecord }

// EventOpsCenter — 接口适配层（二次开发唯一必改文件）
// 原型态：直接转发 mock；上线态：把每个导出换成真实 HTTP 请求。
// 约定：导出名、参数、返回形状与 mock 完全一致，页面代码零改动。

export {
  fetchList,
  fetchDetail,
  createRecord,
  deleteRecord,
} from '../../mock/modules/event-ops-center.js'

// 二次开发示例（替换上面 re-export 后启用；request 为你自建的 axios 实例文件）：
// import request from "./request" // 你的 axios 实例
// export function fetchList(params) { return request.get("/api/event-ops-center", { params }) }
// export function fetchDetail(id) { return request.get("/api/event-ops-center/" + id) }
// export function createRecord(payload) { return request.post("/api/event-ops-center", payload) }
// export function deleteRecord(id) { return request.delete("/api/event-ops-center/" + id) }

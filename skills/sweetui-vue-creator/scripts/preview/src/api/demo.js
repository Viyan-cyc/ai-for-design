// ============================================================
// 服务层示例：页面只 import 这里的函数，不直接接触 mock 数据。
// 对接真实后端时，仅改本文件实现（换 fetch/axios），页面零改动。
// ============================================================
import { demoDevices } from './mock/demo-data.js'

const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

export async function getDeviceList({ keyword = '', page = 1, pageSize = 10 } = {}) {
  await delay()
  const filtered = demoDevices.filter((it) => it.name.includes(keyword))
  return {
    list: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
  }
}

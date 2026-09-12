// request.js — T7 二开演练用的假 axios 实例：URL/方法与真实后端一致，handler 挂 mock
const routes = []

function match(method, url) {
  for (const r of routes) {
    if (r.method !== method) continue
    if (r.url instanceof RegExp) {
      const m = url.match(r.url)
      if (m) return () => r.handler(m[1])
    } else if (r.url === url) {
      return r.handler
    }
  }
  return null
}

export default {
  on(method, url, handler) { routes.push({ method, url, handler }) },
  async get(url, config = {}) {
    const h = match('GET', url)
    if (!h) throw new Error(`404 GET ${url}`)
    return { code: 0, data: await h(config.params || {}) }
  },
  async post(url, body) {
    const h = match('POST', url)
    if (!h) throw new Error(`404 POST ${url}`)
    return { code: 0, data: await h(body) }
  },
  async delete(url) {
    const h = match('DELETE', url)
    if (!h) throw new Error(`404 DELETE ${url}`)
    return { code: 0, data: await h() }
  },
}

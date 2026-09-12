// i18n 入口 — 语言资源统一在此：lang/*/common.json 跨页共享，pages/{slug}.js 页面级
// 预览环境简单对象合并；真实工程用 vue-i18n 时把两个语言对象拆进 JSON 即可
import zhCNCommon from './lang/zh-CN/common.json'
import enUSCommon from './lang/en-US/common.json'

export const messages = {
  'zh-CN': { common: zhCNCommon },
  'en-US': { common: enUSCommon },
}

// EventOpsCenter — 页面词条（单文件双语言；每页一个文件，一次写完）
// messages 存双语言源；t 按 LANG 展平成字符串，模板直接 {{ t.xxx }}。
// 接 vue-i18n 时把 messages 的 zh/en 拆成两个 JSON，页面模板零改动。

export const messages = {
  title:   { zh: 'EventOpsCenter', en: 'EventOpsCenter' },
  refresh: { zh: '刷新', en: 'Refresh' },
  status:  { zh: '状态', en: 'Status' },
}

// 页面显示语言：'zh' | 'en'（原型期常量；运行时切换随 vue-i18n 引入）
const LANG = 'zh'

export const t = Object.fromEntries(
  Object.entries(messages).map(([key, val]) => [key, typeof val === 'string' ? val : val[LANG] || val.zh]),
)

// DeviceMonitor — 页面词条（单文件双语言；每页一个文件，一次写完）
// 模板经 {{ t.xxx }} 引用；将来上 vue-i18n 时把 zh/en 拆成两个 JSON，页面零改动

export const messages = {
  title:      { zh: '设备监控', en: 'Device Monitor' },
  subtitle:   { zh: '全部接入设备的实时运行概览', en: 'Realtime overview of all connected devices' },
  searchPlaceholder: { zh: '搜索设备名称', en: 'Search device name' },
  search:     { zh: '查询', en: 'Search' },
  reset:      { zh: '重置', en: 'Reset' },
  create:     { zh: '新增设备', en: 'Add Device' },
  name:       { zh: '设备名称', en: 'Device Name' },
  region:     { zh: '所属区域', en: 'Region' },
  status:     { zh: '运行状态', en: 'Status' },
  cpu:        { zh: 'CPU 负载', en: 'CPU Load' },
  updated:    { zh: '最后上报', en: 'Last Report' },
  actions:    { zh: '操作', en: 'Actions' },
  edit:       { zh: '编辑', en: 'Edit' },
  remove:     { zh: '删除', en: 'Delete' },
  confirmDelete: { zh: '确认删除该设备？', en: 'Delete this device?' },
  deleteOk:   { zh: '已删除', en: 'Deleted' },
  createOk:   { zh: '已创建', en: 'Created' },
  emptyHint:  { zh: '没有匹配的设备，调整筛选条件试试', en: 'No devices match; adjust the filters' },
  metricOnline:  { zh: '在线设备', en: 'Online Devices' },
  metricAlarm:   { zh: '活跃告警', en: 'Active Alarms' },
  metricOffline: { zh: '离线设备', en: 'Offline Devices' },
  metricCpu:     { zh: '平均 CPU 负载', en: 'Avg CPU Load' },
  refresh:    { zh: '刷新', en: 'Refresh' },
}

// 页面显示语言：'zh' | 'en'（原型期常量；运行时切换随 vue-i18n 引入）
const LANG = 'zh'

export const t = Object.fromEntries(
  Object.entries(messages).map(([key, val]) => [key, typeof val === 'string' ? val : val[LANG] || val.zh]),
)

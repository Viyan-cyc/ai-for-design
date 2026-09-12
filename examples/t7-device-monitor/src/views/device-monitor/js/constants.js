// DeviceMonitor — 常量定义
// 常量命名：全大写 + 下划线（如 ALARM_LEVEL）

// 组件模式开关（生成时确认）：'reuse' 命中库组件必须复用 | 'hybrid' 命中复用未命中手写 | 'free' 全手写
export const COMPONENT_MODE = 'hybrid'

// 样式语言（D22）：全工程统一 less，禁止 scss
export const STYLE_LANG = 'less'

// GStatusTag 的 status prop 取值（business/GStatusTag）
export const STATUS_OPTIONS = ['success', 'warning', 'danger', 'offline', 'normal']

// 业务运行态 → GStatusTag status 映射
export const DEVICE_STATUS_MAP = {
  running:     { label: '运行中', status: 'success' },
  stopped:     { label: '已停止', status: 'danger' },
  pending:     { label: '待审核', status: 'warning' },
  idle:        { label: '空闲',   status: 'normal' },
  maintenance: { label: '维护中', status: 'warning' },
}

export const REGION_OPTIONS = [
  { label: '华东', value: 'east' },
  { label: '华北', value: 'north' },
  { label: '华南', value: 'south' },
  { label: '西南', value: 'southwest' },
]

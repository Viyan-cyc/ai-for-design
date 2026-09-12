// EventOpsCenter — 常量定义
// 常量命名：全大写 + 下划线（如 ALARM_LEVEL）

// 组件模式开关（生成时确认）：'reuse' 命中库组件必须复用 | 'hybrid' 命中复用未命中手写 | 'free' 全手写
export const COMPONENT_MODE = 'hybrid'

export const STATUS_MAP = {
  running:     { label: '运行中', type: 'success' },
  stopped:     { label: '已停止', type: 'danger' },
  pending:     { label: '待审核', type: 'warning' },
  idle:        { label: '空闲',   type: 'info' },
  maintenance: { label: '维护中', type: 'warning' },
}

export const STATUS_OPTIONS = [
  { label: '运行中', value: 'running' },
  { label: '已停止', value: 'stopped' },
  { label: '待审核', value: 'pending' },
  { label: '空闲',   value: 'idle' },
  { label: '维护中', value: 'maintenance' },
]

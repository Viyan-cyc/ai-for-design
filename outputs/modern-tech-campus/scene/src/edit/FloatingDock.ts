/**
 * edit/FloatingDock — 浮动面板停靠位置
 *
 * 排队模型：先出现的贴右栏左缘（槽 0），后出现的往左排队一格；横向放不下时纵向
 * 下移一整档（错位至前一档底部之下，同列不叠、不叠右栏）。位置仅默认值——
 * FloatingPanel 可拖拽，且自带 resize 钳制。
 */

const MARGIN = 16;
const GAP = 12;
const TOP_RATIO = 0.16;

/** 纵向档高（面板 max-height 上限，档间错位步长 = 档高 + GAP） */
const ROW_H = 430;

/** 右侧固定面板预留（右属性栏 292 宽 + 14 右 margin + 12 间距） */
const RIGHT_RESERVE = 318;

/** 左侧固定面板占位（左树 248 宽 + 14 左 margin + 12 间距） */
const LEFT_RESERVE = 274;

export interface DockPos {
  x: number;
  y: number;
}

/** 第 slot 号浮动面板的默认位置（panelW = 面板宽度） */
export const defaultDockPos = (slot: number, panelW: number): DockPos => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const rightEdge = vw - RIGHT_RESERVE;
  const leftLimit = LEFT_RESERVE;
  // 横向可容纳的并排数（至少 1）
  const perRow = Math.max(1, Math.floor((rightEdge - leftLimit) / (panelW + GAP)));
  const row = Math.floor(slot / perRow);
  const col = slot % perRow;
  const x = Math.max(leftLimit, rightEdge - panelW - col * (panelW + GAP));
  // 纵向排队：档高 + GAP 完整错位（矮窗放不下时不硬拉回——面板由 FloatingPanel 钳制在视口内，可拖）
  const y = Math.max(MARGIN, Math.round(vh * TOP_RATIO)) + row * (ROW_H + GAP);
  return { x, y };
};

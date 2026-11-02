/**
 * appearance — 编译外观模块（strip-edit 自动生成，P4.1）
 *
 * 内容来自编辑器保存快照的 __visuals / __materialLib，已剥离编辑器
 * 交互态（locked）；由 scene-core/appearance-runtime 在装配期应用。
 * 重新导出运行包时本文件会被整文件覆盖——不要手改（改了下次 strip 丢失）。
 * 审计：字段与 TRANSCRIPTION.md 的视觉表逐条对应。
 */
import type { MaterialLibEntry, VisualOverride } from '../../scene-core/index';

/** 节点视觉层（nodeId → override；来自 __visuals，locked 已剥离） */
export const compiledVisuals: Record<string, VisualOverride> = {};

/** 材质库（mat_id → 条目；仅被引用的条目，未被引用的种子不进运行包） */
export const compiledMaterialLib: Record<string, MaterialLibEntry> = {};

/* H Design 色彩.docx 映射。原文与使用规则：source/h-design-color-spec.md、source/h-design-color-mappings.md。 */
/* 兼容现有组件变量；在主题边界重新绑定，支持嵌套主题。非颜色尺寸保持原值。 */
:root,
[data-theme] {
  --g-brand: {{components|--g-brand}};
  --g-accent: {{components|--g-accent}};
  --g-success: {{components|--g-success}};
  --g-urgent: {{components|--g-urgent}};
  --g-important: {{components|--g-important}};
  --g-warning: {{components|--g-warning}};
  --g-bg-page: {{components|--g-bg-page}};
  --g-bg-surface: {{components|--g-bg-surface}};
  --g-bg-hover: {{components|--g-bg-hover}};
  --g-text-primary: {{components|--g-text-primary}};
  --g-text-secondary: {{components|--g-text-secondary}};
  --g-text-disabled: {{components|--g-text-disabled}};
  --g-border: {{components|--g-border}};
  --g-focus: {{components|--g-focus}};
  --g-mask: {{components|--g-mask}};
  --g-glass-surface: {{components|--g-glass-surface}};
  --g-glass-surface-soft: {{components|--g-glass-surface-soft}};
  --g-glass-border: {{components|--g-glass-border}};
  --g-glass-shadow: {{components|--g-glass-shadow}};
  --g-topology-node-normal: {{components|--g-topology-node-normal}};
  --g-topology-node-success: {{components|--g-topology-node-success}};
  --g-topology-node-warning: {{components|--g-topology-node-warning}};
  --g-topology-node-danger: {{components|--g-topology-node-danger}};
  --g-control-height: {{components|--g-control-height}};
  --g-control-radius: {{components|--g-control-radius}};
  --g-table-header-height: {{components|--g-table-header-height}};
  --g-table-row-height: {{components|--g-table-row-height}};
  --g-panel-gap: {{components|--g-panel-gap}};
}

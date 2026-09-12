/* H Design 色彩.docx 映射。原文与使用规则：source/h-design-color-spec.md、source/h-design-color-mappings.md。 */
/* 先加载 Element Plus 基础样式，再加载 tokens/index.scss。 */
:root,
[data-theme] {
  --el-color-primary: {{element-plus|--el-color-primary}};
  --el-color-primary-light-3: {{element-plus|--el-color-primary-light-3}};
  --el-color-primary-light-5: {{element-plus|--el-color-primary-light-5}};
  --el-color-primary-light-7: {{element-plus|--el-color-primary-light-7}};
  --el-color-primary-light-8: {{element-plus|--el-color-primary-light-8}};
  --el-color-primary-light-9: {{element-plus|--el-color-primary-light-9}};
  --el-color-primary-dark-2: {{element-plus|--el-color-primary-dark-2}};
  --el-bg-color-page: {{element-plus|--el-bg-color-page}};
  --el-bg-color: {{element-plus|--el-bg-color}};
  --el-bg-color-overlay: {{element-plus|--el-bg-color-overlay}};
  --el-text-color-primary: {{element-plus|--el-text-color-primary}};
  --el-text-color-regular: {{element-plus|--el-text-color-regular}};
  --el-text-color-secondary: {{element-plus|--el-text-color-secondary}};
  --el-text-color-placeholder: {{element-plus|--el-text-color-placeholder}};
  --el-text-color-disabled: {{element-plus|--el-text-color-disabled}};
  --el-border-color: {{element-plus|--el-border-color}};
  --el-border-color-light: {{element-plus|--el-border-color-light}};
  --el-border-color-lighter: {{element-plus|--el-border-color-lighter}};
  --el-border-color-extra-light: {{element-plus|--el-border-color-extra-light}};
  --el-border-color-dark: {{element-plus|--el-border-color-dark}};
  --el-border-color-darker: {{element-plus|--el-border-color-darker}};
  --el-border-color-hover: {{element-plus|--el-border-color-hover}};
  --el-fill-color: {{element-plus|--el-fill-color}};
  --el-fill-color-light: {{element-plus|--el-fill-color-light}};
  --el-fill-color-lighter: {{element-plus|--el-fill-color-lighter}};
  --el-fill-color-extra-light: {{element-plus|--el-fill-color-extra-light}};
  --el-fill-color-dark: {{element-plus|--el-fill-color-dark}};
  --el-fill-color-darker: {{element-plus|--el-fill-color-darker}};
  --el-fill-color-blank: {{element-plus|--el-fill-color-blank}};
  --el-mask-color: {{element-plus|--el-mask-color}};
  --el-mask-color-extra-light: {{element-plus|--el-mask-color-extra-light}};
  --el-overlay-color: {{element-plus|--el-overlay-color}};
  --el-overlay-color-light: {{element-plus|--el-overlay-color-light}};
  --el-overlay-color-lighter: {{element-plus|--el-overlay-color-lighter}};
  --el-disabled-bg-color: {{element-plus|--el-disabled-bg-color}};
  --el-disabled-text-color: {{element-plus|--el-disabled-text-color}};
  --el-disabled-border-color: {{element-plus|--el-disabled-border-color}};
  --el-border-radius-base: {{element-plus|--el-border-radius-base}};
  --el-component-size: {{element-plus|--el-component-size}};
  --el-color-success: {{element-plus|--el-color-success}};
  --el-color-success-light-3: {{element-plus|--el-color-success-light-3}};
  --el-color-success-light-5: {{element-plus|--el-color-success-light-5}};
  --el-color-success-light-7: {{element-plus|--el-color-success-light-7}};
  --el-color-success-light-8: {{element-plus|--el-color-success-light-8}};
  --el-color-success-light-9: {{element-plus|--el-color-success-light-9}};
  --el-color-success-dark-2: {{element-plus|--el-color-success-dark-2}};
  --el-color-warning: {{element-plus|--el-color-warning}};
  --el-color-warning-light-3: {{element-plus|--el-color-warning-light-3}};
  --el-color-warning-light-5: {{element-plus|--el-color-warning-light-5}};
  --el-color-warning-light-7: {{element-plus|--el-color-warning-light-7}};
  --el-color-warning-light-8: {{element-plus|--el-color-warning-light-8}};
  --el-color-warning-light-9: {{element-plus|--el-color-warning-light-9}};
  --el-color-warning-dark-2: {{element-plus|--el-color-warning-dark-2}};
  --el-color-danger: {{element-plus|--el-color-danger}};
  --el-color-danger-light-3: {{element-plus|--el-color-danger-light-3}};
  --el-color-danger-light-5: {{element-plus|--el-color-danger-light-5}};
  --el-color-danger-light-7: {{element-plus|--el-color-danger-light-7}};
  --el-color-danger-light-8: {{element-plus|--el-color-danger-light-8}};
  --el-color-danger-light-9: {{element-plus|--el-color-danger-light-9}};
  --el-color-danger-dark-2: {{element-plus|--el-color-danger-dark-2}};
  --el-color-error: {{element-plus|--el-color-error}};
  --el-color-error-light-3: {{element-plus|--el-color-error-light-3}};
  --el-color-error-light-5: {{element-plus|--el-color-error-light-5}};
  --el-color-error-light-7: {{element-plus|--el-color-error-light-7}};
  --el-color-error-light-8: {{element-plus|--el-color-error-light-8}};
  --el-color-error-light-9: {{element-plus|--el-color-error-light-9}};
  --el-color-error-dark-2: {{element-plus|--el-color-error-dark-2}};
  --el-color-info: {{element-plus|--el-color-info}};
  --el-color-info-light-3: {{element-plus|--el-color-info-light-3}};
  --el-color-info-light-5: {{element-plus|--el-color-info-light-5}};
  --el-color-info-light-7: {{element-plus|--el-color-info-light-7}};
  --el-color-info-light-8: {{element-plus|--el-color-info-light-8}};
  --el-color-info-light-9: {{element-plus|--el-color-info-light-9}};
  --el-color-info-dark-2: {{element-plus|--el-color-info-dark-2}};
}
.el-button--primary {
  --el-button-hover-bg-color: {{element-plus-2|--el-button-hover-bg-color}};
  --el-button-hover-border-color: {{element-plus-2|--el-button-hover-border-color}};
  --el-button-active-bg-color: {{element-plus-2|--el-button-active-bg-color}};
  --el-button-active-border-color: {{element-plus-2|--el-button-active-border-color}};
  --el-button-disabled-bg-color: {{element-plus-2|--el-button-disabled-bg-color}};
  --el-button-disabled-border-color: {{element-plus-2|--el-button-disabled-border-color}};
}
.el-button--primary.is-plain {
  --el-button-bg-color: {{element-plus-3|--el-button-bg-color}};
  --el-button-hover-bg-color: {{element-plus-3|--el-button-hover-bg-color}};
  --el-button-hover-border-color: {{element-plus-3|--el-button-hover-border-color}};
  --el-button-disabled-bg-color: {{element-plus-3|--el-button-disabled-bg-color}};
  --el-button-disabled-border-color: {{element-plus-3|--el-button-disabled-border-color}};
}
.el-button--warning {
  --el-button-text-color: {{element-plus-4|--el-button-text-color}};
  --el-button-hover-text-color: {{element-plus-4|--el-button-hover-text-color}};
  --el-button-active-text-color: {{element-plus-4|--el-button-active-text-color}};
}
.el-tag.el-tag--warning {
  --el-tag-text-color: {{element-plus-5|--el-tag-text-color}};
}
.el-alert--warning {
  --el-alert-title-color: {{element-plus-6|--el-alert-title-color}};
  --el-alert-description-color: {{element-plus-6|--el-alert-description-color}};
}
.el-input,
.el-textarea,
.el-select {
  --el-input-hover-border-color: {{element-plus-7|--el-input-hover-border-color}};
  --el-input-focus-border-color: {{element-plus-7|--el-input-focus-border-color}};
  --el-input-bg-color: {{element-plus-7|--el-input-bg-color}};
  --el-select-input-focus-border-color: {{element-plus-7|--el-select-input-focus-border-color}};
  --el-select-border-color-hover: {{element-plus-7|--el-select-border-color-hover}};
}
.el-table {
  --el-table-header-bg-color: {{element-plus-8|--el-table-header-bg-color}};
  --el-table-row-hover-bg-color: {{element-plus-8|--el-table-row-hover-bg-color}};
  --el-table-current-row-bg-color: {{element-plus-8|--el-table-current-row-bg-color}};
  --el-table-border-color: {{element-plus-8|--el-table-border-color}};
  --el-table-header-text-color: {{element-plus-8|--el-table-header-text-color}};
}
.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell { background: var(--color-table-zebra); }

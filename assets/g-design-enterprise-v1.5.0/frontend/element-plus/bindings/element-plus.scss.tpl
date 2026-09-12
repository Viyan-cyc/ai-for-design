// 基础编译值来自色彩.docx；运行时主题和状态在 element-plus.css 中映射。
@forward "element-plus/theme-chalk/src/common/var.scss" with (
  $colors: (
    "primary": ("base": {{resolve:semantic-light|--color-brand}}),
    "success": ("base": {{resolve:semantic-light|--color-success}}),
    "warning": ("base": {{resolve:semantic-light|--color-warning}}),
    "danger": ("base": {{resolve:semantic-light|--color-error}}),
    "error": ("base": {{resolve:semantic-light|--color-error}}),
    "info": ("base": {{resolve:semantic-light|--color-info}})
  ),
  $border-radius: ("base": {{element-plus-dimensions|--el-compile-size-4}}, "small": {{element-plus-dimensions|--el-compile-size-2}}, "round": {{element-plus-dimensions|--el-compile-size-20}}, "circle": 100%),
  $common-component-size: ("large": {{element-plus-dimensions|--el-compile-size-40}}, "default": {{element-plus-dimensions|--el-compile-size-32}}, "small": {{element-plus-dimensions|--el-compile-size-24}})
);

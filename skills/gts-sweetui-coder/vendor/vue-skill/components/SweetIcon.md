# SweetIcon
显式导入 SweetIcon，使用 iconClass（模板 icon-class）、size（数字或字符串）、color。
~~~vue
<SweetIcon icon-class="sweetui-icon-search-l" :size="16" />
~~~
完整类名从 scripts/verify/whitelists/sweetui-icons.json 选取；不拼后缀。hasForcedColor 表示该类带自己的色彩规则，无法直接据名称认定它会随文字色变化；需要控制颜色时按真实样式确认。
动态图标用完整名称配置数组，不拼接字符串。空 contentCode 不直接判定废弃，部分图标通过其他 CSS 规则呈现。

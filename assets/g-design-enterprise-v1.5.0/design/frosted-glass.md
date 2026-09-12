# 毛玻璃材质

适用：明确需要材质强调的标签、次级按钮、概览卡片和轻量浮层。普通业务页面默认实色。数值唯一来源：[tokens.json](tokens.json)；按需查询 `frost-common`、`frost-light`、`frost-dark`，完整值见生成的 [tokens.md](tokens.md)。

## 选择预设

| 角色 | 档位 | 选择规则 |
| --- | --- | --- |
| AI 建议、推荐标签、次级工具按钮 | control | 同一区域只突出 1–3 个；主操作和告警保留原语义 |
| 指标、智能摘要、少量概览卡片 | card | 默认白色磨砂，使用受控柔和背景；同屏重点卡通常 1–3 张 |
| 菜单、浮动工具条、轻量面板 | overlay | 复杂背景优先提高填充不透明度，长篇内容用实色 |

档位使用 `--frost-blur-*`、`--frost-surface-*`、`--frost-shadow-*` 成套参数。AI 不在每个组件上自由生成模糊值。面积变大不自动提高 blur；先判断背景复杂度与文字可读性。

## 应用预算

- 常驻毛玻璃建议占主内容视口 10%–20%，上限先按 25%；淡彩毛玻璃不超过 8%，计入总量。预算不是必须用满的目标，也不代替性能测试。
- 面积按可见表面的并集计算，重叠只算一次；底层渐变不计入模糊面积。单张重点卡建议不超过视口 12%；小标签约 1% 内，工具按钮约 2% 内。
- 临时浮层单独评估；常驻侧栏、表格行、单元格、编辑表单、长篇内容采用实色。
- 一个位置只保留一层背景模糊。毛玻璃卡片内的按钮与标签使用实色或透明填充，不重复开启 backdrop-filter。

## 背景与染色

- 层次顺序：中性基底 → 边缘缓慢淡出的雾蓝/灰紫渐变 → 中性毛玻璃填充与背景模糊 → 清晰内容。渐变放在独立父级 `.g-frost-backdrop`。
- 白色磨砂为默认；深色使用对应中性深灰。淡彩通过 `--frost-tint-blue/lavender/teal` 薄染色层叠加，一页优先一种染色；不表示成功、告警等功能状态。
- 背景使用 `--frost-backdrop-*`；默认静态、大范围淡出。避免鲜艳色块、彩虹分段、持续漂移和发光轮廓。
- 默认不提高背景饱和度；复杂背景可选择 muted。纯色背景没有可模糊细节，不通过不断提高 blur 补偿。
- 填充 alpha 不等于组件 opacity；文字与图标始终清晰。圆角遵循原组件规范。

## 状态与回退

- hover / active 只调整背景填充和阴影，使用公共增量 Token；不改变 blur。焦点使用既有清晰轮廓，选中状态保留品牌边界或标记。
- 禁用使用原禁用语义并移除模糊；多层嵌套自动停止内层模糊。
- 不支持 backdrop-filter、减少透明度或产品主动降级时使用 `--frost-surface-solid` 完全不透明表面。产品可在作用域设置 `data-transparency="reduced"`。
- 减少动态效果时关闭过渡；高对比模式使用系统颜色。
- 按实际合成背景核对文字可读性；普通文本对比度至少 4.5:1。切换主题、背景和滚动位置后仍需清晰；编译通过不代表视觉验收。

## 色块装饰

品牌色重点卡片保留色彩重量与统一白字，通过弱渐变和边角磨砂图形丰富留白。它与整块浅色毛玻璃是两种变体；不要为加装饰把重点色块先改成浅色。

- 自动选用指 **AI 在生成页面时判断**：区域承担总览/主指标/品牌展示，存在大面积单调色底，边角可避开文字，才默认选用。参考尺寸至少 240 × 112 CSS px；尺寸达标不代表必须装饰。常见大卡片无色底或内容密集时保持原样。
- 同一组默认只选 1 张主卡，同屏通常 1 处、最多 2 处。普通卡片、导航、按钮、表格、表单、图表绘图区、告警/成功语义色块不使用。用户明确要求简洁或不装饰时关闭。
- 顺序：同色相弱渐变底 → 边角磨砂图形 → 清晰内容。保留 1–2 个裁切圆形/圆角图形，默认右上和右侧，无持续动画；不新增紫、粉等色相。装饰可见面积建议为宿主 10%–20%、不超过 25%，并计入前述模糊面积预算；不为凑比例放大。
- 默认白色填充由 10% 淡至 2.5%，描边 13%，模糊引用 control 档。标题、数字和标签使用同一白色，以字号/字重区分主次；趋势含正负号或文字。按合成后的底色核对文字对比度，避免高光压住文本。
- 参数唯一源：tokens.json 的 **frost-decoration**；默认 card，宽幅概览可用 panel 比例。不在每次生成时重新编造透明度、几何尺寸或图形数量。
- `data-surface="brand"` 选择品牌蓝渐变和白字；`data-decoration="frosted"` 独立启用装饰；可选 `data-decoration-size="panel"`。其他色底先建立与主题匹配的语义映射并检查白字对比度，再仅使用装饰属性。宿主圆角、尺寸和业务布局保持组件规范。
- 宿主采用不透明色底；不要同时设置 data-material="frosted"，也不嵌套背景模糊。图形是无语义伪元素，不拦截点击，不进入键盘焦点；组件原有伪元素、定位子项冲突时使用专用容器承载装饰。关闭装饰、减少透明度或高对比模式时保留清晰内容和重点层级。

```html
<GMetricCard data-surface="brand" data-decoration="frosted"
  title="全部事件" :value="24" delta="+6 今日新增" />
```

实现：frontend/element-plus/bindings/frost-decoration.css.tpl，随 glass.css 既有入口加载。普通 HTML 使用同名属性即可；包根 examples/frosted-color-card.html 提供可离线打开的轻量示例。默认只选一张主卡，其他浅色卡片仍使用既有 surface 变体。

## 调用与兼容

```html
<div class="g-frost-backdrop">
  <GMetricCard data-material="frosted" data-frost-level="card" title="服务可用率" value="99.8%" />
</div>
<GButton data-material="frosted" data-frost-level="control" data-frost-tint="blue">AI 建议</GButton>
```

- `data-material="frosted"` 显式启用；`data-frost-level="control|card|overlay"` 选择档位，省略档位默认 card。
- `data-frost-tint="blue|lavender|teal"` 为可选薄染色；不设置时为中性磨砂。`data-frost-tone="muted"` 可降低背景饱和度。
- 新页面配置使用 `visualStyle: "frosted-glass"`；设备管理模板仅示范前三张指标卡，其他模板先提供柔和头图，不自动把所有内容变成毛玻璃。真实页面仍按面积预算选择。
- 旧 `aurora-glass` 风格、`--glass-*` 变量和 `.g-glass-*` 类继续可用，统一映射到新材质；新增组件优先使用 frost 命名。
- 实现入口为 `frontend/element-plus/bindings/frosted.css.tpl`；生成的 `tokens/frosted.css` 由旧 `glass.css` 入口引入，旧项目导入方式不变。
- 计划示例：包根 `examples/frosted-device-plan.json`。改数值后运行 build_tokens.mjs；按包 README 更新索引、来源锁并验证。

参考原则来自 [Fluent Acrylic](https://learn.microsoft.com/en-us/windows/apps/design/style/acrylic) 与 [Apple Materials](https://developer.apple.com/design/human-interface-guidelines/materials)；档位和面积是本产品约定，并非平台官方数值。背景模糊机制见 [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/backdrop-filter)，文本对比度依据 [WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)。

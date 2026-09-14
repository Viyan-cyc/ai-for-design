# G Design Enterprise V1.5（内嵌资产库）

本目录内嵌于 generate-ux-prototype skill，两个区域：**design** 管数值与规则，**frontend/element-plus/tokens** 管生成的 CSS token 层（init 拷入工作区）。

## 最常用入口

- [设计数值](design/tokens.json)、[使用规则](design/rules.md)、[生成数值表](design/tokens.md)
- 颜色入口：[颜色使用规范](design/color-rules.md)、[颜色 Token 与用途表](design/color-tokens.md)（后者由 tokens.json 自动生成）
- 局部毛玻璃材质见 [frosted-glass.md](design/frosted-glass.md)

## 查询

```sh
node scripts/query_assets.mjs tokens --search frost   # token 分组查询；只返回必要内容，避免模型全量读取
```

## 数值更新（pure 分支）

本库是上游完整包的快照：`design/tokens.json` 为数值源，`frontend/element-plus/tokens/*.css` 为生成产物。本分支不含再生成器（build_tokens 等脚本已随组件层移除）——设计师在上游更新后整体替换 design/ 与 frontend/element-plus/tokens/ 即可；生成原型读取 manifest 的实际版本，不从文件夹名字推断。

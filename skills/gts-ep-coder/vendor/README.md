# 页面参考资产

从 `../references/page-routing.md` 选型，优先 `patterns/` 的已验证模板；复制接线见 `patterns/README.md`。验证状态、依赖和已知边界见 `asset-manifest.json`。

- `patterns/`：搜索表格、表单弹窗的可运行起点。
- `vue-skill/components/`：按组件查API示例；`vue-skill/references/components_index.md`用于选型。
- `vue-skill/templates/`、`code-example/`：历史结构参考，默认unverified；示例不能覆盖设计目录或真实API。

页面生成只读vendor，不回查开发机原始规范；具体token来自随包消费资料。只读需要的文件，不要求固定阅读数量或整份错误清单。维护者更新设计后使用gen-tokens同步主题、速查与manifest。

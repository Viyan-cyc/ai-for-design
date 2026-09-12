---
name: manage-design-assets
description: Maintain G Design tokens, design rules and shared components; compare and sync reusable prototype changes within user-authorized scope.
---

# 维护设计资产

用户指定库优先；否则读取 agents/package-location.json 核对包根 skill-catalog.json，整包模式可读上两级 AI-ENTRY.md。根据任务选择以下一种路径，不要求 Token 修改先生成原型。

## 数值、规则和公共实现

- 数值只改 design/tokens.json；通用、颜色、毛玻璃规则分别维护 design/rules.md、design/color-rules.md、design/frosted-glass.md。保留提炼后的规范，不添加原始附件。
- 组件/模板规范维护 components/specs、components/templates；实现维护 frontend/element-plus/src。依赖、文件列表和 Token 索引由脚本生成。
- 按库 README 生成、验证并更新来源锁；涉及实现时构建和检查受影响交互。不要同步手改的生成 CSS 作为新数值源。
- 版本按用户要求；未要求新版本时在当前目录迭代。公共组件提案的版本策略见 references/decision-rules.md。

## 从原型同步可复用组件/模板

1. 读取原型 asset-selection.json 和库契约，核对库与选定资产。
2. 运行 scripts/compare_assets.mjs CONTRACT PROTOTYPE LIBRARY -o proposal.json，按 [decision-rules.md](references/decision-rules.md) 区分公共资产和业务私有变化。新增资产提供 reviewed approvedIndexEntry 及配置；计算字段由生成器补齐。
3. 运行 scripts/sync_to_library.mjs CONTRACT PROTOTYPE LIBRARY PROPOSAL --dry-run。沿用当前用户对具体变更的授权，未授权时才提交可评审提案确认。
4. 已获准的提案设置 approved=true 后执行同步；脚本在临时副本验证再写入，失败保留原库。提案中的布尔值本身不构成用户授权。
5. 完成必要构建/交互复核，报告验证范围；输出见 [output-contract.md](references/output-contract.md)。包模式同步后运行包根 scripts/build_release.mjs，使目录索引中的版本一致。

同步脚本处理组件/模板包；Token、共享运行时和图标按第一条路径维护。仅跨阶段任务读取包根 workflow.md，资产修改不会自动触发部署或发布。

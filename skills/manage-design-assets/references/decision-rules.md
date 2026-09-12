# AI for Design Asset Management — Decision Rules

## When to register a new component

A prototype component should be registered in the asset library when **all** of the following are true:

1. It is generic enough to be reused across multiple pages or modules.
2. It does not contain hard-coded business data or module-specific labels.
3. It follows the asset library's styling and token conventions.
4. It is not a one-off composition tied to a single user story.

Examples of good candidates: page header, metric card, data table, filter bar, status badge, detail drawer.

Examples to skip: a page-specific chart config, a one-time marketing banner, a temporary debug panel.

## When to register a new page template

A prototype page template should be registered when:

1. It represents a recurring page type in the product (list-and-detail, dashboard, workbench, board).
2. It is driven by configuration rather than hard-coded columns and rows.
3. It can be instantiated in future prototypes by changing `page-config.json` or equivalent.

## When to update an existing asset

Update when the prototype source differs from the library source **and** the difference is intentional and approved.

If the difference is a local experiment or temporary workaround, do not sync.

## When to reject an action

Reject (`action: none`) when:

- The file is a one-time, module-specific implementation.
- The file is still being iterated and not yet ready for reuse.
- The file duplicates an existing asset with only cosmetic differences.
- The user explicitly says to keep it out of the asset library.

## Version policy

proposal.versionPolicy 可为 keep（默认）、patch、minor。用户未要求另建版本时使用 keep，在当前版本更新来源哈希；要求兼容修订版时使用 patch；要求新增可复用能力的版本时使用 minor 并重置 patch=0。破坏性升级另行明确，不自动猜测。

同步仅维护选定资产库。包模式同步后运行包根 scripts/build_release.mjs 对齐包目录及元数据；版本从 manifest 读取，目录名不参与版本判断。

# 需求输出

普通任务提供可读草稿；交接时使用 assets/requirements.json。projectId 跨阶段保持一致，status 为 draft 或有用户确认依据的 confirmed。

需求范围按模板字段填写，无证据的内容保留为空或列入 openQuestions。重要条目包括稳定 id、内容、status（confirmed / assumed / unverified / conflicting）及 evidence（来源 ID、页码或可定位片段）。productGoal.statement 表达目标；新增修订保留已有 ID。

sources 使用 id、path、description；保留设计推断与演示假设。不要仅凭截图将不可见的业务规则标为 confirmed。

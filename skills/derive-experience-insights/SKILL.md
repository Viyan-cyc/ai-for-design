---
name: derive-experience-insights
description: Analyze journeys and propose a design direction when experience or workflow analysis is requested; follow the selected reference.
---

# 推导体验方向

沿用用户选定的需求、截图和研究资料，形成与当前任务相称的体验判断。资料不足时标注推断，不虚构访谈、数据或研究结论。

1. 识别从触发、定位、理解、操作到结果反馈的任务路径，以及各阶段信息需求。
2. 记录证据支持的痛点、机会、权衡和约束。规则见 [direction-rules.md](references/direction-rules.md)。
3. 用户提供明确参考方向时围绕该方向展开；只有明确要求比较方案时再生成多个方向。
4. 输出可评审草稿，需要结构化交接时使用 [insights.json](assets/insights.json)。
5. 保留 `draft`、`selected`、`approved` 的区别。参考图被选为实现依据不等于最终页面已经通过评审。

已知路径和授权无需重复询问。只在缺失信息会实质性改变任务时提问。只完成用户请求的阶段；完整流程请求可以继续原型工作，工程交接冻结仍需用户确认。

定位共享入口：用户给定包路径优先；否则读取本 Skill 的 `agents/package-location.json`，核对包根 `skill-catalog.json` 的 packageId/packageVersion。整包模式可直接读取上两级的 `AI-ENTRY.md`。仅跨阶段任务按包根 `workflow.md` 交接。路径失效时先在用户已知位置查找；仍缺失才询问。

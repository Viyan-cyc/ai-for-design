# 外网准备结果（2026-10-30）

状态：0.1.0-draft，内网集成待完成，不是已验证图表版本。

新建 skill 和 spec，原 SweetUI/EP skill、旧文档和设计源未修改。旧文档未复制为实施依据；新写入口、workflow、runtime-setup、chart-runtime-contract、intranet-integration。保留的 token/主题/vendor 资料均标为候选，需实际 npm 核实。

未带入顶层 assets、工作台复制脚本、场景文档或旧内网交接。verify-build 移除两个仅针对已排除工作台/对话资产的测试，其他检查保留，不放宽生产门禁。

已验证：单一 SKILL 注册、Markdown 本地链接、skill frontmatter 校验、ensure-env。维护回归使用模拟/隔离资源，只能证明编译及现有接线逻辑，不能证明真实 SweetUI/DTUI 兼容。

check-runtime 实际 FAIL：Missing runtime: xss.js（首个发现项，不代表只有这一项缺失）。未做真实私有图表浏览器运行，DTUI 实际包名、版本、接口和依赖均未知。待内网按接续说明补齐，不把旧代码或索引当作权威。

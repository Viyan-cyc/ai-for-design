# gts-ep-charts-coder 0.1.0 实施与验收记录

日期：2026-10-29。已完成首版独立组装、资料适配、维护回归和浏览器工程集成验证。尚未上架或安装到用户全局 skills，也未执行 Git 提交。

## 实施内容

- 新增 skills/gts-ep-charts-coder，单一注册入口；交付 src 与 index.gts-ep.html。
- 嵌入设计资料 0.6.15，逐文件摘要核对与原始资料一致。
- 复用当前 EP 工作区的 scripts/assets，摘要核对未改动；保留原环境池和预览协议。
- 独立维护图表入口、EP 工作流、图表适配、来源清单。
- vendor 两个 SKILL.md 改为 reference-entry.md；修正代码规则11.2、视觉优先级、错误清单21，避免通用GTS图表色规则覆盖设计规范。
- 新增 tests/gts-ep-charts-coder/integration.cjs 及 fixture，维护期运行，不随 skill 发布。
- 原 gts-ep-coder、SweetUI 及设计源未修改。工作区原有改动保留。

## 检查结果

| 检查 | 结果与范围 |
|---|---|
| quick_validate.py | PASS；临时安装 PyYAML 到本次 work/python-deps，使用 Python UTF-8 模式，未改系统依赖 |
| design 逐文件摘要 | PASS；与来源快照一致 |
| scripts/assets 摘要 | PASS；与 EP 来源快照一致 |
| 本地链接与注册 | PASS；入口、新增参考、design、vendor 链接无失效；全包仅一个 SKILL.md |
| verify-build.mjs | PASS，41 项；此项本身不跑浏览器 |
| verify-theme.mjs | PASS；状态往返、持久化、异常存储、自定义主题和实例隔离 |
| verify-fetch-icons.mjs | PASS，22/22；模拟网络测试，不代表内网服务在线验收 |
| verify-foundation.mjs | PASS，10 项 |
| 图表集成 fixture 构建 | PASS，无 WARN；规范 hex 在 option 中合法，未关闭任何门禁 |
| 浏览器运行 | PASS，Windows Edge headless、真实 file URL 离线入口 |
| 图表行为 | 折线/平行坐标渲染、实际指针 Tooltip、EP 筛选、稳定身份色、空结果、重置通过 |
| 主题与尺寸 | default/dark 切换保留筛选；1280→1024 容器 resize 通过 |
| 图片导出 | 下载 PNG、校验 PNG 签名、人工查看图像内容通过 |
| 局部修改 | 不重新 init，修改标题后 build，浏览器显示更新；服务源码未变 |
| 独立分发 | zip 解压到不同位置，ensure/init/cleanup/build 通过；仍使用同机已准备的共享编译环境 |

浏览器用例使用维护者编写的工程 fixture，验证运行集成，不等同独立模型从自然语言生成的质量评估。截图只检查了示例渲染，不宣称全部 HD/半导体规范像素级验收。

## 可复现入口

从仓库根运行 `node tests/gts-ep-charts-coder/integration.cjs <新的输出父目录>`。

需要浏览器检查时设置 PLAYWRIGHT_MODULE 为已安装 Playwright 的模块路径；可设置 BROWSER_EXECUTABLE 为浏览器可执行文件，不设置则使用 msedge channel。未提供 Playwright 时脚本明确输出 BROWSER: not-run。该维护测试不自动安装依赖，也不覆盖或删除已有输出目录。

## 尚未验证与后续

- 无环境的裸机安装、其他操作系统、真实内网 IconPlus 服务未验证。
- 半导体复杂专项、业务封装组件、真实后端接入未验证。
- 未验证标准源码移入其他真实生产工程后的生产构建。
- 未做设计师盲评或独立生成质量评估；不能把工程 fixture 通过当作设计效果保证。
- gts-sweetui-charts-coder 保持遗留；先核实 SweetEcharts 契约，再独立实施。

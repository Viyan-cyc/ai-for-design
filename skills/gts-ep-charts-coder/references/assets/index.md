# 可选资产索引

仅在需求匹配时读取本索引；不要为无关页面加载或复制资产。

| ID | 适用 | 不适用 | 接口 |
|---|---|---|---|
| workbench-shell | 用户指定，或顶部导航＋收展主导航＋多工作区页签 | 独立查询/表单、营销页、参考有不同骨架 | [Shell](workbench-shell.md) |
| conversation-composer | 一体化 AI 对话输入；可独立于骨架使用 | 普通表单 textarea | [Composer](conversation-composer.md) |

先读所选接口，再执行（Page 为 init 返回的 PAGE）：

```sh
node scripts/copy-foundation.mjs --dir "<工程绝对路径>" --page "<Page>" --assets workbench-shell,conversation-composer --check
node scripts/copy-foundation.mjs --dir "<工程绝对路径>" --page "<Page>" --assets workbench-shell,conversation-composer
```

只传实际需要的 ID。输出目录 `src/pages/<Page>/components/foundation/`，每个资产一个文件；根目录 `.gts-assets.json` 记录版本与原始摘要。源是实体复制，不是共享链接。

脚本不装配 App、不修改主题或已有文件。重复执行复用一致内容；图标脚本的标准 import 接线不视为业务修改。已编辑或版本不一致时报 CONFLICT，先检查差异，不删除、不覆盖、不自动升级；保留现有组件继续集成，或经明确升级需求将新版本放入新的独立工程比较。

复制后按接口编写配置与 props/emits/slots，再按原流程执行 fetch-icons/build。输入器与骨架均不带业务记录、不访问服务。文件版本 1.0.0 的视觉基线由用户于 2026-10-28 确认；这不等于自动化浏览器验证已完成。

完整装配示例位于 `assets/examples/workbench-foundation/src/`，仅在接口说明不足以解决装配问题时读相关文件，不默认复制业务示例。示例保留用户确认的斑马纹和分页，普通页面依据需求选择。

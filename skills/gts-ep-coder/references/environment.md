# 环境准备

从skill根目录执行。每个会话校验一次；环境未变化不重复安装。

```bash
node -v
node scripts/ensure-env.mjs
```

没有Node时，使用随包安装脚本：

```powershell
# Windows，将<skillDir>替换为skill绝对路径
powershell -ExecutionPolicy Bypass -File "<skillDir>\scripts\install\install.ps1"
```

```bash
# macOS
bash "<skillDir>/scripts/install/install.sh"
```

安装脚本优先复用可用Node，否则按manifest下载并校验portable Node，随后安装锁定compiler依赖。源配置在references/env-config.json；内网不可达时脚本按既有fallback配置尝试，不改全局npm或代理。

| ensure-env结果 | 处理 |
|---|---|
| RESULT OK | 继续init/构建 |
| COMPILER_MISSING / ENV_LOCK_MISSING / ENV_OUTDATED | 执行HINT给出的setup-env或安装命令，再校验一次 |
| COMPILER_LOAD_FAILED | 按HINT重装锁定依赖；仍失败报告日志 |
| ENV_CONFIG_BROKEN / skill文件缺失 | 报告具体缺失路径，停止，不自行改skill凑环境 |

环境准备可能需要几分钟，提前简短告知用户。下载失败、hash不匹配或权限问题保留原始RESULT/DETAIL/HINT/LOG，不手改node_modules、不换框架、不用静态HTML替代Vue交付。

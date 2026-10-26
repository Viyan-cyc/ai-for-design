# 运行库准备（内网维护阶段）

只有首次分发或目标包升级时执行，普通页面复用已准备资产。来源必须是已安装SweetUI5.7.0和dt-ui的真实Vue工程，来源路径为绝对路径，不修改该工程或node_modules：

```sh
node scripts/ensure-env.mjs
node scripts/prepare-runtime.mjs --project "<已有Vue工程>"
node scripts/check-runtime.mjs
```

ensure未通过按HINT安装共享依赖后重验。prepare复制真实UMD、CSS、字体和其引用资源，打包lodash/xss/G6/jsXssOptions等实际依赖，生成模块映射、原生主题兼容、导出和token目录；common图标必须仍存在于实际CSS。失败会撤销ready，不能沿用旧成功标记。成功仅表示资产准备完成，真实浏览器尚未验证。

helper默认搜索dt-ui的es/utils/js-xss-options.mjs、lib/utils/js-xss-options.js；布局不同用 `--js-xss-entry <真实入口>`，非default导出用 `--helper-export <真实导出名>`。不允许空函数/假库替代依赖。process兼容在loader加载私有UMD前注入。

页面SweetUI5.7.0；dt-ui保留实际安装的原始包及依赖，记录其声明版本。后续依赖升级到5.7.0时重新prepare和维护验收，不自动dedupe/alias，不根据UMD外部列表推断内联内容。

## 一次维护验收

init一个测试页，build后在内网打开index.gts.html；检查表单、表格、分页、弹窗、common字体图标、DtChart真实首绘及原生颜色和浅深主题切换，记录实际命令/结果/错误及未验证项。图表option正确不能仅由CSS组件主题通过推断。升级目标组合后复验。只返回文字/JSON/日志即可，无需传工程或私有UMD。

普通页面仍按主SKILL构建后立即交付，不每页重复浏览器验收或准备资产。查看runtime-preparation.md可以确认实际来源版本；该文件由准备脚本生成，不作为生成页面必读资料。

## 共享工具环境

环境检查与安装使用独立`GtsSweetui/ux-proto-env`工具池，包含Vue compiler和运行库准备用esbuild。可用 `GTS_SWEETUI_ENV_DIR` 或脚本 `--env-dir` 指定独立位置；已安装不重复准备。

```sh
node scripts/ensure-env.mjs
node scripts/setup-env.mjs
```

没有Node时用`powershell -ExecutionPolicy Bypass -File scripts/install/install.ps1`或`bash scripts/install/install.sh`。沿用原工具包安装方式，不改全局npm/代理，不手工改node_modules。

compiler就绪与私有runtime就绪是两件事：`check-runtime.mjs` 检查离线运行时清单。执行一次`prepare-runtime.mjs --project <已有工程>`自动准备真实runtime，之后init复制本地文件，页面期不连接npm或图标服务。

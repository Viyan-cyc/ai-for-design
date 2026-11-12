# 组件创作维护工程

本目录维护调试工具与创作模板，普通skill使用者不需要运行它。依赖使用npm ci安装；构建npm run build；开发页面npm run dev。

## 当前测试入口

- npm test：包契约和状态保护。
- npm run test:boundary：实际初始化、外置构建、源码导出、资源与模块边界、宿主释放。
- npm run test:preview：实际离线预览、调参/重置、目录结构和源码解包；默认本机Edge，可用COMPONENT_BROWSER_PATH指定浏览器。可用COMPONENT_TEST_OUTPUT指定独立输出目录。

旧test:browser和test:failures依赖的历史Grid页面与故障测试未迁入，已移除对应命令。test:preview验证创作预览，不替代这些历史测试，不证明Octo内嵌或视觉验收通过。

scripts/pack-skill.mjs用于在完成工具构建后生成skill的assets/runtime；运行资源由维护源生成，不手工维护两份。

## 原生对象与面板维护

- npm run test:init：默认原生及显式legacy的命名、重名和拒绝覆盖。
- npm run test:panel：旧模板右侧面板、主题、响应式、参数ZIP往返。
- npm run test:native：TS模板类型/模块边界负例、失败保留旧预览、源码包原字节。
- npm run test:native-preview：原生模板离线页面及参数JSON往返。

维护模板native-template生成runtime/native，authoring-template生成旧runtime/template。pack时读取生成器editor.css的主题令牌，打入模板；skill运行不依赖维护目录或生成器。

- npm run test:native-types：原始TS类型越界负例、内部类型正例，以及真实源码ZIP在独立消费工程的声明编译；该工程仅安装Three及TypeScript检查依赖。

## 借用宿主

- npm run test:host-copy：真实场景副本、原文件保持、重复/嵌套/链接拒绝。
- npm run test:host-preview：静态无播放/空闲刷新、脉冲播放控制、宿主保持及源码ZIP。
- 原生类型回归可设置COMPONENT_PROFILE=native-host后运行test:native-types；默认仍检查native-object。
- host-library-runtime.mjs针对native-work/host-slice/library-copy中的实际构建结果，验证ESM/CJS、两个宿主、自有资源释放和声明；需先在真实独立库副本构建，不操作生产库。

## 组件库入库（维护者）

从本目录执行，路径替换为实际位置：

```powershell
node intake/cli.mjs plan --candidate <项目/component> --target <组件库> --category core --exports MyComponent --out <新plan.json>
node intake/cli.mjs validate --plan <plan.json> --work <新的独立验证目录> --test <组件运行断言.mjs>
node intake/cli.mjs apply --receipt <验证目录/receipt.json> --developer-confirmed
```

plan不写目标；validate复制当前库和依赖后，执行tsc、Vite、文档生成器和指定运行断言。测试脚本被复制到验证库根，以参数收到副本绝对路径、分类及公开名称；必须审查脚本使用这些路径，不能依赖原库。脚本运行不构成安全沙箱，候选源码及测试只接受开发审查过的本地材料。

前提是目标checkout已有可用开发依赖（TypeScript、Vite等）；工具不会在目标库安装依赖。plan输出必须位于候选和目标目录之外。验证目录中的changes.md列出增改文件，proposed/提供全部拟写内容，审阅后再apply。源码ZIP需先解压，清单会按实际文件核验。

apply仅接受已验证回执且候选/目标基线不变；回执是本地审阅材料而非签名授权，不接收不可信回执。使用写锁及写前比对，异常恢复本批修改；外部并发改动不覆盖，报告需人工处理。发生进程强杀或断电时不承诺事务恢复，先核对工作区再处理残留锁，禁止盲目重试。

现有分类和公开类/工厂须显式指定；无交互终端必须传category。同ID更新添加`--update`，不支持隐式删除、改名、分类迁移或自动升级依赖。notes.md由人维护，其他登记文件按原基线保护。源码不改写；types-only公开导出、额外资源及新依赖暂不在入口选择范围，需另行扩展契约。

更新中的新增私有源码/生成文档若撞到未登记的既存路径，一律拒绝，内容相同也不自动接管。此检查同时在plan和validate/apply前执行，包含稍后生成的index.html；重新plan不能把人工文件吸收为受管文件。定向回归：`node ../../tests/create-3d-component/intake-ownership.mjs <已接纳两模板的测试目录> <新的证据目录>`，只在新副本修改文件。

`node ../../tests/create-3d-component/intake.mjs`：创建生产库真实副本，在副本运行两模板接纳和冲突/回退测试；不向生产库apply。运行断言示例为intake-runtime.mjs，仅适用于这两个模板。M4生成器同步未由此工具实施。

后续测试接受上一步输出目录：intake-update.mjs测试实际默认值更新、备注保留及类型失败隔离；intake-doc-browser.mjs在临时本地服务打开两页并截图；intake-plan-boundary.mjs检查重导出接口及类型/动态加载/链接等负例；intake-export.mjs另接真实源码ZIP路径检查导出清单。每个维护测试的写入仅限指定证据目录及其库副本。

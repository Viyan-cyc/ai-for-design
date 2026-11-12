# 创作独立组件

默认创建原生TypeScript对象组件：

```text
node <skill>/scripts/init.mjs "<artifact-folder>" <组件id>
```

未提供artifact-folder时省略该参数，使用当前目录。目录重名自动编号；显式完整项目路径用--project-dir，已有路径拒绝覆盖。修改已有工程沿用原目录，不重新初始化。以WORKSPACE_PATH为准。

## 组件与演示
根目录只有index.3d.html、component/和example/。component/src/index.ts是组件入口，src/parameters.ts提供默认值、校验和控件描述；preset.json存项目覆盖。组件继承Group，宿主负责场景、相机、灯光和渲染，setOptions修改组件选项，dispose释放自己资源。不要把演示地图、参数面板或渲染器放进组件源码。

初始化只有可调立方体，必须实现用户实际需求，不能把模板叫作完成业务。字段变化同时调整parameters、预览宿主和说明。默认值不在面板中重复硬编码。参数导入的允许字段与版本必须随实际组件同步，保留错误输入不改变当前画面的行为。

自动模板支持object3d与native-host（借用普通Three Mesh）。native-host是轮廓高亮接入示范，不是扫光或地图瓦片成品；MapLibre、蒙皮与实例化几何需另行适配。原生构建当前支持本地TS模块和three peer，暂不支持组件资产、动态导入或其他peer；需要这些功能先实现适配和测试，不能绕过检查。旧mjs工程继续沿用自身构建；需旧模板时显式--profile legacy，见[兼容说明](legacy-prototype.md)。

## 预览和调参
运行node example/build.mjs。依赖和构建中间文件位于外置真实工作区，不在交付目录安装依赖或建立链接。原始TS类型依赖（含类型导入、导出和引用指令）、类型检查和运行依赖闭包检查通过后生成可直接打开的index.3d.html；构建失败保留旧页面，不能将旧页面称本轮成功。
使用默认右侧面板与生成器样式，窄屏可收起。参数实时生效并显示单位，支持恢复默认和同版本参数JSON导入/导出。静态组件没有虚假播放按钮；实现动画时补齐实际暂停、继续、重播及循环接口，并接入宿主调度。
实际检查file预览、控件、错误输入及释放；外部网络依赖如实说明。最终仅输出构建返回的HTML_PATH artifact，源码不逐个作为artifact展示。

## 组件交付
用户确认后运行node example/build.mjs --export-component导出原生源码ZIP。它只包含component自身源码和资料，Three由peer提供，不含演示或node_modules。预览中的“导出参数”只导出参数，不等于组件源码包。
自动导出保持设计未确认、工程未验证和未发布，不能通过点击导出自动升级。开发接纳前还须在当前目标组件库副本检查类型、构建、公共入口与实际行为。原生源码测试通过不等于已自动入库。

## 借用现有场景
创作附加效果默认原场景只读。在独立组件工程初始化：

```text
node <skill>/scripts/init.mjs "<artifact-folder>" <组件id> --profile native-host
node <skill>/scripts/copy-host.mjs "<原场景源码目录>" "<返回的WORKSPACE_PATH>"
```

脚本在example/host产生真实副本，排除node_modules、缓存、git、历史和已生成预览；拒绝覆盖、链接及相互嵌套目录，不执行原场景脚本。复制后还没有自动接入。读取副本的真实入口，在example中编写宿主适配，把root、targets、invalidate等实际资源传给组件；改动只落副本，不把整座场景放component。静态资源和配置按副本的实际目录核对，复杂宿主需调整example构建入口；不能承诺任意场景复制后立即可运行。
用户明确要求修改原项目时，按该授权局部修改原项目，不另建副本冒充更新；生成器自己的“修改已有项目”规则不因此改变。

## 动画由需求决定
“向外扩散、逐渐消散”等包含动画意图；“添加高亮/边框”不表示要闪烁。native-host默认静态，无播放按钮，无持续刷新。只有需求确实需要动画时加--animation pulse作为动画接线示范，再实现真正业务算法。不要因为模板存在播放能力就自动增加动画或循环。动画宿主调用tick(dtSeconds)；false表示该效果无需持续帧，操作通过invalidate唤醒。暂停、继续、重播和循环只在选择动画时显示。
关闭仅隐藏组件自有组，销毁仅释放自有几何/材质；借用对象的形状、材质、光影和可见性保持。宿主变换后调用syncTargets，几何拓扑变化需重建效果。

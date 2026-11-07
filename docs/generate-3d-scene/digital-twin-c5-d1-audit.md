# C5 操作范围与 D1 灯光映射核查

本批不改保存契约、灯光默认值或数据字段。C4/C5生产改动由用户体验与独立review确认；D1为静态核查，不代表照明效果已验收。

## C5：入口保留与范围

| 入口 | 实际作用 | 本批处理 |
|---|---|---|
| 顶部保存/Ctrl+S | 整个场景的修改；开发模式写源码，离线模式复制修改文本 | 同一保存入口，按模式说明去向；不增加高级窗口保存 |
| 材质窗口关闭 | 关闭窗口，已应用修改仍在 | 补即时预览、关闭不撤销、顶部统一保存说明 |
| 顶部撤销/重做 | 按Bridge历史恢复场景；不是只撤销当前面板 | 保留现有范围 |
| 场景风格预设 | 替换全部lights，更新背景、IBL强度、toneMapping、exposure | 补全作用范围提示；材质、相机不变；可撤销 |
| 画质档位 | 运行配置与阴影分辨率 | 保留；与场景风格预设不是重复入口 |
| 左侧灯光/右侧灯光参数 | 左侧选择，右侧编辑 | 保留，不创建第二份编辑面板 |
| 材质素材库/对象材质 | 共享条目或对象/槽位，作用域不同 | 保留；已有共享提示，不合并成模糊入口 |
| 导入 | SaveService.importText既有导入路径 | 保留，不改名为“保存模板” |
| 对方保存参数/保存模板/重置预览 | 与现有存储、预设、撤销的范围尚未统一 | 不导入；Q9仍待确认 |

实现依据：template/src/edit/SaveService.ts:166起、Toolbar.vue保存按钮、EditMaterialModal.vue的apply与close、ScenePresets.ts:applyScenePreset、RenderSettings.vue。路径均相对skills/generate-3d-scene。没有全局重置的新实现。

## D1：不能按名字直接合并

上游根：D:/cyc/project/octo/gts/test/数字孪生skill110501/数字孪生skill。
本表主要运行证据来自bridge/model-lighting.js；参数声明见step-01-基础空间/参数.yaml。仅阅读源码，未运行上游代码。

| 概念 | 对方实际实现 | 我们现状 | 结论 |
|---|---|---|---|
| 光源强度 | model-lighting.js:120–129：sqrt(v/100)×通道系数×全局亮度×2^EV，平行光/环境再经时间线调制 | LightEngine.ts直接使用lights[].intensity | 数值不能原样搬；保留现有强度 |
| 光源曝光 | lightingExposure参与各通道2^EV乘数 | RendererEngine.ts:44/74控制renderer.toneMappingExposure | 光源增益与画面曝光不是同一个字段，不互为别名 |
| 全局亮度 | globalBrightness乘到各照明通道，点光复用area参数；不等于renderer曝光 | 无对应的灯组总增益字段 | 不把它映射成曝光；新增需决策 |
| 环境光（HDR） | model-lighting.js:60缺省创建HemisphereLight，也可传入environmentLight | EnvironmentEngine.ts用RoomEnvironment生成PMREM供材质照明；另有AmbientLight/HemisphereLight | 标签不能证明已加载HDR；IBL和普通灯必须区分 |
| 环境光通道强度 | 上游lightingIntensity.environment通道经上述公式与小时因子处理 | scene.environment.intensity设置scene.environmentIntensity | 不直接映射数值；当前无外部HDR文件选择入口 |
| 环境贴图强度声明 | 参数.yaml:545起另有foundation.environmentIntensity，注明scene.environmentIntensity | scene.environment.intensity控制IBL | 概念可对应；不能和上述半球光通道混为一谈；本次未验证上游此字段真实读写链路 |
| 材质环境反射强度声明 | 参数.yaml:558起foundation.envMapIntensity | 材质规格有envMapIntensity，与全局IBL强度是不同层级 | 不当成第二个全局亮度；具体宿主接入仍需核实，不凭声明认领已集成 |
| 阴影不透明度 | model-lighting.js:36–37/139–141修改shader采样结果与twinShadowStrength | 全局shadowMapEnabled、单灯castShadow和模型投影/受影，未提供同义全局阴影透明度 | 不复用opacity材质字段，不导入上游shader补丁 |
| 衰减 | :130–137依模型尺度、范围、形状和shader衰减调整；point复用area通道 | Point/Spot使用distance、decay等原生参数 | decay部分同义，但矩形/椭圆衰减不是通用原生参数 |
| 日夜 | :97/142创建时间线、对光强二次调制 | 普通深浅主题不是24小时日照；地图主题也非天文日照 | D4待确认，不将主题切换当作该能力已集成 |
| 灯光类型 | Directional/RectArea/Point/Hemisphere组合；缺省环境不是AmbientLight | LightEngine支持六类独立光源 | 复用已有类型，不能以同名预设覆盖用户灯光 |
| 版本 | model-lighting.js:55严格要求THREE.REVISION=160 | 项目要求three 0.185.1 | 即使批准效果也需按当前引擎重写验证，不能照搬shader |
| 地图光照 | 上述代码针对Three场景 | MapLibre底图表现与附加Three模型照明分离 | 地图灯光说明只影响附加模型，底图建筑由地图表现控制 |

计算核对（不是浏览器效果测试）：平行光v=100、gain=1、EV=0时基值3.4；EV=1变6.8；v=25变1.7。还需时间线因子才能得到最终光强。因此“100”既不是我们的100强度，也不是百分比直接赋值。

## 待确认，未实现

1. Q4：是否需要“光源曝光”作为单灯强度的输入方式？若需要，必须确定参考强度与读回规则；本批保留既有强度/画面曝光。
2. Q9：是否确实需要用户自存场景模板？模板的内容、覆盖范围和存储位置未定，本批不新增按钮。
3. HSV、色温、日夜仍按D2–D4单独决策；区域衰减和阴影透明度不能以本表作为实现授权。

没有待确认项阻碍本批既有UI范围说明落地；上述候选也不算本批功能遗漏。组件库没有因本次核查新增能力。

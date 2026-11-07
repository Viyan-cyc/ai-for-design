# 数字孪生能力与参数完整目录

生成日期：2026-11-05。用途：融合评审附件，不是已实现证明。

来源：`D:\cyc\project\octo\gts\test\数字孪生skill110501\数字孪生skill`。四个 Step 原始参数逐项列出并保留完整定义；嵌套字段、默认值、枚举、条件、说明均保留。领域配置另列全文。面板生成目录与原始参数分别记录，不能以目录中的 supported 声明代替宿主运行验证。

所有条目当前融合状态：待逐项映射；运行状态：待独立核查。相似已有功能不计作本次集成。

## step-01-基础空间

来源 `step-01-基础空间/参数.yaml`；参数数 66。

### space.container.length — 长度与距离 Length

```yaml
  - id: space.container.length
    label: 长度与距离 Length
    purpose: 设置空间容器的尺寸
    path: foundation.worldUnit + foundation.sceneMetersPerUnit
    tier: basic
    type: enum
    default: "1:1m"
    recommended: "1:1m"
    enum: ["1:1km", "1:1m", "1:1cm", "1:1mm"]
    domainDefaults:
      芯片: "1:1cm"
      GTS领域: "1:1m"
    recommendedNote: 芯片对齐 demo sceneMetersPerUnit=0.01（1 unit=10mm）。GTS领域按 AIDC 园区构件尺寸采用 1 unit=1m；已有 1:1mm/1:1cm 时模板切换保留
    advanced: none
    source: H Design（优化原定义）
    details: 详情.md
    panel:
      section: rules
      group: 空间尺寸与单位
      order: 10
    affects: [space, interaction, visualization]
    dependsOn: []
    map:
      "1:1km": { worldUnit: km, sceneMetersPerUnit: 1000 }
      "1:1m": { worldUnit: m, sceneMetersPerUnit: 1 }
      "1:1cm": { worldUnit: cm, sceneMetersPerUnit: 0.01 }
      "1:1mm": { worldUnit: mm, sceneMetersPerUnit: 0.001 }
```

### space.container.sceneMetersPerUnit — 场景单位米制换算

```yaml
  - id: space.container.sceneMetersPerUnit
    label: 场景单位米制换算
    path: foundation.sceneMetersPerUnit
    tier: basic
    type: number
    unit: m/unit
    default: 1
    recommended: 1
    derivedFrom: space.container.length
    note: 由 Length 档写入；勿单独另写一套
```

### space.container.gridMajorMm — 网格主格 mm

```yaml
  - id: space.container.gridMajorMm
    label: 网格主格 mm
    path: foundation.gridMajorMm
    tier: basic
    type: number
    unit: mm
    default: 1000
    recommended: 1000
    domainDefaults:
      芯片: 10
      GTS领域: 1000
    recommendedNote: 芯片包对齐 demo 基线 10 mm 格；scaleAdaptGrid 保持关
```

### space.container.activeScaleLevelId — 当前比例尺 L

```yaml
  - id: space.container.activeScaleLevelId
    label: 当前比例尺 L
    path: ui.scale.activeScaleLevelId
    tier: basic
    type: string
    default: L19
    domainDefaults:
      芯片: L27
      GTS领域: L15
    recommendedNote: 芯片带空场景锚点 L27（1 cm）；GTS领域为约 200～500m 园区视距的 L15 锚点
```

### space.camera.focalLength — 焦距 Focal Length

```yaml
  - id: space.camera.focalLength
    label: 焦距 Focal Length
    purpose: 设置默认视角
    path: foundation.focalLengthMm
    tier: basic
    type: float
    range: [18, 300]
    unit: mm
    panel: slider+text
    default: 36
    recommended:
      scene: 36
      singleObject: 50
      chip: 80
    domainDefaults:
      GTS领域: 30
    recommendedNote: 普适默认机位 36mm（场景档）；芯片档对齐路径检查 demo focalLengthMm=80；GTS领域按 AIDC 43° 垂直 FOV（24mm 传感器高）换算约 30mm
    advanced: none
    source: H Design（延用原定义）
    details: 详情.md
```

### space.camera.sensorHeight — 传感器高度 Sensor Height

```yaml
  - id: space.camera.sensorHeight
    label: 传感器高度 Sensor Height
    path: foundation.sensorHeightMm
    tier: advanced
    type: number
    unit: mm
    fieldRole: userInput
    default: 24
    recommended: 24
    min: 1
    max: 100
    panel: text
    note: Film Gate / 传感器高度；fov derive 的显式输入，默认 24 mm
```

### space.camera.fov — 镜头垂直视场角

```yaml
  - id: space.camera.fov
    label: 镜头垂直视场角
    path: foundation.fov
    tier: basic
    type: number
    unit: deg
    fieldRole: derived
    derivedFrom: space.camera.focalLength
    derive:
      fn: verticalFovFromFocalLength
      inputs:
        - foundation.focalLengthMm
        - foundation.sensorHeightMm
    agent: read_only
    note: 由 focalLengthMm 与 sensorHeightMm（默认 24）换算；禁止隐含写死传感器高而不声明
```

### space.camera.verticalViewAngle — 垂直视角 Vertical Field of View

```yaml
  - id: space.camera.verticalViewAngle
    label: 垂直视角 Vertical Field of View
    purpose: 设置默认视角
    path: controls.polarDeg
    tier: basic
    type: float
    range: [-90, 90]
    unit: deg
    panel: slider+text
    default: 30
    recommended:
      scene: 30
      singleObject: 45
      chip: 15
    domainDefaults:
      GTS领域: 12.4
    advanced: none
    semantics: elevFromHorizon
    source: H Design（延用原定义）
    details: 详情.md
```

### space.camera.horizontalViewAngle — 水平视角 Horizontal Field of View

```yaml
  - id: space.camera.horizontalViewAngle
    label: 水平视角 Horizontal Field of View
    purpose: 设置默认视角
    path: controls.azimuthDeg
    tier: basic
    type: float
    range: [-180, 180]
    unit: deg
    panel: slider+text
    default: 150
    recommended:
      scene: 150
      singleObject: 150
      chip: 0
    domainDefaults:
      GTS领域: 32.5
    recommendedNote: 芯片档 0° 为正面。FRONT=+Z，与 Step 3 前视同一约定；GTS领域将 AIDC 的 34.5° 基准加 −2° 偏移，得到绝对方位约 32.5°
    advanced: none
    source: H Design（延用原定义）
    details: 详情.md
```

### space.camera.motionRadius — 相机运动半径

```yaml
  - id: space.camera.motionRadius
    label: 相机运动半径
    purpose: 设置默认视角
    path: controls.cameraMotionRadiusMode
    tier: advanced
    type: enum
    enum: [fixed, scene]
    labels:
      fixed: 固定数值
      scene: 场景
    panel:
      section: rules
      group: 观察视角
      order: 40
    default: scene
    recommended: scene
    advanced: none
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.camera.globalBrightness — 全局亮度

```yaml
  - id: space.camera.globalBrightness
    label: 全局亮度
    path: foundation.globalBrightness
    tier: basic
    type: number
    unit: ratio
    default: 1.0
```

### space.lighting.type — 灯光类型 Lighting Type

```yaml
  - id: space.lighting.type
    label: 灯光类型 Lighting Type
    purpose: 设置空间容器的光源
    path: foundation.lightingTypes
    tier: basic
    type: enum[]
    multi: true
    default: [directional, area, environment]
    recommended: [directional, area, environment]
    enum: [point, directional, area, environment]
    advanced: none
    source: H Design（延用原定义）
    details: 详情.md
    labels:
      point: 点光
      directional: 平行光
      area: 区域光
      environment: 环境光（HDR）
```

### space.lighting.shadow — 阴影 Shadow

```yaml
  - id: space.lighting.shadow
    label: 阴影 Shadow
    purpose: 设置空间容器的光源
    path: foundation.shadowEnabled
    tier: basic
    type: boolean
    panel: toggle
    default: true
    recommended: true
    domainDefaults:
      芯片: false
    recommendedNote: 芯片 demo 网格不投射阴影
    advanced: none
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.shadowOpacity — 阴影不透明度 Shadow Opacity

```yaml
  - id: space.lighting.shadowOpacity
    label: 阴影不透明度 Shadow Opacity
    purpose: 设置空间容器的光源
    path: foundation.shadowOpacity
    tier: advanced
    type: float
    range: [0, 100]
    unit: "%"
    panel: slider+text
    default: 100
    recommended: 100
    advanced: slider-0-100-percent
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.decay — 光源衰减 Light Decay

```yaml
  - id: space.lighting.decay
    label: 光源衰减 Light Decay
    purpose: 设置空间容器的光源
    path: foundation.lightDecay
    tier: basic
    type: enum
    enum: [none, linear, quadratic]
    default: quadratic
    recommended: quadratic
    advanced: none
    source: 场景规则（产品定义）
    details: 详情.md
    labels:
      none: 无
      linear: 线性
      quadratic: 二次
```

### space.lighting.decayGradient — 衰减幅度 Decay Gradient

```yaml
  - id: space.lighting.decayGradient
    label: 衰减幅度 Decay Gradient
    purpose: 设置空间容器的光源
    path: foundation.decayGradient
    tier: advanced
    type: float
    range: [0, 100]
    unit: "%"
    panel: slider+text
    condition:
      path: foundation.lightDecay
      eq: linear
    default: 75
    recommended: 75
    advanced: slider-0-100-percent
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.decayShape — 衰减区域形状 Decay Shape

```yaml
  - id: space.lighting.decayShape
    label: 衰减区域形状 Decay Shape
    purpose: 设置空间容器的光源
    path: foundation.decayShape
    tier: advanced
    type: enum
    enum: [rectangle, ellipse]
    panel: select
    condition:
      path: foundation.lightDecay
      eq: quadratic
    default: ellipse
    recommended: ellipse
    advanced: array-single
    source: 场景规则（产品定义）
    details: 详情.md
    labels:
      rectangle: 矩形
      ellipse: 椭圆形
```

### space.lighting.decayShapeSize — 衰减区尺寸 Decay Shape Size

```yaml
  - id: space.lighting.decayShapeSize
    label: 衰减区尺寸 Decay Shape Size
    purpose: 设置空间容器的光源
    path: foundation.decayShapeSize
    tier: advanced
    type: object
    fields:
      x: { type: float, range: [0, 1000], default: 200, recommended: 200 }
      y: { type: float, range: [0, 1000], default: 200, recommended: 200 }
    panel: string-xy
    condition:
      path: foundation.lightDecay
      eq: quadratic
    unit: modelUnit
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.decayThreshold — 衰减区扩散 Decay Threshold

```yaml
  - id: space.lighting.decayThreshold
    label: 衰减区扩散 Decay Threshold
    purpose: 设置空间容器的光源
    path: foundation.decayThreshold
    tier: advanced
    type: float
    range: [0, 1]
    unit: ratio
    panel: slider+text
    condition:
      path: foundation.lightDecay
      eq: quadratic
    default: 1
    recommended: 1
    advanced: slider-0-1
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.nightlightMode — 夜间模式 Nightlight Mode

```yaml
  - id: space.lighting.nightlightMode
    label: 夜间模式 Nightlight Mode
    purpose: 设置空间容器的光源
    path: foundation.nightlightMode
    tier: basic
    type: boolean
    panel: toggle
    default: false
    recommended: false
    advanced: none
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.intensityNightlight — 光源强度（夜间）Intensity（Nightlight）

```yaml
  - id: space.lighting.intensityNightlight
    label: 光源强度（夜间）Intensity（Nightlight）
    purpose: 设置空间容器的光源
    path: foundation.lightingIntensityNightlight
    tier: advanced
    type: float
    range: [0, 100]
    panel: slider
    unit: ratio
    condition:
      path: foundation.nightlightMode
      eq: true
    default:
      directional: 14
      area: 66
      environment: 21
    recommended: null
    advanced: slider-0-100
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.exposureNightlight — 曝光（夜间）Exposure（Nightlight）

```yaml
  - id: space.lighting.exposureNightlight
    label: 曝光（夜间）Exposure（Nightlight）
    purpose: 设置空间容器的光源
    path: foundation.lightingExposureNightlight
    tier: advanced
    type: float
    range: [-10, 10]
    panel: slider
    unit: EV
    condition:
      path: foundation.nightlightMode
      eq: true
    default:
      directional: 0
      area: 0
      environment: 0
    recommended: null
    advanced: slider--10-10
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.colorHsvNightlight — 色值（夜间）Color（HSV）（Nightlight）

```yaml
  - id: space.lighting.colorHsvNightlight
    label: 色值（夜间）Color（HSV）（Nightlight）
    purpose: 设置空间容器的光源
    path: foundation.lightingColorHsvNightlight
    tier: advanced
    type: string
    format: H-S-V
    panel: text
    condition:
      path: foundation.nightlightMode
      eq: true
    default:
      directional: "0-0-100"
      area: "0-0-100"
      environment: "0-0-100"
    recommended: null
    advanced: string-hsv
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.temperatureNightlight — 色温（夜间）Temperature（Nightlight）

```yaml
  - id: space.lighting.temperatureNightlight
    label: 色温（夜间）Temperature（Nightlight）
    purpose: 设置空间容器的光源
    path: foundation.lightingTemperatureNightlight
    tier: advanced
    type: float
    range: [1000, 10000]
    panel: slider
    unit: K
    condition:
      path: foundation.nightlightMode
      eq: true
    default:
      directional: 6500
      area: 6500
      environment: 4200
    recommended: null
    advanced: slider-1000-10000
    source: 场景规则（产品定义）
    details: 详情.md
```

### space.lighting.intensity — 光源强度 Intensity

```yaml
  - id: space.lighting.intensity
    label: 光源强度 Intensity
    purpose: 设置空间容器的光源
    path: foundation.lightingIntensity
    tier: advanced
    type: float
    unit: ratio
    range: [0, 100]
    panel: slider
    default:
      directional: 1
      area: 5
      environment: 20
    recommended:
      directional: 1
      area: 5
      environment: 20
    domainDefaults:
      芯片: { directional: 8, area: 8, environment: 16 }
    recommendedNote: 芯片按用户确认采用 8/8/16；区域光同步 keyIntensity=8，普适默认保持不变
    advanced: slider-0-100
    source: H Design（延用原定义）
    details: 详情.md
```

### space.lighting.exposure — 曝光 Exposure

```yaml
  - id: space.lighting.exposure
    label: 曝光 Exposure
    purpose: 设置空间容器的光源
    path: foundation.lightingExposure
    tier: advanced
    type: float
    range: [-10, 10]
    panel: slider
    unit: EV
    default:
      directional: 0
      area: 0
      environment: 0
    recommended:
      directional: 0
      area: 0
      environment: 0
    advanced: slider--10-10
    source: H Design（延用原定义）
    details: 详情.md
```

### space.lighting.temperature — 色温 Temperature

```yaml
  - id: space.lighting.temperature
    label: 色温 Temperature
    purpose: 设置空间容器的光源
    path: foundation.lightingTemperature
    tier: advanced
    type: float
    range: [1000, 10000]
    panel: slider
    unit: K
    default:
      directional: 6500
      area: 6500
      environment: 4200
    recommended:
      directional: 6500
      area: 6500
      environment: 4200
    advanced: slider-1000-10000
    source: H Design（延用原定义）
    details: 详情.md
```

### space.lighting.colorHsv — 色值 Color（HSV）

```yaml
  - id: space.lighting.colorHsv
    label: 色值 Color（HSV）
    purpose: 设置空间容器的光源
    path: foundation.lightingColorHsv
    tier: advanced
    type: string
    format: H-S-V
    panel: text
    default:
      directional: "0-0-100"
      area: "0-0-100"
      environment: "0-0-100"
    recommended:
      directional: "0-0-100"
      area: "0-0-100"
      environment: "0-0-100"
    advanced: string-hsv
    source: H Design（延用原定义）
    details: 详情.md
```

### space.lighting.keyIntensity — 主光强度（引擎）

```yaml
  - id: space.lighting.keyIntensity
    label: 主光强度（引擎）
    path: foundation.keyIntensity
    tier: advanced
    type: number
    unit: ratio
    derivedFrom: space.lighting.intensity.area
    note: 由区域光 Intensity 映射；勿与面板各写一套
```

### space.lighting.lightingMode — 灯光模式

```yaml
  - id: space.lighting.lightingMode
    label: 灯光模式
    path: foundation.lightingMode
    tier: basic
    type: string
    default: threePoint
    derivedFrom: space.lighting.type
    note: 由 Lighting Type 集合推导；勿单独另写一套
```

### space.lighting.recipeLock — 配方锁定

```yaml
  - id: space.lighting.recipeLock
    label: 配方锁定
    path: ui.recipeLock
    tier: advanced
    type: string
    default: room
```

### space.viewport.background — 视口背景色

```yaml
  - id: space.viewport.background
    label: 视口背景色
    path: foundation.background
    tier: advanced
    type: string
    default: "#191919"
    domainDefaults:
      芯片: "#000000"
    recommendedNote: 对齐路径检查 demo 暗棚黑底
```

### space.viewport.environmentIntensity — 环境贴图强度

```yaml
  - id: space.viewport.environmentIntensity
    label: 环境贴图强度
    path: foundation.environmentIntensity
    tier: advanced
    type: float
    unit: ratio
    range: [0, 1]
    default: 0.2
    domainDefaults:
      芯片: 0.028
    recommendedNote: 对齐 demo environmentIntensity；Three.js scene.environmentIntensity
```

### space.viewport.envMapIntensity — 材质环境反射强度

```yaml
  - id: space.viewport.envMapIntensity
    label: 材质环境反射强度
    path: foundation.envMapIntensity
    tier: advanced
    type: float
    unit: ratio
    range: [0, 1]
    default: 0.2
    domainDefaults:
      芯片: 0.06
```

### space.viewport.scaleLodMode — 比例尺 LOD 模式

```yaml
  - id: space.viewport.scaleLodMode
    label: 比例尺 LOD 模式
    path: foundation.scaleLodMode
    tier: advanced
    type: enum
    enum: [step, auto, manual]
    default: auto
    domainDefaults:
      芯片: step
    recommendedNote: 对齐 demo scaleLodMode=step（滚轮逐级 L）
```

### space.viewport.scaleAdaptGrid — 随比例尺改网格

```yaml
  - id: space.viewport.scaleAdaptGrid
    label: 随比例尺改网格
    path: foundation.scaleAdaptGrid
    tier: advanced
    type: boolean
    default: true
    domainDefaults:
      芯片: false
    recommendedNote: demo 关，避免冲掉芯片 10mm 基线格
```

### space.viewport.motionBezier — 运镜贝塞尔

```yaml
  - id: space.viewport.motionBezier
    label: 运镜贝塞尔
    path: foundation.motionBezier
    tier: advanced
    type: string
    default: "0.2,0,0.1,1"
    domainDefaults:
      芯片: "0.2,0,0.1,1"
    recommendedNote: demo cubic-bezier(0.2,0,0.1,1)；面板存逗号串，宿主自行拆成数组
```

### space.viewport.near — 近裁剪面

```yaml
  - id: space.viewport.near
    label: 近裁剪面
    path: foundation.near
    tier: advanced
    type: float
    unit: modelUnit
    range: [0.001, 10]
    default: 0.1
    domainDefaults:
      芯片: 0.01
```

### space.viewport.gridSubdivisions — 网格细分

```yaml
  - id: space.viewport.gridSubdivisions
    label: 网格细分
    path: foundation.gridSubdivisions
    tier: advanced
    type: number
    unit: count
    min: 1
    max: 20
    default: 10
    domainDefaults:
      芯片: 1
```

### space.lighting.lightContrast — 灯光反差

```yaml
  - id: space.lighting.lightContrast
    label: 灯光反差
    path: foundation.lightContrast
    tier: advanced
    type: enum
    enum: [low, medium, high]
    default: medium
    domainDefaults:
      芯片: low
    recommendedNote: demo lightContrast=low → fill/rim 比例更高
```

### space.material.reflectiveMetalness — 反射材质金属度

```yaml
  - id: space.material.reflectiveMetalness
    label: 反射材质金属度
    path: foundation.reflective.metalness
    tier: advanced
    type: float
    unit: ratio
    range: [0, 1]
    default: 0.2
    domainDefaults:
      芯片: 0.08
```

### space.material.reflectiveRoughness — 反射材质粗糙度

```yaml
  - id: space.material.reflectiveRoughness
    label: 反射材质粗糙度
    path: foundation.reflective.roughness
    tier: advanced
    type: float
    unit: ratio
    range: [0, 1]
    default: 0.5
    domainDefaults:
      芯片: 0.78
```

### space.material.transparentIor — 透明材质折射率

```yaml
  - id: space.material.transparentIor
    label: 透明材质折射率
    path: foundation.transparent.ior
    tier: advanced
    type: float
    unit: ratio
    range: [1, 3]
    default: 1.5
    domainDefaults:
      芯片: 2
```

### space.material.transparentRoughness — 透明材质粗糙度

```yaml
  - id: space.material.transparentRoughness
    label: 透明材质粗糙度
    path: foundation.transparent.roughness
    tier: advanced
    type: float
    unit: ratio
    range: [0, 1]
    default: 0.5
    domainDefaults:
      芯片: 0.72
```

### space.render.qualityPreset — 渲染品质

```yaml
  - id: space.render.qualityPreset
    label: 渲染品质
    purpose: 设置空间内模型渲染方式的规则
    path: render.qualityPreset
    tier: basic
    type: enum
    enum: [fluent, balanced, refined]
    labels:
      fluent: 流畅
      balanced: 平衡
      refined: 精致
    panel:
      section: rules
      group: 渲染机制
      order: 10
    default: fluent
    recommended: fluent
    advanced: none
    details: 详情.md
```

### space.render.lod — 模型分级 Model LOD

```yaml
  - id: space.render.lod
    label: 模型分级 Model LOD
    purpose: 设置不同细节层级模型在空间容器中的展示方式
    path: model.lod
    tier: basic
    type: enum
    panel: array
    default: mid
    enum: [low, mid, high]
    details: 详情.md
    notes:
      - "唯一初值 mid。不另写 low/high"
```

### space.render.structureDetailMode — 结构详略模式 Structure Detail Mode

```yaml
  - id: space.render.structureDetailMode
    label: 结构详略模式 Structure Detail Mode
    purpose: 设置不同细节层级模型在空间容器中的展示方式
    path: ui.structureDetail.mode
    tier: basic
    type: enum
    panel: array
    default: cluster
    enum: [cluster, unit]
    details: 详情.md
```

### space.render.lodTier — 穿层 LOD 档 LOD Tier

```yaml
  - id: space.render.lodTier
    label: 穿层 LOD 档 LOD Tier
    purpose: 设置不同细节层级模型在空间容器中的展示方式
    path: ui.structureDetail.lodTier
    tier: advanced
    type: enum
    panel: array
    default: shell
    enum: [shell, mid, detail]
    details: 详情.md
```

### space.render.hideDoorInUnit — 单机柜展示时隐藏柜门

```yaml
  - id: space.render.hideDoorInUnit
    label: 单机柜展示时隐藏柜门
    purpose: 设置不同细节层级模型在空间容器中的展示方式
    path: ui.structureDetail.hideDoorInUnit
    tier: basic
    type: boolean
    default: true
    details: 详情.md
```

### space.render.modelNumber — 空间内的模型数量 Model Number

```yaml
  - id: space.render.modelNumber
    label: 空间内的模型数量 Model Number
    purpose: 设置空间内模型渲染方式的规则
    path: render.modelNumber.limit
    tier: basic
    type: float
    range: [500, max]
    unit: count
    panel: slider+text
    default: auto
    recommended:
      noGpu: 2000
      gpu: max
    advanced: none
    details: 详情.md
```

### space.render.grayboxScenario — 白模使用场景 Graybox Scenario（白模 On 时）

```yaml
  - id: space.render.grayboxScenario
    label: 白模使用场景 Graybox Scenario（白模 On 时）
    purpose: 设置空间内模型渲染方式的规则
    path: render.grayboxModel.scenarios
    tier: advanced
    type: array
    panel: multi-select
    enum: [focus, unfocused]
    labels:
      focus: 聚焦
      unfocused: 非聚焦
    default: [unfocused]
    recommended: [unfocused]
    enableWhen:
      path: render.grayboxModel.enabled
      eq: true
    basic: none
    details: 详情.md
```

### space.render.dynamicModelDetail — 动态渲染模型细节 Dynamic Rendering of Model Detail

```yaml
  - id: space.render.dynamicModelDetail
    label: 动态渲染模型细节 Dynamic Rendering of Model Detail
    purpose: 设置空间内模型渲染方式的规则
    path: render.dynamicModelDetail.enabled
    tier: basic
    type: boolean
    panel: toggle
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### space.render.dynamicModelDetail.focalLod — 模型细节层级 Level of Detail（Dynamic On 时）

```yaml
  - id: space.render.dynamicModelDetail.focalLod
    label: 模型细节层级 Level of Detail（Dynamic On 时）
    purpose: 设置空间内模型渲染方式的规则
    path: render.dynamicModelDetail.focalBands
    tier: advanced
    type: array
    panel: band-select
    bands:
      - id: near
        focalMm: [80, 300]
        fields: [focusLod, unfocusedLod]
      - id: mid
        focalMm: [36, 79]
        fields: [focusLod, unfocusedLod]
      - id: far
        focalMm: [18, 35]
        fields: [focusLod, unfocusedLod]
    enum: [high, mid, low]
    default:
      near: { focusLod: high, unfocusedLod: high }
      mid: { focusLod: mid, unfocusedLod: mid }
      far: { focusLod: low, unfocusedLod: low }
    recommended:
      near: high
      mid: mid
      far: low
    enableWhen:
      path: render.dynamicModelDetail.enabled
      eq: true
    basic: none
    note: 延用 H Design 定义；焦距与 foundation.focalLengthMm 对齐
    details: 详情.md
```

### space.render.dataLayer — 模型内容数据集 Data Layer

```yaml
  - id: space.render.dataLayer
    label: 模型内容数据集 Data Layer
    purpose: 设置空间内模型渲染方式的规则
    path: render.dataLayer
    tier: advanced
    type: range
    panel: slider
    range: [L0, L43]
    paths:
      minLevelIndex: render.dataLayer.minLevelIndex
      maxLevelIndex: render.dataLayer.maxLevelIndex
    default:
      minLevelIndex: 0
      maxLevelIndex: 43
    recommended: 按实际需求；默认全部开放 L0-L43
    basic: none
    details: 详情.md
```

### space.render.grayboxModel — 白模模式 Graybox Model

```yaml
  - id: space.render.grayboxModel
    label: 白模模式 Graybox Model
    purpose: 设置空间内模型渲染方式的规则
    path: render.grayboxModel.enabled
    tier: basic
    type: boolean
    panel: toggle
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### space.occlusion.highlightEdge — 选中 X-ray 描边

```yaml
  - id: space.occlusion.highlightEdge
    label: 选中 X-ray 描边
    path: interaction.focus.showOutline
    tier: basic
    type: boolean
    default: false
```

### space.blockage.method — 遮挡策略 Blockage Method

```yaml
  - id: space.blockage.method
    label: 遮挡策略 Blockage Method
    purpose: 设置模型空间遮挡的呈现规则
    path: render.occlusion.strategy
    tier: basic
    type: enum
    panel: array
    enum: [physical, perspective]
    labels:
      physical: 物理遮挡
      perspective: 透视
    default: physical
    recommended:
      mapLike: physical
      monitorToolLike: perspective
    domainDefaults:
      芯片: perspective
    recommendedNote: 芯片工具态用透视遮挡，对齐 monitorToolLike
    advanced: none
    migrate:
      xray: perspective
      ghost: perspective
```

### space.blockage.transparency — 遮挡物透明度 Blockage Transparency

```yaml
  - id: space.blockage.transparency
    label: 遮挡物透明度 Blockage Transparency
    purpose: 设置模型空间遮挡的呈现规则
    path: render.occlusion.blockageTransparency
    tier: advanced
    type: float
    range: [0, 100]
    unit: percent
    panel: slider
    default: 30
    recommended: 30
    showIf:
      path: render.occlusion.strategy
      eq: perspective
    condition:
      path: render.occlusion.strategy
      eq: perspective
    advanced: none
```

### space.blockage.ssao — 环境光遮蔽 Ambient Occlusion

```yaml
  - id: space.blockage.ssao
    label: 环境光遮蔽 Ambient Occlusion
    purpose: 设置物理遮挡下的屏幕空间环境光遮蔽（SSAO）
    path: render.occlusion.ssaoEnabled
    tier: advanced
    type: boolean
    panel: checkbox
    default: false
    recommended: true
    showIf:
      path: render.occlusion.strategy
      eq: physical
    condition:
      path: render.occlusion.strategy
      eq: physical
    advanced: none
    note: 物理遮挡通用项；开启后在缝隙/接触面加深暗部，强化实体遮挡体量感
```

### space.blockage.ssaoRadius — 遮蔽半径 AO Radius

```yaml
  - id: space.blockage.ssaoRadius
    label: 遮蔽半径 AO Radius
    purpose: 设置 SSAO 采样半径
    unit: px
    path: render.occlusion.ssaoRadius
    tier: advanced
    type: float
    range: [1, 32]
    panel: slider
    default: 8
    recommended: 8
    showIf:
      path: render.occlusion.strategy
      eq: physical
    condition:
      path: render.occlusion.strategy
      eq: physical
    advanced: none
```

### space.blockage.ssaoIntensity — 遮蔽强度 AO Intensity

```yaml
  - id: space.blockage.ssaoIntensity
    label: 遮蔽强度 AO Intensity
    purpose: 设置 SSAO 暗部强度
    path: render.occlusion.ssaoIntensity
    tier: advanced
    type: float
    range: [0, 200]
    unit: percent
    panel: slider
    default: 100
    recommended: 100
    showIf:
      path: render.occlusion.strategy
      eq: physical
    condition:
      path: render.occlusion.strategy
      eq: physical
    advanced: none
```

### space.model.collision — 碰撞 Collision

```yaml
  - id: space.model.collision
    label: 碰撞 Collision
    purpose: 设置模型的物理性质
    path: model.collision.enabled
    tier: basic
    type: boolean
    panel: checkbox
    default: true
    recommended: true
    advanced: none
```

### space.model.collisionModelTypes — 碰撞类型

```yaml
  - id: space.model.collisionModelTypes
    label: 碰撞类型
    purpose: 设置模型的物理性质
    path: model.collision.modelTypes
    tier: advanced
    type: string_array
    panel: multi_select
    enum: [type1, type2, type3, type4]
    labels:
      type1: 类型1
      type2: 类型2
      type3: 类型3
      type4: 类型4
    default: [type1, type2, type3, type4]
    recommended: [type1, type2, type3, type4]
    note: 碰撞参与类型；可多选
    advanced: none
```

### space.model.collisionVolume — 碰撞体积 Collision Volume

```yaml
  - id: space.model.collisionVolume
    label: 碰撞体积 Collision Volume
    purpose: 设置模型的物理性质
    path: model.collision.volumePercent
    tier: advanced
    type: float
    range: [100, 200]
    unit: percent
    panel: slider
    default: 100
    recommended: 100
    note: 开启后场景模型无法相互穿模，碰撞体积决定物体的热区范围
    advanced: none
```

### space.blockage.highlightSilhouette — 高亮被遮挡区域边缘 Highlight Blockage Silhouette

```yaml
  - id: space.blockage.highlightSilhouette
    label: 高亮被遮挡区域边缘 Highlight Blockage Silhouette
    purpose: 设置模型空间遮挡的呈现规则
    path: render.occlusion.highlightBlockageSilhouette
    tier: advanced
    type: boolean
    panel: checkbox
    default: false
    recommended: false
    showIf:
      path: render.occlusion.strategy
      eq: perspective
    condition:
      path: render.occlusion.strategy
      eq: perspective
    advanced: none
```

### space.lighting.environmentHour — 环境时间

```yaml
  - id: space.lighting.environmentHour
    label: 环境时间
    path: foundation.environmentHour
    type: float
    unit: h
    range: [0, 24]
    tier: advanced
    panel: slider
    default: 12
    recommended: 12
    note: 时间因子作用于已绑定灯光；无灯光能力时不得报告成功
```

## step-02-导入对象

来源 `step-02-导入对象/参数.yaml`；参数数 5。

### import.layerMeta.matRole — 材质角色

```yaml
  - id: import.layerMeta.matRole
    label: 材质角色
    path: layerMeta.matRole
    tier: basic
    type: string
    required: true
```

### import.layerMeta.matClass — 物类

```yaml
  - id: import.layerMeta.matClass
    label: 物类
    path: layerMeta.matClass
    tier: basic
    type: string
    required: true
```

### import.layerMeta.selectable — 可点选

```yaml
  - id: import.layerMeta.selectable
    label: 可点选
    path: layerMeta.selectable
    tier: basic
    type: boolean
    default: true
```

### import.preserveSource — 1:1 保留源

```yaml
  - id: import.preserveSource
    label: 1:1 保留源
    path: userData.preserveSource
    tier: basic
    type: boolean
    default: true
    notes:
      - "已有网格保持顶点与材质颜色。本字段只登记，不授权重搭"
```

### import.modelScale — 整机显示缩放

```yaml
  - id: import.modelScale
    label: 整机显示缩放
    path: foundation.modelScale
    tier: basic
    type: number
    unit: ratio
    default: 1
    derivedFrom: space.container.sceneMetersPerUnit
    notes:
      - "默认 1：不在 Step 1 比例尺之外再乘一套缩放。禁止再用 1.2"
```

## step-03-场景控制

来源 `step-03-场景控制/参数.yaml`；参数数 73。

### control.input.types — 交互输入 Input Type

```yaml
  - id: control.input.types
    label: 交互输入 Input Type
    purpose: 设置基础交互行为
    path: interaction.input.types
    tier: basic
    type: array
    panel: multi-select
    enum: [mouse, keyboard, touch]
    labels:
      mouse: 鼠标
      keyboard: 键盘
      touch: 触摸屏
    default: [mouse, keyboard]
    recommended: [mouse, keyboard]
    advanced: none
    details: 详情.md
```

### control.select.binding — 选中 Select

```yaml
  - id: control.select.binding
    label: 选中 Select
    purpose: 设置基础交互行为
    path: interaction.selectBinding
    tier: basic
    type: object
    panel: mouse-select+text
    paths:
      mouse.left: interaction.selectBinding.mouse.left
      mouse.middle: interaction.selectBinding.mouse.middle
      mouse.right: interaction.selectBinding.mouse.right
      keyboard: interaction.selectBinding.keyboard
    enum:
      mouse: [none, click, dblclick, longpress, scroll]
    default:
      mouse:
        left: click
        middle: none
        right: none
      keyboard: Ctrl+A
      touch: tap
    recommended:
      mouse:
        left: click
      keyboard: Ctrl+A
      touch: tap
    advanced: none
    details: 详情.md
```

### control.deselect.binding — 取消选中 Deselect

```yaml
  - id: control.deselect.binding
    label: 取消选中 Deselect
    purpose: 设置基础交互行为
    path: interaction.deselectBinding
    tier: basic
    type: object
    panel: mouse-select+text
    paths:
      mouse.left: interaction.deselectBinding.mouse.left
      mouse.middle: interaction.deselectBinding.mouse.middle
      mouse.right: interaction.deselectBinding.mouse.right
      keyboard: interaction.deselectBinding.keyboard
    enum:
      mouse: [none, click, dblclick, longpress, scroll]
    default:
      mouse:
        left: none
        middle: none
        right: none
      keyboard: Esc
    recommended:
      mouse:
        left: none
        middle: none
        right: none
      keyboard: Esc
    advanced: none
    details: 详情.md
```

### control.input.hover.enabled — 允许悬浮 Allow Hover

```yaml
  - id: control.input.hover.enabled
    label: 允许悬浮 Allow Hover
    purpose: 设置基础交互行为
    path: interaction.hover.enabled
    tier: basic
    type: boolean
    panel: boolean
    default: true
    recommended: true
    advanced: none
    details: 详情.md
    notes:
      - "普适与芯片场景初值都是 true。"
```

### control.pan.binding — 拖动 Pan

```yaml
  - id: control.pan.binding
    label: 拖动 Pan
    purpose: 设置基础交互行为
    path: interaction.panBinding
    tier: basic
    type: object
    panel: mouse-select+text
    paths:
      mouse.left: interaction.panBinding.mouse.left
      mouse.middle: interaction.panBinding.mouse.middle
      mouse.right: interaction.panBinding.mouse.right
      keyboard: interaction.panBinding.keyboard
    enum:
      mouse: [none, click, dblclick, longpress, scroll]
    default:
      mouse:
        left: none
        middle: none
        right: longpress
      keyboard: 无
    recommended:
      mouse:
        right: longpress
      keyboard: 无
    advanced: none
    details: 详情.md
```

### control.orbit.binding — 旋转 Orbit

```yaml
  - id: control.orbit.binding
    label: 旋转 Orbit
    purpose: 设置基础交互行为
    path: interaction.orbitBinding
    tier: basic
    type: object
    panel: mouse-select+text
    paths:
      mouse.left: interaction.orbitBinding.mouse.left
      mouse.middle: interaction.orbitBinding.mouse.middle
      mouse.right: interaction.orbitBinding.mouse.right
      keyboard: interaction.orbitBinding.keyboard
    enum:
      mouse: [none, click, dblclick, longpress, scroll]
    default:
      mouse:
        left: longpress
        middle: none
        right: none
      keyboard: 上下左右
    recommended:
      mouse:
        left: longpress
      keyboard: 上下左右
    advanced: none
    details: 详情.md
```

### control.zoom.binding — 缩放 Zoom

```yaml
  - id: control.zoom.binding
    label: 缩放 Zoom
    purpose: 设置基础交互行为
    path: interaction.zoomBinding
    tier: basic
    type: object
    panel: mouse-select+text
    paths:
      mouse.left: interaction.zoomBinding.mouse.left
      mouse.middle: interaction.zoomBinding.mouse.middle
      mouse.right: interaction.zoomBinding.mouse.right
      keyboard: interaction.zoomBinding.keyboard
    enum:
      mouse: [none, click, dblclick, longpress, scroll]
    default:
      mouse:
        left: none
        middle: click
        right: none
      keyboard: 放大+键，缩小-键
    recommended:
      mouse:
        middle: click
      keyboard: 放大+键，缩小-键
    advanced: none
    details: 详情.md
```

### control.restore.binding — 复位 Restore

```yaml
  - id: control.restore.binding
    label: 复位 Restore
    purpose: 设置基础交互行为
    path: interaction.restoreBinding
    tier: basic
    type: object
    panel: mouse-select+text
    paths:
      mouse.left: interaction.restoreBinding.mouse.left
      mouse.middle: interaction.restoreBinding.mouse.middle
      mouse.right: interaction.restoreBinding.mouse.right
      keyboard: interaction.restoreBinding.keyboard
    enum:
      mouse: [none, click, dblclick, longpress, scroll]
    default:
      mouse:
        left: none
        middle: none
        right: none
      keyboard: Space
    recommended:
      mouse:
        left: none
        middle: none
        right: none
      keyboard: Space
    advanced: none
    details: 详情.md
```

### control.interaction.origin — 交互原点 Interaction Origin

```yaml
  - id: control.interaction.origin
    label: 交互原点 Interaction Origin
    purpose: 设置相机轴心
    path: interaction.interactionOrigin
    tier: basic
    type: array
    panel: multi-select
    enum: [object, mouse]
    labels:
      object: 对象
      mouse: 鼠标
    default: [object]
    recommended: [object]
    recommendedNote: 场景+单物体
    advanced: none
    details: 详情.md
```

### control.orientation.tokenType — Token类型 Token Type

```yaml
  - id: control.orientation.tokenType
    label: Token类型 Token Type
    purpose: 设置方位Token组件辅助相机的交互
    path: interaction.orientationToken.types
    tier: basic
    type: array
    panel: single-select
    enum: [none, axes, compass, heading]
    labels:
      none: 无
      axes: 3D坐标
      compass: 指北针
      heading: 航向箭头
    default: [axes]
    domainDefaults:
      算力中心: [axes]
    recommendedNote: 普适 default 与算力中心模板同为 axes，是交集，不是另一套数
    advanced: none
    details: 详情.md
    notes:
      - "方位token组件需要设计师基于产品具体需求来决定是否加入至设计中，产品如地图具有强导航属性，方位token则为必要UI控件；产品如芯片设计EDA，界面内3D对象都较为接近，无法一眼识别方位，则需要方位token的辅助；但部分监控类产品如能源发电厂，有较为明显的3D对象标识，方位token可以选择性省略。"
      - "普适默认 axes：右下角圆标三轴（X #ff3653 / Y #8adb00 / Z #2c8fff，正向带字母，负向为同色较暗小圆点）。在坐标区域内拖动自由旋转视角，拖满一边约 180°，原点是选中物体或场景的包围盒几何中心；未拖动时点击 +X 右视、−X 左视、+Y 顶视、−Y 底视、+Z 正视、−Z 后视。实现见 bridge/axis-token.js。"
```

### control.orientation.tokenOrigin — Token原点 Token Origin

```yaml
  - id: control.orientation.tokenOrigin
    label: Token原点 Token Origin
    purpose: 设置方位Token组件辅助相机的交互
    path: interaction.orientationToken.origin
    tier: basic
    type: object
    panel: string-xyz
    fields:
      x: { type: float, default: 0, recommended: 0 }
      y: { type: float, default: 0, recommended: 0 }
      z: { type: float, default: 0, recommended: 0 }
    default:
      x: 0
      y: 0
      z: 0
    recommended:
      x: 0
      y: 0
      z: 0
    advanced: none
    details: 详情.md
```

### control.orientation.orthographicCamera — Token触发正交机位 Orthographic Camera

```yaml
  - id: control.orientation.orthographicCamera
    label: Token触发正交机位 Orthographic Camera
    purpose: 设置方位Token组件辅助相机的交互
    path: interaction.orientationToken.orthographicCamera
    tier: basic
    type: boolean
    panel: boolean
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### control.orientation.orthographicCameraType — Token触发正交机位 Orthographic Camera Type

```yaml
  - id: control.orientation.orthographicCameraType
    label: Token触发正交机位 Orthographic Camera Type
    purpose: 设置方位Token组件辅助相机的交互
    path: interaction.orientationToken.orthoViews
    tier: advanced
    type: array
    panel: multi-select
    basic: none
    visibleWhen:
      path: interaction.orientationToken.orthographicCamera
      eq: true
    enum: [front, back, left, right, top, bottom]
    labels:
      front: 正视图
      back: 后视图
      left: 左视图
      right: 右视图
      top: 顶视图
      bottom: 底视图
    default: [front, left, right, top]
    recommended: [front, left, right, top]
    details: 详情.md
    notes:
      - "机位开关 On 时展示六标签；默认正/左/右/顶"
```

### control.orientation.orthoPositions — 正交机位位置 Ortho Camera Positions

```yaml
  - id: control.orientation.orthoPositions
    label: 正交机位位置 Ortho Camera Positions
    purpose: 设置方位Token组件辅助相机的交互
    path: interaction.orientationToken.orthoPositions
    tier: advanced
    type: object
    fields:
      - key: front.focalLengthMm
        type: float
        unit: mm
        panel: number
      - key: front.polarDeg
        type: float
        unit: deg
        panel: number
      - key: front.azimuthDeg
        type: float
        unit: deg
        panel: number
      - key: left.focalLengthMm
        type: float
        unit: mm
        panel: number
      - key: left.polarDeg
        type: float
        unit: deg
        panel: number
      - key: left.azimuthDeg
        type: float
        unit: deg
        panel: number
      - key: right.focalLengthMm
        type: float
        unit: mm
        panel: number
      - key: right.polarDeg
        type: float
        unit: deg
        panel: number
      - key: right.azimuthDeg
        type: float
        unit: deg
        panel: number
      - key: top.focalLengthMm
        type: float
        unit: mm
        panel: number
      - key: top.polarDeg
        type: float
        unit: deg
        panel: number
      - key: top.azimuthDeg
        type: float
        unit: deg
        panel: number
    basic: none
    visibleWhen:
      path: interaction.orientationToken.orthographicCamera
      eq: true
    details: 详情.md
    notes:
      - "按正/左/右/顶视图分别写 focalLengthMm、polarDeg、azimuthDeg；面板页签切换绑定"
      - "缺省跟随 Step1 焦距，俯仰/方位用各视图正交默认值"
```

### control.roam.firstPersonView — 漫游模式 First Person View

```yaml
  - id: control.roam.firstPersonView
    label: 漫游模式 First Person View
    purpose: 设置漫游相机的细节参数
    path: interaction.firstPersonView.enabled
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    advanced: none
    details: 详情.md
```

### control.roam.eyeLevelAdjustment — 真实视野调整 Eye Level Adjustment

```yaml
  - id: control.roam.eyeLevelAdjustment
    label: 真实视野调整 Eye Level Adjustment
    purpose: 设置漫游相机的细节参数
    path: interaction.firstPersonView.eyeLevelAdjustment
    tier: basic
    type: boolean
    panel: boolean
    visibleWhen:
      path: interaction.firstPersonView.enabled
      eq: true
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### control.roam.eyeLevelValue — 视野高度 Eye Level Value

```yaml
  - id: control.roam.eyeLevelValue
    label: 视野高度 Eye Level Value
    purpose: 设置漫游相机的细节参数
    path: interaction.firstPersonView.eyeLevelM
    tier: advanced
    type: number
    panel: slider+text
    basic: none
    unit: m
    min: 1.5
    max: 2
    step: 0.01
    visibleWhen:
      path: interaction.firstPersonView.enabled
      eq: true
    default: 1.7
    recommended: 1.7
    advanced: slider+text
    details: 详情.md
```

### control.roam.fieldOfViewHuman — 视野焦距 Field of View-Human

```yaml
  - id: control.roam.fieldOfViewHuman
    label: 视野焦距 Field of View-Human
    purpose: 设置漫游相机的细节参数
    path: interaction.firstPersonView.humanFocalLengthMm
    tier: advanced
    type: number
    panel: slider+text
    basic: none
    unit: mm
    min: 36
    max: 50
    step: 1
    visibleWhen:
      path: interaction.firstPersonView.enabled
      eq: true
    default: 36
    recommended: 36
    advanced: slider+text
    details: 详情.md
```

### control.roam.autoRoam — 自动漫游 Auto Roam

```yaml
  - id: control.roam.autoRoam
    label: 自动漫游 Auto Roam
    purpose: 设置漫游相机的细节参数
    path: interaction.firstPersonView.autoRoam
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    visibleWhen:
      path: interaction.firstPersonView.enabled
      eq: true
    advanced: none
    details: 详情.md
    notes:
      - "场景漫游 On 时展示；开启后展开绕轨速率"
```

### control.roam.orbitRate — 绕轨速率 Orbit Rate

```yaml
  - id: control.roam.orbitRate
    label: 绕轨速率 Orbit Rate
    purpose: 设置漫游相机的细节参数
    path: interaction.firstPersonView.orbitRate
    tier: advanced
    type: number
    panel: slider+text
    basic: none
    unit: x
    min: 0.1
    max: 10
    step: 0.1
    default: 1
    recommended: 1
    visibleWhen:
      path: interaction.firstPersonView.autoRoam
      eq: true
    advanced: slider+text
    details: 详情.md
```

### control.input.orbitAroundSelection — 绕选中旋转

```yaml
  - id: control.input.orbitAroundSelection
    label: 绕选中旋转
    path: interaction.camera.orbitAroundSelection
    tier: basic
    type: boolean
    default: true
    agent: read_only
```

### control.pivot.orbitAroundSelection — 选中旋转（select 块）

```yaml
  - id: control.pivot.orbitAroundSelection
    label: 选中旋转（select 块）
    path: select.orbitAroundSelection
    tier: basic
    type: boolean
    default: true
    agent: read_only
```

### control.camera.verticalFieldRange — 垂直视角范围 Vertical Field Range

```yaml
  - id: control.camera.verticalFieldRange
    label: 垂直视角范围 Vertical Field Range
    purpose: 设置相机边缘限制
    path: orbit
    tier: basic
    type: object
    panel: slider+text-dual
    paths:
      min: orbit.verticalFieldRangeMinDeg
      max: orbit.verticalFieldRangeMaxDeg
    min: -90
    max: 90
    step: 0.5
    default:
      min: 0
      max: 90
    recommended:
      min: 0
      max: 90
    advanced: none
    details: 详情.md
```

### control.camera.horizontalFieldRange — 水平视角范围 Horizontal Field Range

```yaml
  - id: control.camera.horizontalFieldRange
    label: 水平视角范围 Horizontal Field Range
    purpose: 设置相机边缘限制
    path: orbit
    tier: basic
    type: object
    panel: slider+text-dual
    paths:
      min: orbit.horizontalFieldRangeMinDeg
      max: orbit.horizontalFieldRangeMaxDeg
    min: -180
    max: 180
    step: 0.5
    default:
      min: -180
      max: 180
    recommended:
      min: -180
      max: 180
    advanced: none
    details: 详情.md
```

### control.camera.zoomRangeMode — 缩放范围模式 Zoom Range Mode

```yaml
  - id: control.camera.zoomRangeMode
    label: 缩放范围模式 Zoom Range Mode
    purpose: 设置相机边缘限制
    path: orbit.zoomRangeModes
    tier: basic
    type: array
    panel: multi-select
    enum: [multiplier, contentDataset]
    labels:
      multiplier: 倍数
      contentDataset: 内容数据集
    default: [contentDataset]
    recommended: [contentDataset]
    advanced: none
    details: 详情.md
```

### control.camera.zoomRange — 缩放范围 Zoom Range

```yaml
  - id: control.camera.zoomRange
    label: 缩放范围 Zoom Range
    purpose: 设置相机边缘限制
    path: orbit
    tier: advanced
    type: object
    panel: slider+text-dual
    visibleWhen:
      zoomRangeModesIncludes: multiplier
    paths:
      min: orbit.minDistance
      max: orbit.maxDistance
    min: 0.1
    max: 5000
    step: 0.1
    default:
      min: 0.1
      max: 1000
    recommended:
      min: 0.1
      max: 1000
    advanced: slider+text-dual
    details: 详情.md
```

### control.camera.dataLayerRange — 数据集范围 Data Layer Range

```yaml
  - id: control.camera.dataLayerRange
    label: 数据集范围 Data Layer Range
    purpose: 设置相机边缘限制
    path: render.dataLayer
    tier: advanced
    type: object
    panel: slider+text-dual
    visibleWhen:
      zoomRangeModesIncludes: contentDataset
    paths:
      min: render.dataLayer.minLevelIndex
      max: render.dataLayer.maxLevelIndex
    min: 0
    max: 43
    step: 1
    default:
      min: 0
      max: 43
    domainDefaults:
      算力中心: {min: 10, max: 27}
    recommendedNote: 普适 0～43 包住算力中心模板 10～27
    advanced: slider+text-dual
    details: 详情.md
```

### control.sensitivity.panSpeed — 拖动速度 Pan Speed

```yaml
  - id: control.sensitivity.panSpeed
    label: 拖动速度 Pan Speed
    purpose: 设置相机灵敏度
    path: orbit.panSpeed
    tier: basic
    type: number
    unit: ratio
    panel: slider+text
    min: 0.1
    max: 10
    step: 0.05
    default: 1.0
    recommended: 1.0
    advanced: none
    details: 详情.md
```

### control.sensitivity.rotateSpeed — 旋转速度 Orbit Speed

```yaml
  - id: control.sensitivity.rotateSpeed
    label: 旋转速度 Orbit Speed
    purpose: 设置相机灵敏度
    path: orbit.rotateSpeed
    tier: basic
    type: number
    unit: ratio
    panel: slider+text
    min: 0.1
    max: 10
    step: 0.05
    default: 1.0
    recommended: 1.0
    advanced: none
    details: 详情.md
```

### control.sensitivity.zoomSpeed — 缩放步长 Zoom Step

```yaml
  - id: control.sensitivity.zoomSpeed
    label: 缩放步长 Zoom Step
    purpose: 设置相机灵敏度
    path: orbit.zoomSpeed
    tier: basic
    type: number
    unit: ratio
    panel: slider+text
    min: 0.1
    max: 10
    step: 0.05
    default: 1.0
    recommended: 1.0
    advanced: none
    details: 详情.md
```

### control.adaptive.zoom.dynamicDataLayer — 缩放触发模型内容数据集切换 Dynamic Data Layer

```yaml
  - id: control.adaptive.zoom.dynamicDataLayer
    label: 缩放触发模型内容数据集切换 Dynamic Data Layer
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.dynamicDataLayerOnZoom
    tier: basic
    type: boolean
    panel: boolean
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### control.sensitivity.dampingFactor — 阻尼 Damping

```yaml
  - id: control.sensitivity.dampingFactor
    label: 阻尼 Damping
    purpose: 设置相机灵敏度
    path: orbit.dampingFactor
    tier: basic
    type: number
    unit: ratio
    panel: slider+text
    min: 0.1
    max: 10
    step: 0.05
    default: 0.2
    recommended: 0.2
    domainDefaults:
      芯片: 0.1
    recommendedNote: 普适 min 仍是 0.1，本字段芯片取 0.1。引擎阻尼 0.06 只在芯片领域包 force.orbit，选中芯片模板时写入视口
    advanced: none
    details: 详情.md
```

### control.adaptive.keepFocusOnOrbit — 旋转保持聚焦

```yaml
  - id: control.adaptive.keepFocusOnOrbit
    label: 旋转保持聚焦
    path: interaction.focus.keepFocusOnOrbit
    tier: basic
    type: boolean
    default: true
```

### control.adaptive.select.duration — 选中运镜时长 ms

```yaml
  - id: control.adaptive.select.duration
    label: 选中运镜时长 ms
    path: select.duration
    tier: advanced
    type: string
    default: "600"
    domainDefaults:
      芯片: "600"
    recommendedNote: 对齐 demo select.duration
```

### control.adaptive.select.angle — 选中机位仰角

```yaml
  - id: control.adaptive.select.angle
    label: 选中机位仰角
    path: select.angle
    tier: advanced
    type: string
    default: "45"
    domainDefaults:
      芯片: "60"
```

### control.adaptive.select.focus — 选中焦距 mm

```yaml
  - id: control.adaptive.select.focus
    label: 选中焦距 mm
    path: select.focus
    tier: advanced
    type: string
    default: "50"
    domainDefaults:
      芯片: "120"
```

### control.adaptive.select.origin — 选中机位原点表达式

```yaml
  - id: control.adaptive.select.origin
    label: 选中机位原点表达式
    path: select.origin
    tier: advanced
    type: string
    default: "0,0,0"
    domainDefaults:
      芯片: "0,0,0.5*(object)"
```

### control.adaptive.select.motionCurve — 选中运镜曲线

```yaml
  - id: control.adaptive.select.motionCurve
    label: 选中运镜曲线
    path: select.motionCurve
    tier: advanced
    type: string
    default: "0.2,0,0.1,1"
    domainDefaults:
      芯片: "0.2,0,0.1,1"
```

### control.adaptive.select.selectOpacity — 选中对象不透明度

```yaml
  - id: control.adaptive.select.selectOpacity
    label: 选中对象不透明度
    path: select.selectOpacity
    tier: advanced
    type: string
    default: "1.0"
    domainDefaults:
      芯片: "1.0"
```

### control.adaptive.select.otherOpacity — 选中时非聚焦不透明度

```yaml
  - id: control.adaptive.select.otherOpacity
    label: 选中时非聚焦不透明度
    path: select.otherOpacity
    tier: advanced
    type: string
    default: "0.3"
    domainDefaults:
      芯片: "0.4"
```

### control.adaptive.select.hideOtherTag — 选中时隐藏其他标签

```yaml
  - id: control.adaptive.select.hideOtherTag
    label: 选中时隐藏其他标签
    path: select.hideOtherTag
    tier: basic
    type: boolean
    panel: boolean
    default: false
    domainDefaults:
      芯片: false
```

### control.adaptive.select.otherTagOpacity — 选中时其他标签不透明度

```yaml
  - id: control.adaptive.select.otherTagOpacity
    label: 选中时其他标签不透明度
    path: select.otherTagOpacity
    tier: advanced
    type: string
    default: "0.6"
    domainDefaults:
      芯片: "0.6"
```

### control.adaptive.selectFocus.focusView — 聚焦画面占比

```yaml
  - id: control.adaptive.selectFocus.focusView
    label: 聚焦画面占比
    path: selectFocus.focusView
    tier: advanced
    type: string
    default: "50"
    domainDefaults:
      芯片: "67"
    recommendedNote: 对齐 demo selectFocus.focusView≈2/3 画面
```

### control.adaptive.selectFocus.focusAngle — 聚焦俯仰角

```yaml
  - id: control.adaptive.selectFocus.focusAngle
    label: 聚焦俯仰角
    path: selectFocus.focusAngle
    tier: advanced
    type: string
    default: "15"
    domainDefaults:
      芯片: "15"
    recommendedNote: 对齐 demo selectFocus.focusAngle；与芯片档俯仰一致
```

### control.adaptive.selectFocus.duration — 聚焦运镜时长 ms

```yaml
  - id: control.adaptive.selectFocus.duration
    label: 聚焦运镜时长 ms
    path: selectFocus.duration
    tier: advanced
    type: string
    default: "600"
    domainDefaults:
      芯片: "750"
    recommendedNote: 对齐 demo selectFocus.duration=750
```

### control.adaptive.selectFocus.motionCurve — 聚焦运镜曲线

```yaml
  - id: control.adaptive.selectFocus.motionCurve
    label: 聚焦运镜曲线
    path: selectFocus.motionCurve
    tier: advanced
    type: string
    default: "0.2,0,0.1,1"
    domainDefaults:
      芯片: "0.2,0,0.1,1"
```

### control.adaptive.selectFocus.hideOtherMesh — 聚焦时隐藏其他网格

```yaml
  - id: control.adaptive.selectFocus.hideOtherMesh
    label: 聚焦时隐藏其他网格
    path: selectFocus.hideOtherMesh
    tier: basic
    type: boolean
    panel: boolean
    default: false
    domainDefaults:
      芯片: true
    recommendedNote: 对齐 demo selectFocus.hideOtherMesh
```

### control.adaptive.selectFocus.relocateTarget — 聚焦时重定位轨道目标

```yaml
  - id: control.adaptive.selectFocus.relocateTarget
    label: 聚焦时重定位轨道目标
    path: selectFocus.relocateTarget
    tier: basic
    type: boolean
    panel: boolean
    default: true
    domainDefaults:
      芯片: true
```

### control.adaptive.selectFocus.focusOpacity — 聚焦对象不透明度

```yaml
  - id: control.adaptive.selectFocus.focusOpacity
    label: 聚焦对象不透明度
    path: selectFocus.focusOpacity
    tier: advanced
    type: string
    default: "1.0"
    domainDefaults:
      芯片: "1.0"
```

### control.adaptive.selectFocus.otherOpacity — 聚焦时非聚焦不透明度

```yaml
  - id: control.adaptive.selectFocus.otherOpacity
    label: 聚焦时非聚焦不透明度
    path: selectFocus.otherOpacity
    tier: advanced
    type: string
    default: "0.3"
    domainDefaults:
      芯片: "0.4"
```

### control.adaptive.selectFocus.hideOtherTag — 聚焦时隐藏其他标签

```yaml
  - id: control.adaptive.selectFocus.hideOtherTag
    label: 聚焦时隐藏其他标签
    path: selectFocus.hideOtherTag
    tier: basic
    type: boolean
    panel: boolean
    default: false
    domainDefaults:
      芯片: false
```

### control.adaptive.selectFocus.otherTagOpacity — 聚焦时其他标签不透明度

```yaml
  - id: control.adaptive.selectFocus.otherTagOpacity
    label: 聚焦时其他标签不透明度
    path: selectFocus.otherTagOpacity
    tier: advanced
    type: string
    default: "0.6"
    domainDefaults:
      芯片: "0.6"
```

### control.adaptive.threshold.focusThreshold — 阈值切换焦距阈值

```yaml
  - id: control.adaptive.threshold.focusThreshold
    label: 阈值切换焦距阈值
    path: thresholdTranisition.foucsThreshold
    tier: advanced
    type: string
    default: "80"
    domainDefaults:
      芯片: "114"
    recommendedNote: demo 拼写 foucsThreshold 原样保留
```

### control.adaptive.threshold.focusStep — 阈值切换步进

```yaml
  - id: control.adaptive.threshold.focusStep
    label: 阈值切换步进
    path: thresholdTranisition.foucsStep
    tier: advanced
    type: string
    default: "10"
    domainDefaults:
      芯片: "10"
```

### control.adaptive.threshold.duration — 阈值切换时长 ms

```yaml
  - id: control.adaptive.threshold.duration
    label: 阈值切换时长 ms
    path: thresholdTranisition.duration
    tier: advanced
    type: string
    default: "200"
    domainDefaults:
      芯片: "150"
```

### control.adaptive.threshold.focusDelay — 阈值切换延迟 ms

```yaml
  - id: control.adaptive.threshold.focusDelay
    label: 阈值切换延迟 ms
    path: thresholdTranisition.foucsDelay
    tier: advanced
    type: string
    default: "0"
    domainDefaults:
      芯片: "20"
```

### control.adaptive.threshold.motionBlur — 阈值切换运动模糊

```yaml
  - id: control.adaptive.threshold.motionBlur
    label: 阈值切换运动模糊
    path: thresholdTranisition.motionBlur
    tier: advanced
    type: boolean
    panel: boolean
    default: false
    domainDefaults:
      芯片: true
```

### control.adaptive.threshold.focusOpacity — 阈值切换聚焦不透明度

```yaml
  - id: control.adaptive.threshold.focusOpacity
    label: 阈值切换聚焦不透明度
    path: thresholdTranisition.focusOpacity
    tier: advanced
    type: string
    default: "1.0"
    domainDefaults:
      芯片: "1.0"
```

### control.adaptive.threshold.otherOpacity — 阈值切换非聚焦不透明度

```yaml
  - id: control.adaptive.threshold.otherOpacity
    label: 阈值切换非聚焦不透明度
    path: thresholdTranisition.otherOpacity
    tier: advanced
    type: string
    default: "0.3"
    domainDefaults:
      芯片: "0.4"
```

### control.adaptive.threshold.hideOtherTag — 阈值切换隐藏其他标签

```yaml
  - id: control.adaptive.threshold.hideOtherTag
    label: 阈值切换隐藏其他标签
    path: thresholdTranisition.hideOtherTag
    tier: basic
    type: boolean
    panel: boolean
    default: false
    domainDefaults:
      芯片: false
```

### control.adaptive.threshold.otherTagOpacity — 阈值切换其他标签不透明度

```yaml
  - id: control.adaptive.threshold.otherTagOpacity
    label: 阈值切换其他标签不透明度
    path: thresholdTranisition.OtherTagOpacity
    tier: advanced
    type: string
    default: "0.6"
    domainDefaults:
      芯片: "0.6"
```

### control.adaptive.select.cameraMove — 选中触发相机移动 Camera Reposition After Select

```yaml
  - id: control.adaptive.select.cameraMove
    label: 选中触发相机移动 Camera Reposition After Select
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.selectCamera
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    advanced: none
    details: 详情.md
    notes:
      - "默认关闭：选中仅捕获旋转原点，不得自动框选、居中或运镜。开启后才可调 #1 相机 #2 周边透明 #3 描边"
```

### control.adaptive.select.cameraPosition — 选中后相机位置 Camera Position - Select

```yaml
  - id: control.adaptive.select.cameraPosition
    label: 选中后相机位置 Camera Position - Select
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.selectReposition
    tier: advanced
    type: object
    basic: none
    visibleWhen:
      path: interaction.adaptive.selectCamera
      eq: true
    fields:
      - key: focalLengthMm
        type: float
        unit: mm
        range: [18, 300]
        recommended: inherit
        derivedFrom: space.camera.focalLength
      - key: polarDeg
        type: float
        unit: deg
        range: [-90, 90]
        recommended: inherit
        derivedFrom: space.camera.verticalViewAngle
      - key: azimuthDeg
        type: float
        unit: deg
        range: [-180, 180]
        recommended: inherit
        derivedFrom: space.camera.horizontalViewAngle
    details: 详情.md
    notes:
      - "仅 selectCamera On 时展示。默认 Off：选中只更新旋转原点，不得自动框选或运镜。未改写时等于 Step 1 已提交的焦距、俯仰、方位。禁止再写 50/45/0"
```

### control.adaptive.select.transparencyChange — 选中触发非聚焦物体透明度降低 Transparency Change - Select

```yaml
  - id: control.adaptive.select.transparencyChange
    label: 选中触发非聚焦物体透明度降低 Transparency Change - Select
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.selectReposition.dimOthers
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    domainDefaults:
      芯片: true
    advanced: none
    details: 详情.md
    notes:
      - "#2 开关；数值见 transparencyValue"
```

### control.adaptive.select.transparencyValue — 选中非聚焦物体透明度 Transparency Value - Select

```yaml
  - id: control.adaptive.select.transparencyValue
    label: 选中非聚焦物体透明度 Transparency Value - Select
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.selectReposition.othersOpacityPct
    tier: advanced
    type: float
    range: [0, 100]
    unit: percent
    default: 30
    recommended: 30
    domainDefaults:
      芯片: 40
    recommendedNote: 对齐 demo select.otherOpacity=0.4
    visibleWhen:
      path: interaction.adaptive.selectReposition.dimOthers
      eq: true
    details: 详情.md
```

### control.adaptive.select.highlightObject — 选中聚焦物体描边 Highlight Object - Select

```yaml
  - id: control.adaptive.select.highlightObject
    label: 选中聚焦物体描边 Highlight Object - Select
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.selectReposition.showOutline
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    domainDefaults:
      芯片: true
    advanced: none
    details: 详情.md
    notes:
      - "#3 描边开关；颜色与粗细见 highlightEdge"
```

### control.adaptive.select.highlightEdge — 选中聚焦物体边缘高亮 Highlight Object - Select

```yaml
  - id: control.adaptive.select.highlightEdge
    label: 选中聚焦物体边缘高亮 Highlight Object - Select
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.selectReposition
    tier: advanced
    type: object
    basic: none
    visibleWhen:
      path: interaction.adaptive.selectReposition.showOutline
      eq: true
    fields:
      - key: outlineColor
        label: 边缘高亮颜色
        type: string
        format: H-S-V
        example: "0-0-0"
        default: "0-0-100"
        recommended: "0-0-100"
      - key: outlineWidth
        label: 高亮粗细
        type: float
        unit: px
        panel: slider+text
        range: [0.1, 100]
        default: 2
        recommended: 2
    details: 详情.md
    notes:
      - "仅 showOutline On 时展示；#3 描边颜色与粗细"
```

### control.adaptive.hover.cameraMove — 悬浮触发相机移动 Camera Reposition After Hover

```yaml
  - id: control.adaptive.hover.cameraMove
    label: 悬浮触发相机移动 Camera Reposition After Hover
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.hoverCamera
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    advanced: none
    details: 详情.md
    notes:
      - "默认关。打开后才移动相机，不连带改透明度或描边"
```

### control.adaptive.hover.cameraPosition — 悬浮后相机位置 Camera Position - Hover

```yaml
  - id: control.adaptive.hover.cameraPosition
    label: 悬浮后相机位置 Camera Position - Hover
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.hoverReposition
    tier: advanced
    type: object
    visibleWhen:
      path: interaction.adaptive.hoverCamera
      eq: true
    fields:
      - key: focalLengthMm
        type: float
        unit: mm
        range: [18, 300]
        recommended: inherit
        derivedFrom: space.camera.focalLength
      - key: polarDeg
        type: float
        unit: deg
        range: [-90, 90]
        recommended: inherit
        derivedFrom: space.camera.verticalViewAngle
      - key: azimuthDeg
        type: float
        unit: deg
        range: [-180, 180]
        recommended: inherit
        derivedFrom: space.camera.horizontalViewAngle
    details: 详情.md
    notes:
      - "仅 hoverCamera On 时展示。未改写时等于 Step 1 已提交的焦距、俯仰、方位。禁止再写 43/45/0"
```

### control.adaptive.hover.transparencyChange — 悬浮触发非聚焦物体透明度降低 Transparency Change - Hover

```yaml
  - id: control.adaptive.hover.transparencyChange
    label: 悬浮触发非聚焦物体透明度降低 Transparency Change - Hover
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.hoverReposition.dimOthers
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    advanced: none
    details: 详情.md
    notes:
      - "#2 开关；数值见 transparencyValue"
```

### control.adaptive.hover.transparencyValue — 悬浮非聚焦物体透明度 Transparency Value - Hover

```yaml
  - id: control.adaptive.hover.transparencyValue
    label: 悬浮非聚焦物体透明度 Transparency Value - Hover
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.hoverReposition.othersOpacityPct
    tier: advanced
    type: float
    range: [0, 100]
    unit: percent
    default: 30
    recommended: 30
    domainDefaults:
      芯片: 40
    recommendedNote: 与选中透明度同为 demo otherOpacity=0.4
    visibleWhen:
      path: interaction.adaptive.hoverReposition.dimOthers
      eq: true
    details: 详情.md
```

### control.adaptive.hover.highlightObject — 悬浮聚焦物体描边 Highlight Object - Hover

```yaml
  - id: control.adaptive.hover.highlightObject
    label: 悬浮聚焦物体描边 Highlight Object - Hover
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.hoverReposition.showOutline
    tier: basic
    type: boolean
    panel: boolean
    default: false
    recommended: false
    advanced: none
    details: 详情.md
    notes:
      - "#3 描边开关；颜色与粗细见 highlightEdge"
```

### control.adaptive.hover.highlightEdge — 悬浮聚焦物体边缘高亮 Highlight Object - Hover

```yaml
  - id: control.adaptive.hover.highlightEdge
    label: 悬浮聚焦物体边缘高亮 Highlight Object - Hover
    purpose: 触发交互后，连带的周边自适应行为
    path: interaction.adaptive.hoverReposition
    tier: advanced
    type: object
    basic: none
    visibleWhen:
      path: interaction.adaptive.hoverReposition.showOutline
      eq: true
    fields:
      - key: outlineColor
        label: 边缘高亮颜色
        type: string
        format: H-S-V
        example: "0-0-0"
        default: "0-0-100"
        recommended: "0-0-100"
      - key: outlineWidth
        label: 高亮粗细
        type: float
        unit: px
        panel: slider+text
        range: [0.1, 100]
        default: 2
        recommended: 2
    details: 详情.md
    notes:
      - "仅 showOutline On 时展示；#3 描边颜色与粗细"
```

## step-04-业务信息

来源 `step-04-业务信息/参数.yaml`；参数数 45。

### info.physical.explosiveView — 模型爆炸视图 Explosive View

```yaml
  - id: info.physical.explosiveView
    label: 模型爆炸视图 Explosive View
    purpose: 动态调整“底图”模型
    path: ui.exploded
    tier: basic
    type: boolean
    panel: boolean
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### info.physical.explodeGap — 模型间的距离 Model Gap in Explosive View

```yaml
  - id: info.physical.explodeGap
    label: 模型间的距离 Model Gap in Explosive View
    purpose: 动态调整“底图”模型
    path: ui.explodeGap
    tier: advanced
    type: number
    unit: mm
    panel: slider+text
    basic: none
    min: 0.1
    max: 100
    step: 0.1
    visibleWhen:
      path: ui.exploded
      eq: true
    recommendedFor: [芯片]
    domainDefaults:
      芯片: 8
    domainExclusive: true
    recommendedNote: 对齐路径检查demo EXPLODE_LAYER_GAP_MM=8；只属于芯片，不写普适 default
    advanced: slider+text
    details: 详情.md
```

### info.physical.assembleGap — 收起态层间距 Assemble Gap

```yaml
  - id: info.physical.assembleGap
    label: 收起态层间距 Assemble Gap
    purpose: 动态调整“底图”模型
    path: ui.assembleGap
    tier: advanced
    type: number
    unit: mm
    panel: slider+text
    min: 0
    max: 100
    step: 0.1
    default: 0
    domainDefaults:
      芯片: 0
    recommendedNote: demo assembleGap=0（紧贴）
```

### info.physical.sectionCutMode — 切口模式 Cut Mode

```yaml
  - id: info.physical.sectionCutMode
    label: 切口模式 Cut Mode
    purpose: 动态调整“底图”模型
    path: ui.sectioning.cutMode
    tier: basic
    type: enum
    panel: single-select
    enum: [real, virtual]
    labels:
      real: 真实切口
      virtual: 虚拟切口
    default: real
    recommended: real
    advanced: none
    details: 详情.md
    notes:
      - "切剖图标题下页签；默认真实切口"
```

### info.physical.sectionView — 模型切剖视图 Section View

```yaml
  - id: info.physical.sectionView
    label: 模型切剖视图 Section View
    purpose: 动态调整“底图”模型
    path: ui.sectioning.enabled
    tier: basic
    type: boolean
    panel: boolean
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### info.physical.sectionSizeControl — 切剖面尺寸控制 Section Size Control

```yaml
  - id: info.physical.sectionSizeControl
    label: 切剖面尺寸控制 Section Size Control
    purpose: 动态调整“底图”模型
    path: ui.sectioning.sizeControl
    tier: advanced
    type: array
    panel: single-select
    basic: none
    visibleWhen:
      path: ui.sectioning.enabled
      eq: true
    enum: [free, numeric]
    labels:
      free: 自由编辑
      numeric: 数值编辑
    default: [free]
    recommended: [free]
    note: 用户可动态拖拽调整切剖面长宽
    details: 详情.md
```

### info.physical.sectionRotationControl — 切剖面角度控制 Section Rotation Control

```yaml
  - id: info.physical.sectionRotationControl
    label: 切剖面角度控制 Section Rotation Control
    purpose: 动态调整“底图”模型
    path: ui.sectioning.rotationDeg
    tier: advanced
    type: number
    panel: slider+text
    basic: none
    unit: deg
    min: -180
    max: 180
    step: 0.5
    visibleWhen:
      path: ui.sectioning.enabled
      eq: true
    default: 0
    recommended: 0
    note: 用户可动态拖拽调整切剖面的角度
    details: 详情.md
```

### info.physical.sectionMultiPlaneControl — 切剖面的多面组合控制 Section Multi-Plane / Box Control

```yaml
  - id: info.physical.sectionMultiPlaneControl
    label: 切剖面的多面组合控制 Section Multi-Plane / Box Control
    purpose: 动态调整“底图”模型
    path: ui.sectioning.faces
    tier: advanced
    type: array
    panel: multi-select
    basic: none
    visibleWhen:
      path: ui.sectioning.enabled
      eq: true
    enum: [front, back, left, right, top, bottom]
    labels:
      front: 前
      back: 后
      left: 左
      right: 右
      top: 上
      bottom: 下
    default: [front]
    recommended: [front]
    note: 用户可同时从前、后、左、右、上、下6个侧面进行协同裁剪
    details: 详情.md
```

### info.physical.sectionCapping — 切面的封口控制 Section Capping

```yaml
  - id: info.physical.sectionCapping
    label: 切面的封口控制 Section Capping
    purpose: 动态调整“底图”模型
    path: ui.sectioning.capping
    tier: advanced
    type: boolean
    panel: boolean
    basic: none
    default: true
    recommended: true
    domainDefaults:
      芯片: true
    note: 控制是否在切面上生成虚拟的“封口面”
    details: 详情.md
    notes:
      - "高级设置二层开关；On 时展开封口材质/颜色/排除选择器"
```

### info.physical.sectionOpacity — 切剖面自身不透明度

```yaml
  - id: info.physical.sectionOpacity
    label: 切剖面自身不透明度
    path: ui.sectioning.sectionOpacity
    tier: advanced
    type: string
    default: "0.15"
    domainDefaults:
      芯片: "0.0"
    visibleWhen:
      path: ui.sectioning.enabled
      eq: true
    recommendedNote: demo sectionOpacity=0（切面不可见，只裁剪）
```

### info.physical.sectioningPlane — 切剖面位置归一化

```yaml
  - id: info.physical.sectioningPlane
    label: 切剖面位置归一化
    path: ui.sectioning.sectioningPlane
    tier: advanced
    type: string
    default: "0.5"
    domainDefaults:
      芯片: "0.2"
    visibleWhen:
      path: ui.sectioning.enabled
      eq: true
```

### info.physical.sectionPlaneSize — 切剖面尺寸模式

```yaml
  - id: info.physical.sectionPlaneSize
    label: 切剖面尺寸模式
    path: ui.sectioning.PlaneSize
    tier: advanced
    type: enum
    enum: [default, custom]
    default: default
    domainDefaults:
      芯片: default
    visibleWhen:
      path: ui.sectioning.enabled
      eq: true
```

### info.physical.sectionPlaneAxis — 切剖面法线轴

```yaml
  - id: info.physical.sectionPlaneAxis
    label: 切剖面法线轴
    path: ui.sectioning.planeAxis
    tier: advanced
    type: enum
    enum: [x, y, z]
    default: y
    domainDefaults:
      芯片: z
    recommendedNote: demo 默认 z=正面视角法线
```

### info.physical.sectionPlaneArmMs — 切剖面长按激活 ms

```yaml
  - id: info.physical.sectionPlaneArmMs
    label: 切剖面长按激活 ms
    path: ui.sectioning.planeArmMs
    tier: advanced
    type: number
    unit: ms
    min: 0
    max: 5000
    step: 100
    default: 500
    domainDefaults:
      芯片: 1700
```

### info.physical.sectionOtherOpacity — 切剖时非聚焦不透明度

```yaml
  - id: info.physical.sectionOtherOpacity
    label: 切剖时非聚焦不透明度
    path: ui.sectioning.otherOpacity
    tier: advanced
    type: string
    default: "0.3"
    domainDefaults:
      芯片: "0.4"
```

### info.physical.sectionFocusOpacity — 切剖时聚焦不透明度

```yaml
  - id: info.physical.sectionFocusOpacity
    label: 切剖时聚焦不透明度
    path: ui.sectioning.focusOpacity
    tier: advanced
    type: string
    default: "1.0"
    domainDefaults:
      芯片: "1.0"
```

### info.physical.sectionHideOtherTag — 切剖时隐藏其他标签

```yaml
  - id: info.physical.sectionHideOtherTag
    label: 切剖时隐藏其他标签
    path: ui.sectioning.hideOtherTag
    tier: basic
    type: boolean
    panel: boolean
    default: false
    domainDefaults:
      芯片: true
```

### info.physical.sectionOtherTagOpacity — 切剖时其他标签不透明度

```yaml
  - id: info.physical.sectionOtherTagOpacity
    label: 切剖时其他标签不透明度
    path: ui.sectioning.OtherTagOpacity
    tier: advanced
    type: string
    default: "0.6"
    domainDefaults:
      芯片: "0.6"
```

### info.physical.sectionHideSectionTag — 隐藏切剖标签

```yaml
  - id: info.physical.sectionHideSectionTag
    label: 隐藏切剖标签
    path: ui.sectioning.hideSectionTag
    tier: basic
    type: boolean
    panel: boolean
    default: false
    domainDefaults:
      芯片: false
```

### info.physical.sectionEdgeColor — 切剖面描边色

```yaml
  - id: info.physical.sectionEdgeColor
    label: 切剖面描边色
    path: ui.sectioning.edgeColor
    tier: advanced
    type: string
    default: "#FFFFFF"
    domainDefaults:
      芯片: "#FFFFFF"
```

### info.physical.sectionCapMaterialColor — 封口材质与颜色 Cap Material / Color

```yaml
  - id: info.physical.sectionCapMaterialColor
    label: 封口材质与颜色 Cap Material / Color
    purpose: 动态调整“底图”模型
    path: ui.sectioning.cap
    tier: advanced
    type: array
    panel: multi-select+color
    basic: none
    visibleWhen:
      path: ui.sectioning.capping
      eq: true
    enum: [diffuse, reflective, transparent]
    labels:
      diffuse: 漫射
      reflective: 反射
      transparent: 透明
    default:
      materials: [diffuse]
      color: "#A6C9DC"
    recommended:
      materials: [diffuse]
      color: "#A6C9DC"
    recommendedNote: 芯片 demo sectionCapColor=#A6C9DC，与普适 default 同值
    details: 详情.md
```

### info.physical.pathFocusColor — 路径聚焦色

```yaml
  - id: info.physical.pathFocusColor
    label: 路径聚焦色
    path: pathUi.focusColor
    tier: advanced
    type: string
    panel: text
    recommendedFor: [芯片]
    domainDefaults:
      芯片: "#ffffff"
    domainExclusive: true
```

### info.physical.pathIdleOutline — 路径空闲描边色

```yaml
  - id: info.physical.pathIdleOutline
    label: 路径空闲描边色
    path: pathUi.idleOutline
    tier: advanced
    type: string
    panel: text
    recommendedFor: [芯片]
    domainDefaults:
      芯片: "#939393"
    domainExclusive: true
```

### info.physical.pathBundleDimOpacity — 束路径非聚焦不透明度

```yaml
  - id: info.physical.pathBundleDimOpacity
    label: 束路径非聚焦不透明度
    path: pathUi.bundlePathDimOpacity
    tier: advanced
    type: float
    unit: percent
    panel: slider+text
    range: [0, 1]
    recommendedFor: [芯片]
    domainDefaults:
      芯片: 0.2
    domainExclusive: true
```

### info.physical.pathBundleFocusDimOpacity — 束路径焦点外不透明度

```yaml
  - id: info.physical.pathBundleFocusDimOpacity
    label: 束路径焦点外不透明度
    path: pathUi.bundlePathFocusDimOpacity
    tier: advanced
    type: float
    unit: percent
    panel: slider+text
    range: [0, 1]
    recommendedFor: [芯片]
    domainDefaults:
      芯片: 0.05
    domainExclusive: true
```

### info.physical.pathNegativeSlackColor — Negative Slack 路径色

```yaml
  - id: info.physical.pathNegativeSlackColor
    label: Negative Slack 路径色
    path: pathUi.negativeSlackColor
    tier: advanced
    type: string
    panel: text
    recommendedFor: [芯片]
    domainDefaults:
      芯片: "#c850ff"
    domainExclusive: true
```

### info.physical.sectionExclusionList — 切剖排除选择器 Exclusion List

```yaml
  - id: info.physical.sectionExclusionList
    label: 切剖排除选择器 Exclusion List
    purpose: 动态调整“底图”模型
    path: ui.sectioning.exclusion
    tier: advanced
    type: array
    panel: multi-select
    basic: none
    visibleWhen:
      path: ui.sectioning.capping
      eq: true
    enum: [__all__, core-timing-path]
    labels:
      __all__: 全部
      core-timing-path: 核心时序路径
    default: null
    recommended: [core-timing-path]
    recommendedFor: [芯片]
    domainDefaults:
      芯片: [core-timing-path]
    domainExclusive: true
    recommendedNote: 默认选中核心时序路径；以芯片为例，只属于芯片
    details: 详情.md
```

### info.sim.styleMode — 仿真层UI风格 Style Mode

```yaml
  - id: info.sim.styleMode
    label: 仿真层UI风格 Style Mode
    purpose: 动态调整“仿真层”3D UI
    path: simUi.styleMode
    tier: basic
    type: enum
    panel: single-select
    enum: [realistic, virtual]
    labels:
      realistic: 写实
      virtual: 虚拟
    default: realistic
    recommended: realistic
    advanced: none
    details: 详情.md
    notes:
      - "仿真层UI 标题下页签；默认写实"
```

### info.sim.stackNumber — 仿真信息叠加数量 Simulated Information Stack Number

```yaml
  - id: info.sim.stackNumber
    label: 仿真信息叠加数量 Simulated Information Stack Number
    purpose: 动态调整“仿真层”3D UI
    path: simUi.stackNumber
    tier: basic
    type: number
    unit: count
    panel: text
    basic: text
    min: 0
    max: 7
    step: 1
    recommendedFor: [芯片]
    domainDefaults:
      芯片: 1
    domainExclusive: true
    recommendedNote: 设置基于实际需求，以芯片为例。只属于芯片，不写普适 default
    advanced: none
    details: 详情.md
```

### info.sim.stackType — 仿真信息叠加方式 Simulated Information Stack Type

```yaml
  - id: info.sim.stackType
    label: 仿真信息叠加方式 Simulated Information Stack Type
    purpose: 动态调整“仿真层”3D UI
    path: simUi.stackType
    tier: basic
    type: array
    panel: single-select
    basic: single-select
    enum: [attached, float]
    labels:
      attached: 叠加至物理模型
      float: 悬浮于物理模型
    recommendedFor: [芯片]
    domainDefaults:
      芯片: [attached]
    domainExclusive: true
    recommendedNote: 设置基于实际需求，以芯片为例。只属于芯片，不写普适 default
    advanced: none
    details: 详情.md
```

### info.sim.gap — 仿真信息间的距离 Simulated Information Gap

```yaml
  - id: info.sim.gap
    label: 仿真信息间的距离 Simulated Information Gap
    purpose: 动态调整“仿真层”3D UI
    path: simUi.gap
    tier: advanced
    type: number
    unit: modelUnit
    panel: slider+text
    basic: none
    min: 0
    max: 7
    step: 1
    visibleWhen:
      path: simUi.stackType
      eq: float
    recommendedFor: [芯片]
    domainDefaults:
      芯片: 1
    domainExclusive: true
    recommendedNote: 仅悬浮于物理模型时展示；推荐 1 · 芯片。只属于芯片，不写普适 default
    advanced: slider+text
    details: 详情.md
    notes:
      - "仿真层UI 高级设置：叠加方式=悬浮于物理模型 时第三层参数"
```

### info.sim.transparency — 仿真信息透明度 Simulated Information Transparency

```yaml
  - id: info.sim.transparency
    label: 仿真信息透明度 Simulated Information Transparency
    purpose: 动态调整“仿真层”3D UI
    path: simUi.transparency
    tier: advanced
    type: number
    unit: percent
    panel: slider+text
    basic: none
    min: 0.1
    max: 100
    step: 0.1
    default: 100
    recommendedFor: [GTS领域]
    domainDefaults:
      GTS领域: x
    recommendedNote: 普适 default 100 在 0.1～100 内。GTS领域无等价 AIDC 仿真值，匹配后留空
    advanced: slider+text
    details: 详情.md
```

### info.sim.dataFilter — 仿真信息数值过滤器 Simulated Information Data Filter

```yaml
  - id: info.sim.dataFilter
    label: 仿真信息数值过滤器 Simulated Information Data Filter
    purpose: 动态调整“仿真层”3D UI
    path: simUi.dataFilter
    tier: basic
    type: boolean
    panel: boolean
    basic: boolean
    default: true
    recommended: true
    advanced: none
    details: 详情.md
```

### info.sim.timeline — 仿真时间轴 Simulated Timeline

```yaml
  - id: info.sim.timeline
    label: 仿真时间轴 Simulated Timeline
    purpose: 动态调整“仿真层”3D UI
    path: simUi.timeline
    tier: basic
    type: boolean
    panel: boolean
    basic: boolean
    default: true
    recommended: true
    advanced: none
    details: 详情.md
    notes:
      - "仿真层模式 高级设置：页签下开关；On 时展开步长/播放速率"
```

### info.sim.timelineStep — 仿真时间轴步长 Simulated Timeline Step

```yaml
  - id: info.sim.timelineStep
    label: 仿真时间轴步长 Simulated Timeline Step
    purpose: 动态调整“仿真层”3D UI
    path: simUi.timelineStep
    tier: advanced
    type: number
    unit: count
    panel: slider+text
    basic: none
    min: 1
    max: 60
    step: 0.1
    visibleWhen:
      path: simUi.timeline
      eq: true
    default: 1
    recommendedFor: [GTS领域]
    domainDefaults:
      GTS领域: x
    recommendedNote: 普适 default 1 在 1～60 内。GTS领域无等价 AIDC 仿真值，匹配后留空
    advanced: slider+text
    details: 详情.md
```

### info.sim.playbackControl — 仿真时间轴播放速率 Simulated Timeline Playback Control

```yaml
  - id: info.sim.playbackControl
    label: 仿真时间轴播放速率 Simulated Timeline Playback Control
    purpose: 动态调整“仿真层”3D UI
    path: simUi.playbackControl
    tier: advanced
    type: array
    panel: single-select
    basic: none
    advanced: single-select
    enum: ["x1.5", "x2", "x5", "x10", "x20"]
    labels:
      "x1.5": x1.5
      "x2": x2
      "x5": x5
      "x10": x10
      "x20": x20
    visibleWhen:
      path: simUi.timeline
      eq: true
    recommendedFor: [GTS领域]
    domainDefaults:
      GTS领域: ["x2"]
    domainExclusive: true
    recommendedNote: 设置基于业务需求，以 GTS领域为例。只属于 GTS领域，不写普适 default
    details: 详情.md
```

### info.logic.lightMode — 逻辑层光源模式 Light Mode

```yaml
  - id: info.logic.lightMode
    label: 逻辑层光源模式 Light Mode
    purpose: 动态调整“逻辑层”3D UI
    path: logicUi.lightMode
    tier: basic
    type: enum
    panel: single-select
    enum: [default, custom]
    labels:
      default: 默认光源
      custom: 自定义
    default: default
    recommended: default
    advanced: none
    details: 详情.md
    notes:
      - "逻辑层显示 标题下页签；默认默认光源"
```

### info.logic.topoLayout — 逻辑层拓扑排布方式 Topo Diagram Layout

```yaml
  - id: info.logic.topoLayout
    label: 逻辑层拓扑排布方式 Topo Diagram Layout
    purpose: 动态调整“逻辑层”3D UI
    path: logicUi.topoLayout
    tier: basic
    type: array
    panel: single-select
    basic: single-select
    enum: [center, staggered]
    labels:
      center: 居中对齐
      staggered: 错落分布
    recommendedFor: [GTS领域]
    domainDefaults:
      GTS领域: ["staggered"]
    domainExclusive: true
    recommendedNote: 设置基于业务需求，以 GTS领域为例。只属于 GTS领域，不写普适 default
    advanced: none
    details: 详情.md
```

### info.logic.expandableSubNode — 可展开的子节点数量 Expandable Sub Node

```yaml
  - id: info.logic.expandableSubNode
    label: 可展开的子节点数量 Expandable Sub Node
    purpose: 动态调整“逻辑层”3D UI
    path: logicUi.expandableSubNode
    tier: basic
    type: number
    unit: count
    panel: slider+text
    basic: slider+text
    min: 1
    max: 10
    step: 0.1
    recommendedFor: [GTS领域]
    domainDefaults:
      GTS领域: 5
    domainExclusive: true
    recommendedNote: 设置基于业务需求，以 GTS领域为例。只属于 GTS领域，不写普适 default
    advanced: none
    details: 详情.md
```

### info.logic.topoDepth — 可跳转的层级数量 Topo Depth

```yaml
  - id: info.logic.topoDepth
    label: 可跳转的层级数量 Topo Depth
    purpose: 动态调整“逻辑层”3D UI
    path: logicUi.topoDepth
    tier: basic
    type: number
    unit: count
    panel: slider+text
    basic: slider+text
    min: 1
    max: 5
    step: 0.1
    recommendedFor: [GTS领域]
    domainDefaults:
      GTS领域: 1
    domainExclusive: true
    recommendedNote: 设置基于业务需求，以 GTS领域为例。只属于 GTS领域，不写普适 default
    advanced: none
    details: 详情.md
```

### info.simCloud.lightMode — 仿真层模式光源 Light Mode

```yaml
  - id: info.simCloud.lightMode
    label: 仿真层模式光源 Light Mode
    purpose: 动态调整“仿真层”呈现模式
    path: simCloud.lightMode
    tier: basic
    type: enum
    panel: single-select
    enum: [default, custom]
    labels:
      default: 默认光源
      custom: 自定义
    default: default
    recommended: default
    advanced: none
    details: 详情.md
    notes:
      - "仿真层模式 标题下页签；默认默认光源"
```

### info.simCloud.enabled — 仿真云图

```yaml
  - id: info.simCloud.enabled
    label: 仿真云图
    path: simCloud.enabled
    tier: basic
    type: boolean
    default: false
```

### info.simCloud.channel — 云图通道

```yaml
  - id: info.simCloud.channel
    label: 云图通道
    path: simCloud.channel
    tier: basic
    type: enum
    default: temp
    enum: [temp, run, traffic, load]
```

### info.tree.granularity — 结构树粒度

```yaml
  - id: info.tree.granularity
    label: 结构树粒度
    path: ui.tree.granularity
    tier: basic
    type: string
    default: row
```

### info.physical.simUserData — 仿真挂点

```yaml
  - id: info.physical.simUserData
    label: 仿真挂点
    path: mesh.userData.sim
    tier: basic
    type: object
    fieldRole: unimplemented
    note: 宿主绑定点；Skill 不展开业务 schema，由 Adapter 挂可点根件
```

## 面板生成字段全量目录

下面是现有字段.json的快照，包括条件和嵌套属性；其版本可能与 YAML 不同步，差异需要在任务 A2 核查。

```json
{
  "source": "四个 Step 的 参数.yaml",
  "version": "1.01",
  "builtFrom": [
    "step-01-基础空间/参数.yaml",
    "step-02-导入对象/参数.yaml",
    "step-03-场景控制/参数.yaml",
    "step-04-业务信息/参数.yaml"
  ],
  "templates": [
    {
      "id": "universal",
      "label": "普适",
      "domain": null,
      "cameraTier": "bbox",
      "emptyScaleLevel": "L19"
    },
    {
      "id": "chip",
      "label": "芯片",
      "domain": "芯片",
      "cameraTier": "chip",
      "emptyScaleLevel": "L27"
    },
    {
      "id": "gts",
      "label": "GTS领域",
      "domain": "GTS领域",
      "cameraTier": "keep",
      "emptyScaleLevel": null
    },
    {
      "id": "compute",
      "label": "算力中心",
      "domain": "算力中心",
      "cameraTier": "keep",
      "emptyScaleLevel": null
    }
  ],
  "coverage": {
    "panelFields": 214,
    "unsupported": 8,
    "editableUnsupported": 0
  },
  "fields": [
    {
      "id": "space.container.length",
      "step": "1",
      "tab": "空间",
      "label": "长度与距离 Length",
      "path": "foundation.length",
      "widget": "length",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "1:1km",
        "1:1m",
        "1:1cm",
        "1:1mm"
      ],
      "labels": null,
      "default": "1:1m",
      "recommended": "1:1m",
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "1:1cm",
        "GTS领域": "1:1m"
      },
      "domainExclusive": false,
      "map": {
        "1:1km": {
          "worldUnit": "km",
          "sceneMetersPerUnit": 1000
        },
        "1:1m": {
          "worldUnit": "m",
          "sceneMetersPerUnit": 1
        },
        "1:1cm": {
          "worldUnit": "cm",
          "sceneMetersPerUnit": 0.01
        },
        "1:1mm": {
          "worldUnit": "mm",
          "sceneMetersPerUnit": 0.001
        }
      },
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "空间尺寸与单位",
        "order": 10
      },
      "dependsOn": [],
      "affects": [
        "space",
        "interaction",
        "visualization"
      ]
    },
    {
      "id": "space.container.gridMajorMm",
      "step": "1",
      "tab": "空间",
      "label": "网格主格 mm",
      "path": "foundation.gridMajorMm",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": 1000,
      "recommended": 1000,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 10,
        "GTS领域": 1000
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "空间尺寸与单位",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space",
        "interaction",
        "visualization"
      ]
    },
    {
      "id": "space.container.activeScaleLevelId",
      "step": "1",
      "tab": "空间",
      "label": "当前比例尺 L",
      "path": "ui.scale.activeScaleLevelId",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "L19",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "L27",
        "GTS领域": "L15"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "空间尺寸与单位",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.camera.focalLength",
      "step": "1",
      "tab": "空间",
      "label": "焦距 Focal Length",
      "path": "foundation.focalLengthMm",
      "widget": "number",
      "min": 18,
      "max": 300,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": 36,
      "recommended": {
        "scene": 36,
        "singleObject": 50,
        "chip": 80
      },
      "recommendedFor": null,
      "domainDefaults": {
        "GTS领域": 30
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "观察视角",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space",
        "interaction"
      ]
    },
    {
      "id": "space.camera.sensorHeight",
      "step": "1",
      "tab": "空间",
      "label": "传感器高度 Sensor Height",
      "path": "foundation.sensorHeightMm",
      "widget": "number",
      "min": 1,
      "max": 100,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": 24,
      "recommended": 24,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.camera.verticalViewAngle",
      "step": "1",
      "tab": "空间",
      "label": "垂直视角 Vertical Field of View",
      "path": "controls.polarDeg",
      "widget": "number",
      "min": -90,
      "max": 90,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": 30,
      "recommended": {
        "scene": 30,
        "singleObject": 45,
        "chip": 15
      },
      "recommendedFor": null,
      "domainDefaults": {
        "GTS领域": 12.4
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "观察视角",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space",
        "interaction"
      ]
    },
    {
      "id": "space.camera.horizontalViewAngle",
      "step": "1",
      "tab": "空间",
      "label": "水平视角 Horizontal Field of View",
      "path": "controls.azimuthDeg",
      "widget": "number",
      "min": -180,
      "max": 180,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": 150,
      "recommended": {
        "scene": 150,
        "singleObject": 150,
        "chip": 0
      },
      "recommendedFor": null,
      "domainDefaults": {
        "GTS领域": 32.5
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "观察视角",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space",
        "interaction"
      ]
    },
    {
      "id": "space.camera.motionRadius",
      "step": "1",
      "tab": "空间",
      "label": "相机运动半径",
      "path": "controls.cameraMotionRadiusMode",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "fixed",
        "scene"
      ],
      "labels": {
        "fixed": "固定数值",
        "scene": "场景"
      },
      "default": "scene",
      "recommended": "scene",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "观察视角",
        "order": 40
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.camera.globalBrightness",
      "step": "1",
      "tab": "空间",
      "label": "全局亮度",
      "path": "foundation.globalBrightness",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.type",
      "step": "1",
      "tab": "空间",
      "label": "灯光类型 Lighting Type",
      "path": "foundation.lightingTypes",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "point",
        "directional",
        "area",
        "environment"
      ],
      "labels": {
        "point": "点光",
        "directional": "平行光",
        "area": "区域光",
        "environment": "环境光（HDR）"
      },
      "default": [
        "directional",
        "area",
        "environment"
      ],
      "recommended": [
        "directional",
        "area",
        "environment"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.shadow",
      "step": "1",
      "tab": "空间",
      "label": "阴影 Shadow",
      "path": "foundation.shadowEnabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": false
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.shadowOpacity",
      "step": "1",
      "tab": "空间",
      "label": "阴影不透明度 Shadow Opacity",
      "path": "foundation.shadowOpacity",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "%",
      "enum": null,
      "labels": null,
      "default": 100,
      "recommended": 100,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.decay",
      "step": "1",
      "tab": "空间",
      "label": "光源衰减 Light Decay",
      "path": "foundation.lightDecay",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "none",
        "linear",
        "quadratic"
      ],
      "labels": {
        "none": "无",
        "linear": "线性",
        "quadratic": "二次"
      },
      "default": "quadratic",
      "recommended": "quadratic",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.decayGradient",
      "step": "1",
      "tab": "空间",
      "label": "衰减幅度 Decay Gradient",
      "path": "foundation.decayGradient",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "%",
      "enum": null,
      "labels": null,
      "default": 75,
      "recommended": 75,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.lightDecay",
        "eq": "linear"
      },
      "condition": {
        "path": "foundation.lightDecay",
        "eq": "linear"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.decayShape",
      "step": "1",
      "tab": "空间",
      "label": "衰减区域形状 Decay Shape",
      "path": "foundation.decayShape",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "rectangle",
        "ellipse"
      ],
      "labels": {
        "rectangle": "矩形",
        "ellipse": "椭圆形"
      },
      "default": "ellipse",
      "recommended": "ellipse",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.lightDecay",
        "eq": "quadratic"
      },
      "condition": {
        "path": "foundation.lightDecay",
        "eq": "quadratic"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.decayShapeSize",
      "step": "1",
      "tab": "空间",
      "label": "衰减区尺寸 Decay Shape Size",
      "path": "foundation.decayShapeSize",
      "widget": "xy",
      "min": 0,
      "max": 1000,
      "stepSize": null,
      "unit": "modelUnit",
      "enum": null,
      "labels": null,
      "default": {
        "x": 200,
        "y": 200
      },
      "recommended": {
        "x": 200,
        "y": 200
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.lightDecay",
        "eq": "quadratic"
      },
      "condition": {
        "path": "foundation.lightDecay",
        "eq": "quadratic"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.decayThreshold",
      "step": "1",
      "tab": "空间",
      "label": "衰减区扩散 Decay Threshold",
      "path": "foundation.decayThreshold",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": 1,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.lightDecay",
        "eq": "quadratic"
      },
      "condition": {
        "path": "foundation.lightDecay",
        "eq": "quadratic"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.nightlightMode",
      "step": "1",
      "tab": "空间",
      "label": "夜间模式 Nightlight Mode",
      "path": "foundation.nightlightMode",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.intensityNightlight.directional",
      "step": "1",
      "tab": "空间",
      "label": "光源强度（夜间）Intensity（Nightlight） · directional",
      "path": "foundation.lightingIntensityNightlight.directional",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 14,
      "recommended": 14,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.intensityNightlight.area",
      "step": "1",
      "tab": "空间",
      "label": "光源强度（夜间）Intensity（Nightlight） · area",
      "path": "foundation.lightingIntensityNightlight.area",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 66,
      "recommended": 66,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.intensityNightlight.environment",
      "step": "1",
      "tab": "空间",
      "label": "光源强度（夜间）Intensity（Nightlight） · environment",
      "path": "foundation.lightingIntensityNightlight.environment",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 21,
      "recommended": 21,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.exposureNightlight.directional",
      "step": "1",
      "tab": "空间",
      "label": "曝光（夜间）Exposure（Nightlight） · directional",
      "path": "foundation.lightingExposureNightlight.directional",
      "widget": "number",
      "min": -10,
      "max": 10,
      "stepSize": null,
      "unit": "EV",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": 0,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.exposureNightlight.area",
      "step": "1",
      "tab": "空间",
      "label": "曝光（夜间）Exposure（Nightlight） · area",
      "path": "foundation.lightingExposureNightlight.area",
      "widget": "number",
      "min": -10,
      "max": 10,
      "stepSize": null,
      "unit": "EV",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": 0,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.exposureNightlight.environment",
      "step": "1",
      "tab": "空间",
      "label": "曝光（夜间）Exposure（Nightlight） · environment",
      "path": "foundation.lightingExposureNightlight.environment",
      "widget": "number",
      "min": -10,
      "max": 10,
      "stepSize": null,
      "unit": "EV",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": 0,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.colorHsvNightlight.directional",
      "step": "1",
      "tab": "空间",
      "label": "色值（夜间）Color（HSV）（Nightlight） · directional",
      "path": "foundation.lightingColorHsvNightlight.directional",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.colorHsvNightlight.area",
      "step": "1",
      "tab": "空间",
      "label": "色值（夜间）Color（HSV）（Nightlight） · area",
      "path": "foundation.lightingColorHsvNightlight.area",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.colorHsvNightlight.environment",
      "step": "1",
      "tab": "空间",
      "label": "色值（夜间）Color（HSV）（Nightlight） · environment",
      "path": "foundation.lightingColorHsvNightlight.environment",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.temperatureNightlight.directional",
      "step": "1",
      "tab": "空间",
      "label": "色温（夜间）Temperature（Nightlight） · directional",
      "path": "foundation.lightingTemperatureNightlight.directional",
      "widget": "number",
      "min": 1000,
      "max": 10000,
      "stepSize": null,
      "unit": "K",
      "enum": null,
      "labels": null,
      "default": 6500,
      "recommended": 6500,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.temperatureNightlight.area",
      "step": "1",
      "tab": "空间",
      "label": "色温（夜间）Temperature（Nightlight） · area",
      "path": "foundation.lightingTemperatureNightlight.area",
      "widget": "number",
      "min": 1000,
      "max": 10000,
      "stepSize": null,
      "unit": "K",
      "enum": null,
      "labels": null,
      "default": 6500,
      "recommended": 6500,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.temperatureNightlight.environment",
      "step": "1",
      "tab": "空间",
      "label": "色温（夜间）Temperature（Nightlight） · environment",
      "path": "foundation.lightingTemperatureNightlight.environment",
      "widget": "number",
      "min": 1000,
      "max": 10000,
      "stepSize": null,
      "unit": "K",
      "enum": null,
      "labels": null,
      "default": 4200,
      "recommended": 4200,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "condition": {
        "path": "foundation.nightlightMode",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.intensity.directional",
      "step": "1",
      "tab": "空间",
      "label": "光源强度 Intensity · directional",
      "path": "foundation.lightingIntensity.directional",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": 1,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 8
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.intensity.area",
      "step": "1",
      "tab": "空间",
      "label": "光源强度 Intensity · area",
      "path": "foundation.lightingIntensity.area",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 5,
      "recommended": 5,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 8
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.intensity.environment",
      "step": "1",
      "tab": "空间",
      "label": "光源强度 Intensity · environment",
      "path": "foundation.lightingIntensity.environment",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 20,
      "recommended": 20,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 16
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.exposure.directional",
      "step": "1",
      "tab": "空间",
      "label": "曝光 Exposure · directional",
      "path": "foundation.lightingExposure.directional",
      "widget": "number",
      "min": -10,
      "max": 10,
      "stepSize": null,
      "unit": "EV",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": 0,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.exposure.area",
      "step": "1",
      "tab": "空间",
      "label": "曝光 Exposure · area",
      "path": "foundation.lightingExposure.area",
      "widget": "number",
      "min": -10,
      "max": 10,
      "stepSize": null,
      "unit": "EV",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": 0,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.exposure.environment",
      "step": "1",
      "tab": "空间",
      "label": "曝光 Exposure · environment",
      "path": "foundation.lightingExposure.environment",
      "widget": "number",
      "min": -10,
      "max": 10,
      "stepSize": null,
      "unit": "EV",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": 0,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.temperature.directional",
      "step": "1",
      "tab": "空间",
      "label": "色温 Temperature · directional",
      "path": "foundation.lightingTemperature.directional",
      "widget": "number",
      "min": 1000,
      "max": 10000,
      "stepSize": null,
      "unit": "K",
      "enum": null,
      "labels": null,
      "default": 6500,
      "recommended": 6500,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.temperature.area",
      "step": "1",
      "tab": "空间",
      "label": "色温 Temperature · area",
      "path": "foundation.lightingTemperature.area",
      "widget": "number",
      "min": 1000,
      "max": 10000,
      "stepSize": null,
      "unit": "K",
      "enum": null,
      "labels": null,
      "default": 6500,
      "recommended": 6500,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.temperature.environment",
      "step": "1",
      "tab": "空间",
      "label": "色温 Temperature · environment",
      "path": "foundation.lightingTemperature.environment",
      "widget": "number",
      "min": 1000,
      "max": 10000,
      "stepSize": null,
      "unit": "K",
      "enum": null,
      "labels": null,
      "default": 4200,
      "recommended": 4200,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.colorHsv.directional",
      "step": "1",
      "tab": "空间",
      "label": "色值 Color（HSV） · directional",
      "path": "foundation.lightingColorHsv.directional",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.colorHsv.area",
      "step": "1",
      "tab": "空间",
      "label": "色值 Color（HSV） · area",
      "path": "foundation.lightingColorHsv.area",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.colorHsv.environment",
      "step": "1",
      "tab": "空间",
      "label": "色值 Color（HSV） · environment",
      "path": "foundation.lightingColorHsv.environment",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.recipeLock",
      "step": "1",
      "tab": "空间",
      "label": "配方锁定",
      "path": "ui.recipeLock",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "room",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.background",
      "step": "1",
      "tab": "空间",
      "label": "视口背景色",
      "path": "foundation.background",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "#191919",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "#000000"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.environmentIntensity",
      "step": "1",
      "tab": "空间",
      "label": "环境贴图强度",
      "path": "foundation.environmentIntensity",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 0.2,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0.028
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.envMapIntensity",
      "step": "1",
      "tab": "空间",
      "label": "材质环境反射强度",
      "path": "foundation.envMapIntensity",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 0.2,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0.06
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.scaleLodMode",
      "step": "1",
      "tab": "空间",
      "label": "比例尺 LOD 模式",
      "path": "foundation.scaleLodMode",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "step",
        "auto",
        "manual"
      ],
      "labels": null,
      "default": "auto",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "step"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.scaleAdaptGrid",
      "step": "1",
      "tab": "空间",
      "label": "随比例尺改网格",
      "path": "foundation.scaleAdaptGrid",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": false
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.motionBezier",
      "step": "1",
      "tab": "空间",
      "label": "运镜贝塞尔",
      "path": "foundation.motionBezier",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.2,0,0.1,1",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.2,0,0.1,1"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.near",
      "step": "1",
      "tab": "空间",
      "label": "近裁剪面",
      "path": "foundation.near",
      "widget": "number",
      "min": 0.001,
      "max": 10,
      "stepSize": null,
      "unit": "modelUnit",
      "enum": null,
      "labels": null,
      "default": 0.1,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0.01
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.viewport.gridSubdivisions",
      "step": "1",
      "tab": "空间",
      "label": "网格细分",
      "path": "foundation.gridSubdivisions",
      "widget": "number",
      "min": 1,
      "max": 20,
      "stepSize": null,
      "unit": "count",
      "enum": null,
      "labels": null,
      "default": 10,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 1
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.lightContrast",
      "step": "1",
      "tab": "空间",
      "label": "灯光反差",
      "path": "foundation.lightContrast",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "low",
        "medium",
        "high"
      ],
      "labels": null,
      "default": "medium",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "low"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型光源",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.material.reflectiveMetalness",
      "step": "1",
      "tab": "空间",
      "label": "反射材质金属度",
      "path": "foundation.reflective.metalness",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 0.2,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0.08
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.material.reflectiveRoughness",
      "step": "1",
      "tab": "空间",
      "label": "反射材质粗糙度",
      "path": "foundation.reflective.roughness",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 0.5,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0.78
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.material.transparentIor",
      "step": "1",
      "tab": "空间",
      "label": "透明材质折射率",
      "path": "foundation.transparent.ior",
      "widget": "number",
      "min": 1,
      "max": 3,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 1.5,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 2
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.material.transparentRoughness",
      "step": "1",
      "tab": "空间",
      "label": "透明材质粗糙度",
      "path": "foundation.transparent.roughness",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 0.5,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0.72
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.qualityPreset",
      "step": "1",
      "tab": "空间",
      "label": "渲染品质",
      "path": "render.qualityPreset",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "fluent",
        "balanced",
        "refined"
      ],
      "labels": {
        "fluent": "流畅",
        "balanced": "平衡",
        "refined": "精致"
      },
      "default": "fluent",
      "recommended": "fluent",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 10
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.lod",
      "step": "1",
      "tab": "空间",
      "label": "模型分级 Model LOD",
      "path": "model.lod",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "low",
        "mid",
        "high"
      ],
      "labels": null,
      "default": "mid",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.structureDetailMode",
      "step": "1",
      "tab": "空间",
      "label": "结构详略模式 Structure Detail Mode",
      "path": "ui.structureDetail.mode",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "cluster",
        "unit"
      ],
      "labels": null,
      "default": "cluster",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.lodTier",
      "step": "1",
      "tab": "空间",
      "label": "穿层 LOD 档 LOD Tier",
      "path": "ui.structureDetail.lodTier",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "shell",
        "mid",
        "detail"
      ],
      "labels": null,
      "default": "shell",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.hideDoorInUnit",
      "step": "1",
      "tab": "空间",
      "label": "单机柜展示时隐藏柜门",
      "path": "ui.structureDetail.hideDoorInUnit",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.modelNumber",
      "step": "1",
      "tab": "空间",
      "label": "空间内的模型数量 Model Number",
      "path": "render.modelNumber.limit",
      "widget": "number",
      "min": 500,
      "max": null,
      "stepSize": null,
      "unit": "count",
      "enum": null,
      "labels": null,
      "default": "auto",
      "recommended": {
        "noGpu": 2000,
        "gpu": "max"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.grayboxScenario",
      "step": "1",
      "tab": "空间",
      "label": "白模使用场景 Graybox Scenario（白模 On 时）",
      "path": "render.grayboxModel.scenarios",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "focus",
        "unfocused"
      ],
      "labels": {
        "focus": "聚焦",
        "unfocused": "非聚焦"
      },
      "default": [
        "unfocused"
      ],
      "recommended": [
        "unfocused"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.dynamicModelDetail",
      "step": "1",
      "tab": "空间",
      "label": "动态渲染模型细节 Dynamic Rendering of Model Detail",
      "path": "render.dynamicModelDetail.enabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.dynamicModelDetail.focalLod",
      "step": "1",
      "tab": "空间",
      "label": "模型细节层级 Level of Detail（Dynamic On 时）",
      "path": "render.dynamicModelDetail.focalBands",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "high",
        "mid",
        "low"
      ],
      "labels": null,
      "default": {
        "near": {
          "focusLod": "high",
          "unfocusedLod": "high"
        },
        "mid": {
          "focusLod": "mid",
          "unfocusedLod": "mid"
        },
        "far": {
          "focusLod": "low",
          "unfocusedLod": "low"
        }
      },
      "recommended": {
        "near": "high",
        "mid": "mid",
        "far": "low"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.render.dataLayer",
      "step": "1",
      "tab": "空间",
      "label": "模型内容数据集 Data Layer",
      "path": "render.dataLayer",
      "widget": "dual",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "minLevelIndex": 0,
        "maxLevelIndex": 43
      },
      "recommended": "按实际需求；默认全部开放 L0-L43",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ],
      "paths": {
        "minLevelIndex": "render.dataLayer.minLevelIndex",
        "maxLevelIndex": "render.dataLayer.maxLevelIndex"
      }
    },
    {
      "id": "space.render.grayboxModel",
      "step": "1",
      "tab": "空间",
      "label": "白模模式 Graybox Model",
      "path": "render.grayboxModel.enabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "渲染机制",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.occlusion.highlightEdge",
      "step": "1",
      "tab": "空间",
      "label": "选中 X-ray 描边",
      "path": "interaction.focus.showOutline",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "视觉遮挡",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.blockage.method",
      "step": "1",
      "tab": "空间",
      "label": "遮挡策略 Blockage Method",
      "path": "render.occlusion.strategy",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "physical",
        "perspective"
      ],
      "labels": {
        "physical": "物理遮挡",
        "perspective": "透视"
      },
      "default": "physical",
      "recommended": {
        "mapLike": "physical",
        "monitorToolLike": "perspective"
      },
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "perspective"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "视觉遮挡",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.blockage.transparency",
      "step": "1",
      "tab": "空间",
      "label": "遮挡物透明度 Blockage Transparency",
      "path": "render.occlusion.blockageTransparency",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": 30,
      "recommended": 30,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "render.occlusion.strategy",
        "eq": "perspective"
      },
      "condition": {
        "path": "render.occlusion.strategy",
        "eq": "perspective"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "视觉遮挡",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.blockage.ssao",
      "step": "1",
      "tab": "空间",
      "label": "环境光遮蔽 Ambient Occlusion",
      "path": "render.occlusion.ssaoEnabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "render.occlusion.strategy",
        "eq": "physical"
      },
      "condition": {
        "path": "render.occlusion.strategy",
        "eq": "physical"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "视觉遮挡",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.blockage.ssaoRadius",
      "step": "1",
      "tab": "空间",
      "label": "遮蔽半径 AO Radius",
      "path": "render.occlusion.ssaoRadius",
      "widget": "number",
      "min": 1,
      "max": 32,
      "stepSize": null,
      "unit": "px",
      "enum": null,
      "labels": null,
      "default": 8,
      "recommended": 8,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "render.occlusion.strategy",
        "eq": "physical"
      },
      "condition": {
        "path": "render.occlusion.strategy",
        "eq": "physical"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "视觉遮挡",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.blockage.ssaoIntensity",
      "step": "1",
      "tab": "空间",
      "label": "遮蔽强度 AO Intensity",
      "path": "render.occlusion.ssaoIntensity",
      "widget": "number",
      "min": 0,
      "max": 200,
      "stepSize": null,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": 100,
      "recommended": 100,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "render.occlusion.strategy",
        "eq": "physical"
      },
      "condition": {
        "path": "render.occlusion.strategy",
        "eq": "physical"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "视觉遮挡",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.model.collision",
      "step": "1",
      "tab": "空间",
      "label": "碰撞 Collision",
      "path": "model.collision.enabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型碰撞",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.model.collisionModelTypes",
      "step": "1",
      "tab": "空间",
      "label": "碰撞类型",
      "path": "model.collision.modelTypes",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "type1",
        "type2",
        "type3",
        "type4"
      ],
      "labels": {
        "type1": "类型1",
        "type2": "类型2",
        "type3": "类型3",
        "type4": "类型4"
      },
      "default": [
        "type1",
        "type2",
        "type3",
        "type4"
      ],
      "recommended": [
        "type1",
        "type2",
        "type3",
        "type4"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型碰撞",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.model.collisionVolume",
      "step": "1",
      "tab": "空间",
      "label": "碰撞体积 Collision Volume",
      "path": "model.collision.volumePercent",
      "widget": "number",
      "min": 100,
      "max": 200,
      "stepSize": null,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": 100,
      "recommended": 100,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "模型碰撞",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.blockage.highlightSilhouette",
      "step": "1",
      "tab": "空间",
      "label": "高亮被遮挡区域边缘 Highlight Blockage Silhouette",
      "path": "render.occlusion.highlightBlockageSilhouette",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "render.occlusion.strategy",
        "eq": "perspective"
      },
      "condition": {
        "path": "render.occlusion.strategy",
        "eq": "perspective"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "视觉遮挡",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "space.lighting.environmentHour",
      "step": "1",
      "tab": "空间",
      "label": "环境时间",
      "path": "foundation.environmentHour",
      "widget": "number",
      "min": 0,
      "max": 24,
      "stepSize": null,
      "unit": "h",
      "enum": null,
      "labels": null,
      "default": 12,
      "recommended": 12,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "主题",
        "order": 100
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "import.layerMeta.matRole",
      "step": "2",
      "tab": "导入",
      "label": "材质角色",
      "path": "layerMeta.matRole",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "导入对象",
        "order": 200
      },
      "dependsOn": [],
      "affects": [
        "assets"
      ]
    },
    {
      "id": "import.layerMeta.matClass",
      "step": "2",
      "tab": "导入",
      "label": "物类",
      "path": "layerMeta.matClass",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "导入对象",
        "order": 200
      },
      "dependsOn": [],
      "affects": [
        "assets"
      ]
    },
    {
      "id": "import.layerMeta.selectable",
      "step": "2",
      "tab": "导入",
      "label": "可点选",
      "path": "layerMeta.selectable",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "导入对象",
        "order": 200
      },
      "dependsOn": [],
      "affects": [
        "assets"
      ]
    },
    {
      "id": "import.preserveSource",
      "step": "2",
      "tab": "导入",
      "label": "1:1 保留源",
      "path": "userData.preserveSource",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "rules",
        "group": "导入对象",
        "order": 200
      },
      "dependsOn": [],
      "affects": [
        "assets"
      ]
    },
    {
      "id": "control.input.types",
      "step": "3",
      "tab": "控制",
      "label": "交互输入 Input Type",
      "path": "interaction.input.types",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "mouse",
        "keyboard",
        "touch"
      ],
      "labels": {
        "mouse": "鼠标",
        "keyboard": "键盘",
        "touch": "触摸屏"
      },
      "default": [
        "mouse",
        "keyboard"
      ],
      "recommended": [
        "mouse",
        "keyboard"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.select.binding",
      "step": "3",
      "tab": "控制",
      "label": "选中 Select",
      "path": "interaction.selectBinding",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "mouse": null,
        "left": "click",
        "middle": "none",
        "right": "none",
        "keyboard": "Ctrl+A",
        "touch": "tap"
      },
      "recommended": {
        "mouse": null,
        "left": "click",
        "keyboard": "Ctrl+A",
        "touch": "tap"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.deselect.binding",
      "step": "3",
      "tab": "控制",
      "label": "取消选中 Deselect",
      "path": "interaction.deselectBinding",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "mouse": null,
        "left": "none",
        "middle": "none",
        "right": "none",
        "keyboard": "Esc"
      },
      "recommended": {
        "mouse": null,
        "left": "none",
        "middle": "none",
        "right": "none",
        "keyboard": "Esc"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.input.hover.enabled",
      "step": "3",
      "tab": "控制",
      "label": "允许悬浮 Allow Hover",
      "path": "interaction.hover.enabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.pan.binding",
      "step": "3",
      "tab": "控制",
      "label": "拖动 Pan",
      "path": "interaction.panBinding",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "mouse": null,
        "left": "none",
        "middle": "none",
        "right": "longpress",
        "keyboard": "无"
      },
      "recommended": {
        "mouse": null,
        "right": "longpress",
        "keyboard": "无"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.orbit.binding",
      "step": "3",
      "tab": "控制",
      "label": "旋转 Orbit",
      "path": "interaction.orbitBinding",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "mouse": null,
        "left": "longpress",
        "middle": "none",
        "right": "none",
        "keyboard": "上下左右"
      },
      "recommended": {
        "mouse": null,
        "left": "longpress",
        "keyboard": "上下左右"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.zoom.binding",
      "step": "3",
      "tab": "控制",
      "label": "缩放 Zoom",
      "path": "interaction.zoomBinding",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "mouse": null,
        "left": "none",
        "middle": "click",
        "right": "none",
        "keyboard": "放大+键，缩小-键"
      },
      "recommended": {
        "mouse": null,
        "middle": "click",
        "keyboard": "放大+键，缩小-键"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.restore.binding",
      "step": "3",
      "tab": "控制",
      "label": "复位 Restore",
      "path": "interaction.restoreBinding",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "mouse": null,
        "left": "none",
        "middle": "none",
        "right": "none",
        "keyboard": "Space"
      },
      "recommended": {
        "mouse": null,
        "left": "none",
        "middle": "none",
        "right": "none",
        "keyboard": "Space"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "交互输入",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.interaction.origin",
      "step": "3",
      "tab": "控制",
      "label": "交互原点 Interaction Origin",
      "path": "interaction.interactionOrigin",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "object",
        "mouse"
      ],
      "labels": {
        "object": "对象",
        "mouse": "鼠标"
      },
      "default": [
        "object"
      ],
      "recommended": [
        "object"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.orientation.tokenType",
      "step": "3",
      "tab": "控制",
      "label": "Token类型 Token Type",
      "path": "interaction.orientationToken.types",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "none",
        "axes",
        "compass",
        "heading"
      ],
      "labels": {
        "none": "无",
        "axes": "3D坐标",
        "compass": "指北针",
        "heading": "航向箭头"
      },
      "default": "axes",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "算力中心": [
          "axes"
        ]
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "方位Token类型",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "asArray": true
    },
    {
      "id": "control.orientation.tokenOrigin",
      "step": "3",
      "tab": "控制",
      "label": "Token原点 Token Origin",
      "path": "interaction.orientationToken.origin",
      "widget": "xyz",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "x": 0,
        "y": 0,
        "z": 0
      },
      "recommended": {
        "x": 0,
        "y": 0,
        "z": 0
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "方位Token原点",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.orientation.orthographicCamera",
      "step": "3",
      "tab": "控制",
      "label": "Token触发正交机位 Orthographic Camera",
      "path": "interaction.orientationToken.orthographicCamera",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.orientation.orthographicCameraType",
      "step": "3",
      "tab": "控制",
      "label": "Token触发正交机位 Orthographic Camera Type",
      "path": "interaction.orientationToken.orthoViews",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "front",
        "back",
        "left",
        "right",
        "top",
        "bottom"
      ],
      "labels": {
        "front": "正视图",
        "back": "后视图",
        "left": "左视图",
        "right": "右视图",
        "top": "顶视图",
        "bottom": "底视图"
      },
      "default": [
        "front",
        "left",
        "right",
        "top"
      ],
      "recommended": [
        "front",
        "left",
        "right",
        "top"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.orientation.orthoPositions.front.focalLengthMm",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · front.focalLengthMm",
      "path": "interaction.orientationToken.orthoPositions.front.focalLengthMm",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.front.polarDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · front.polarDeg",
      "path": "interaction.orientationToken.orthoPositions.front.polarDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.front.azimuthDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · front.azimuthDeg",
      "path": "interaction.orientationToken.orthoPositions.front.azimuthDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.left.focalLengthMm",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · left.focalLengthMm",
      "path": "interaction.orientationToken.orthoPositions.left.focalLengthMm",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.left.polarDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · left.polarDeg",
      "path": "interaction.orientationToken.orthoPositions.left.polarDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.left.azimuthDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · left.azimuthDeg",
      "path": "interaction.orientationToken.orthoPositions.left.azimuthDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.right.focalLengthMm",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · right.focalLengthMm",
      "path": "interaction.orientationToken.orthoPositions.right.focalLengthMm",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.right.polarDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · right.polarDeg",
      "path": "interaction.orientationToken.orthoPositions.right.polarDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.right.azimuthDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · right.azimuthDeg",
      "path": "interaction.orientationToken.orthoPositions.right.azimuthDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.top.focalLengthMm",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · top.focalLengthMm",
      "path": "interaction.orientationToken.orthoPositions.top.focalLengthMm",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.top.polarDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · top.polarDeg",
      "path": "interaction.orientationToken.orthoPositions.top.polarDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.orientation.orthoPositions.top.azimuthDeg",
      "step": "3",
      "tab": "控制",
      "label": "正交机位位置 Ortho Camera Positions · top.azimuthDeg",
      "path": "interaction.orientationToken.orthoPositions.top.azimuthDeg",
      "widget": "number",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.orientationToken.orthographicCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "token",
        "group": "快捷机位",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.roam.firstPersonView",
      "step": "3",
      "tab": "控制",
      "label": "漫游模式 First Person View",
      "path": "interaction.firstPersonView.enabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "roam",
        "group": "场景漫游",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.roam.eyeLevelAdjustment",
      "step": "3",
      "tab": "控制",
      "label": "真实视野调整 Eye Level Adjustment",
      "path": "interaction.firstPersonView.eyeLevelAdjustment",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "condition": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "roam",
        "group": "场景漫游",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.roam.eyeLevelValue",
      "step": "3",
      "tab": "控制",
      "label": "视野高度 Eye Level Value",
      "path": "interaction.firstPersonView.eyeLevelM",
      "widget": "number",
      "min": 1.5,
      "max": 2,
      "stepSize": 0.01,
      "unit": "m",
      "enum": null,
      "labels": null,
      "default": 1.7,
      "recommended": 1.7,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "condition": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "roam",
        "group": "场景漫游",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.roam.fieldOfViewHuman",
      "step": "3",
      "tab": "控制",
      "label": "视野焦距 Field of View-Human",
      "path": "interaction.firstPersonView.humanFocalLengthMm",
      "widget": "number",
      "min": 36,
      "max": 50,
      "stepSize": 1,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": 36,
      "recommended": 36,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "condition": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "roam",
        "group": "场景漫游",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.roam.autoRoam",
      "step": "3",
      "tab": "控制",
      "label": "自动漫游 Auto Roam",
      "path": "interaction.firstPersonView.autoRoam",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "condition": {
        "path": "interaction.firstPersonView.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "roam",
        "group": "场景漫游",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.roam.orbitRate",
      "step": "3",
      "tab": "控制",
      "label": "绕轨速率 Orbit Rate",
      "path": "interaction.firstPersonView.orbitRate",
      "widget": "number",
      "min": 0.1,
      "max": 10,
      "stepSize": 0.1,
      "unit": "x",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": 1,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.firstPersonView.autoRoam",
        "eq": true
      },
      "condition": {
        "path": "interaction.firstPersonView.autoRoam",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "roam",
        "group": "场景漫游",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.camera.verticalFieldRange",
      "step": "3",
      "tab": "控制",
      "label": "垂直视角范围 Vertical Field Range",
      "path": "orbit",
      "widget": "dual",
      "min": -90,
      "max": 90,
      "stepSize": 0.5,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "min": 0,
        "max": 90
      },
      "recommended": {
        "min": 0,
        "max": 90
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "paths": {
        "min": "orbit.verticalFieldRangeMinDeg",
        "max": "orbit.verticalFieldRangeMaxDeg"
      }
    },
    {
      "id": "control.camera.horizontalFieldRange",
      "step": "3",
      "tab": "控制",
      "label": "水平视角范围 Horizontal Field Range",
      "path": "orbit",
      "widget": "dual",
      "min": -180,
      "max": 180,
      "stepSize": 0.5,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "min": -180,
        "max": 180
      },
      "recommended": {
        "min": -180,
        "max": 180
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "paths": {
        "min": "orbit.horizontalFieldRangeMinDeg",
        "max": "orbit.horizontalFieldRangeMaxDeg"
      }
    },
    {
      "id": "control.camera.zoomRangeMode",
      "step": "3",
      "tab": "控制",
      "label": "缩放范围模式 Zoom Range Mode",
      "path": "orbit.zoomRangeModes",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "multiplier",
        "contentDataset"
      ],
      "labels": {
        "multiplier": "倍数",
        "contentDataset": "内容数据集"
      },
      "default": [
        "contentDataset"
      ],
      "recommended": [
        "contentDataset"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.camera.zoomRange",
      "step": "3",
      "tab": "控制",
      "label": "缩放范围 Zoom Range",
      "path": "orbit",
      "widget": "dual",
      "min": 0.1,
      "max": 5000,
      "stepSize": 0.1,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "min": 0.1,
        "max": 1000
      },
      "recommended": {
        "min": 0.1,
        "max": 1000
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "orbit.zoomRangeModes",
        "includes": "multiplier"
      },
      "condition": {
        "path": "orbit.zoomRangeModes",
        "includes": "multiplier"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "paths": {
        "min": "orbit.minDistance",
        "max": "orbit.maxDistance"
      }
    },
    {
      "id": "control.camera.dataLayerRange",
      "step": "3",
      "tab": "控制",
      "label": "数据集范围 Data Layer Range",
      "path": "render.dataLayer",
      "widget": "dual",
      "min": 0,
      "max": 43,
      "stepSize": 1,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": {
        "min": 0,
        "max": 43
      },
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "算力中心": {
          "min": 10,
          "max": 27
        }
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "orbit.zoomRangeModes",
        "includes": "contentDataset"
      },
      "condition": {
        "path": "orbit.zoomRangeModes",
        "includes": "contentDataset"
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "paths": {
        "min": "render.dataLayer.minLevelIndex",
        "max": "render.dataLayer.maxLevelIndex"
      }
    },
    {
      "id": "control.sensitivity.panSpeed",
      "step": "3",
      "tab": "控制",
      "label": "拖动速度 Pan Speed",
      "path": "orbit.panSpeed",
      "widget": "number",
      "min": 0.1,
      "max": 10,
      "stepSize": 0.05,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": 1,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.sensitivity.rotateSpeed",
      "step": "3",
      "tab": "控制",
      "label": "旋转速度 Orbit Speed",
      "path": "orbit.rotateSpeed",
      "widget": "number",
      "min": 0.1,
      "max": 10,
      "stepSize": 0.05,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": 1,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.sensitivity.zoomSpeed",
      "step": "3",
      "tab": "控制",
      "label": "缩放步长 Zoom Step",
      "path": "orbit.zoomSpeed",
      "widget": "number",
      "min": 0.1,
      "max": 10,
      "stepSize": 0.05,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": 1,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.zoom.dynamicDataLayer",
      "step": "3",
      "tab": "控制",
      "label": "缩放触发模型内容数据集切换 Dynamic Data Layer",
      "path": "interaction.adaptive.dynamicDataLayerOnZoom",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.sensitivity.dampingFactor",
      "step": "3",
      "tab": "控制",
      "label": "阻尼 Damping",
      "path": "orbit.dampingFactor",
      "widget": "number",
      "min": 0.1,
      "max": 10,
      "stepSize": 0.05,
      "unit": "ratio",
      "enum": null,
      "labels": null,
      "default": 0.2,
      "recommended": 0.2,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0.1
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "相机交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.keepFocusOnOrbit",
      "step": "3",
      "tab": "控制",
      "label": "旋转保持聚焦",
      "path": "interaction.focus.keepFocusOnOrbit",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.duration",
      "step": "3",
      "tab": "控制",
      "label": "选中运镜时长 ms",
      "path": "select.duration",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "600",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "600"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.angle",
      "step": "3",
      "tab": "控制",
      "label": "选中机位仰角",
      "path": "select.angle",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "45",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "60"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.focus",
      "step": "3",
      "tab": "控制",
      "label": "选中焦距 mm",
      "path": "select.focus",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "50",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "120"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.origin",
      "step": "3",
      "tab": "控制",
      "label": "选中机位原点表达式",
      "path": "select.origin",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0,0,0",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0,0,0.5*(object)"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.motionCurve",
      "step": "3",
      "tab": "控制",
      "label": "选中运镜曲线",
      "path": "select.motionCurve",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.2,0,0.1,1",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.2,0,0.1,1"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.selectOpacity",
      "step": "3",
      "tab": "控制",
      "label": "选中对象不透明度",
      "path": "select.selectOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "1.0",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "1.0"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.otherOpacity",
      "step": "3",
      "tab": "控制",
      "label": "选中时非聚焦不透明度",
      "path": "select.otherOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.3",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.4"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.hideOtherTag",
      "step": "3",
      "tab": "控制",
      "label": "选中时隐藏其他标签",
      "path": "select.hideOtherTag",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": false
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.otherTagOpacity",
      "step": "3",
      "tab": "控制",
      "label": "选中时其他标签不透明度",
      "path": "select.otherTagOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.6",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.6"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.focusView",
      "step": "3",
      "tab": "控制",
      "label": "聚焦画面占比",
      "path": "selectFocus.focusView",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "50",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "67"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.focusAngle",
      "step": "3",
      "tab": "控制",
      "label": "聚焦俯仰角",
      "path": "selectFocus.focusAngle",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "15",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "15"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.duration",
      "step": "3",
      "tab": "控制",
      "label": "聚焦运镜时长 ms",
      "path": "selectFocus.duration",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "600",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "750"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.motionCurve",
      "step": "3",
      "tab": "控制",
      "label": "聚焦运镜曲线",
      "path": "selectFocus.motionCurve",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.2,0,0.1,1",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.2,0,0.1,1"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.hideOtherMesh",
      "step": "3",
      "tab": "控制",
      "label": "聚焦时隐藏其他网格",
      "path": "selectFocus.hideOtherMesh",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": true
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.relocateTarget",
      "step": "3",
      "tab": "控制",
      "label": "聚焦时重定位轨道目标",
      "path": "selectFocus.relocateTarget",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": true
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.focusOpacity",
      "step": "3",
      "tab": "控制",
      "label": "聚焦对象不透明度",
      "path": "selectFocus.focusOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "1.0",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "1.0"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.otherOpacity",
      "step": "3",
      "tab": "控制",
      "label": "聚焦时非聚焦不透明度",
      "path": "selectFocus.otherOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.3",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.4"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.hideOtherTag",
      "step": "3",
      "tab": "控制",
      "label": "聚焦时隐藏其他标签",
      "path": "selectFocus.hideOtherTag",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": false
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.selectFocus.otherTagOpacity",
      "step": "3",
      "tab": "控制",
      "label": "聚焦时其他标签不透明度",
      "path": "selectFocus.otherTagOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.6",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.6"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.focusThreshold",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换焦距阈值",
      "path": "thresholdTranisition.foucsThreshold",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "80",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "114"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.focusStep",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换步进",
      "path": "thresholdTranisition.foucsStep",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "10",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "10"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.duration",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换时长 ms",
      "path": "thresholdTranisition.duration",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "200",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "150"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.focusDelay",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换延迟 ms",
      "path": "thresholdTranisition.foucsDelay",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "20"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.motionBlur",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换运动模糊",
      "path": "thresholdTranisition.motionBlur",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": true
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.focusOpacity",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换聚焦不透明度",
      "path": "thresholdTranisition.focusOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "1.0",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "1.0"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.otherOpacity",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换非聚焦不透明度",
      "path": "thresholdTranisition.otherOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.3",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.4"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.hideOtherTag",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换隐藏其他标签",
      "path": "thresholdTranisition.hideOtherTag",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": false
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.threshold.otherTagOpacity",
      "step": "3",
      "tab": "控制",
      "label": "阈值切换其他标签不透明度",
      "path": "thresholdTranisition.OtherTagOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.6",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.6"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.cameraMove",
      "step": "3",
      "tab": "控制",
      "label": "选中触发相机移动 Camera Reposition After Select",
      "path": "interaction.adaptive.selectCamera",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.cameraPosition.focalLengthMm",
      "step": "3",
      "tab": "控制",
      "label": "选中后相机位置 Camera Position - Select · focalLengthMm",
      "path": "interaction.adaptive.selectReposition.focalLengthMm",
      "widget": "number",
      "min": 18,
      "max": 300,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.selectCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.selectCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": true,
      "derivedFrom": "space.camera.focalLength"
    },
    {
      "id": "control.adaptive.select.cameraPosition.polarDeg",
      "step": "3",
      "tab": "控制",
      "label": "选中后相机位置 Camera Position - Select · polarDeg",
      "path": "interaction.adaptive.selectReposition.polarDeg",
      "widget": "number",
      "min": -90,
      "max": 90,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.selectCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.selectCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": true,
      "derivedFrom": "space.camera.verticalViewAngle"
    },
    {
      "id": "control.adaptive.select.cameraPosition.azimuthDeg",
      "step": "3",
      "tab": "控制",
      "label": "选中后相机位置 Camera Position - Select · azimuthDeg",
      "path": "interaction.adaptive.selectReposition.azimuthDeg",
      "widget": "number",
      "min": -180,
      "max": 180,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.selectCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.selectCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": true,
      "derivedFrom": "space.camera.horizontalViewAngle"
    },
    {
      "id": "control.adaptive.select.transparencyChange",
      "step": "3",
      "tab": "控制",
      "label": "选中触发非聚焦物体透明度降低 Transparency Change - Select",
      "path": "interaction.adaptive.selectReposition.dimOthers",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": true
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.transparencyValue",
      "step": "3",
      "tab": "控制",
      "label": "选中非聚焦物体透明度 Transparency Value - Select",
      "path": "interaction.adaptive.selectReposition.othersOpacityPct",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": 30,
      "recommended": 30,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 40
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.selectReposition.dimOthers",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.selectReposition.dimOthers",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.highlightObject",
      "step": "3",
      "tab": "控制",
      "label": "选中聚焦物体描边 Highlight Object - Select",
      "path": "interaction.adaptive.selectReposition.showOutline",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": true
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.select.highlightEdge.outlineColor",
      "step": "3",
      "tab": "控制",
      "label": "边缘高亮颜色",
      "path": "interaction.adaptive.selectReposition.outlineColor",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.selectReposition.showOutline",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.selectReposition.showOutline",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.adaptive.select.highlightEdge.outlineWidth",
      "step": "3",
      "tab": "控制",
      "label": "高亮粗细",
      "path": "interaction.adaptive.selectReposition.outlineWidth",
      "widget": "number",
      "min": 0.1,
      "max": 100,
      "stepSize": null,
      "unit": "px",
      "enum": null,
      "labels": null,
      "default": 2,
      "recommended": 2,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.selectReposition.showOutline",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.selectReposition.showOutline",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.adaptive.hover.cameraMove",
      "step": "3",
      "tab": "控制",
      "label": "悬浮触发相机移动 Camera Reposition After Hover",
      "path": "interaction.adaptive.hoverCamera",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.hover.cameraPosition.focalLengthMm",
      "step": "3",
      "tab": "控制",
      "label": "悬浮后相机位置 Camera Position - Hover · focalLengthMm",
      "path": "interaction.adaptive.hoverReposition.focalLengthMm",
      "widget": "number",
      "min": 18,
      "max": 300,
      "stepSize": null,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.hoverCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.hoverCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": true,
      "derivedFrom": "space.camera.focalLength"
    },
    {
      "id": "control.adaptive.hover.cameraPosition.polarDeg",
      "step": "3",
      "tab": "控制",
      "label": "悬浮后相机位置 Camera Position - Hover · polarDeg",
      "path": "interaction.adaptive.hoverReposition.polarDeg",
      "widget": "number",
      "min": -90,
      "max": 90,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.hoverCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.hoverCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": true,
      "derivedFrom": "space.camera.verticalViewAngle"
    },
    {
      "id": "control.adaptive.hover.cameraPosition.azimuthDeg",
      "step": "3",
      "tab": "控制",
      "label": "悬浮后相机位置 Camera Position - Hover · azimuthDeg",
      "path": "interaction.adaptive.hoverReposition.azimuthDeg",
      "widget": "number",
      "min": -180,
      "max": 180,
      "stepSize": null,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.hoverCamera",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.hoverCamera",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": true,
      "derivedFrom": "space.camera.horizontalViewAngle"
    },
    {
      "id": "control.adaptive.hover.transparencyChange",
      "step": "3",
      "tab": "控制",
      "label": "悬浮触发非聚焦物体透明度降低 Transparency Change - Hover",
      "path": "interaction.adaptive.hoverReposition.dimOthers",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.hover.transparencyValue",
      "step": "3",
      "tab": "控制",
      "label": "悬浮非聚焦物体透明度 Transparency Value - Hover",
      "path": "interaction.adaptive.hoverReposition.othersOpacityPct",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": null,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": 30,
      "recommended": 30,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 40
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.hoverReposition.dimOthers",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.hoverReposition.dimOthers",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.hover.highlightObject",
      "step": "3",
      "tab": "控制",
      "label": "悬浮聚焦物体描边 Highlight Object - Hover",
      "path": "interaction.adaptive.hoverReposition.showOutline",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": false,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ]
    },
    {
      "id": "control.adaptive.hover.highlightEdge.outlineColor",
      "step": "3",
      "tab": "控制",
      "label": "边缘高亮颜色",
      "path": "interaction.adaptive.hoverReposition.outlineColor",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0-0-100",
      "recommended": "0-0-100",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.hoverReposition.showOutline",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.hoverReposition.showOutline",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "control.adaptive.hover.highlightEdge.outlineWidth",
      "step": "3",
      "tab": "控制",
      "label": "高亮粗细",
      "path": "interaction.adaptive.hoverReposition.outlineWidth",
      "widget": "number",
      "min": 0.1,
      "max": 100,
      "stepSize": null,
      "unit": "px",
      "enum": null,
      "labels": null,
      "default": 2,
      "recommended": 2,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "interaction.adaptive.hoverReposition.showOutline",
        "eq": true
      },
      "condition": {
        "path": "interaction.adaptive.hoverReposition.showOutline",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "scene",
        "group": "连带交互",
        "order": 300
      },
      "dependsOn": [],
      "affects": [
        "interaction"
      ],
      "inherit": false,
      "derivedFrom": null
    },
    {
      "id": "info.physical.explosiveView",
      "step": "4",
      "tab": "业务",
      "label": "模型爆炸视图 Explosive View",
      "path": "ui.exploded",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "爆炸图视图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "visualization"
      ]
    },
    {
      "id": "info.physical.explodeGap",
      "step": "4",
      "tab": "业务",
      "label": "模型间的距离 Model Gap in Explosive View",
      "path": "ui.explodeGap",
      "widget": "number",
      "min": 0.1,
      "max": 100,
      "stepSize": 0.1,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": 8
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": {
        "path": "ui.exploded",
        "eq": true
      },
      "condition": {
        "path": "ui.exploded",
        "eq": true
      },
      "fieldRole": "domainOnly",
      "panel": {
        "section": "physical",
        "group": "模型间的距离",
        "order": 400
      },
      "dependsOn": [
        "ui.exploded"
      ],
      "affects": [
        "visualization"
      ]
    },
    {
      "id": "info.physical.assembleGap",
      "step": "4",
      "tab": "业务",
      "label": "收起态层间距 Assemble Gap",
      "path": "ui.assembleGap",
      "widget": "number",
      "min": 0,
      "max": 100,
      "stepSize": 0.1,
      "unit": "mm",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 0
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionCutMode",
      "step": "4",
      "tab": "业务",
      "label": "切口模式 Cut Mode",
      "path": "ui.sectioning.cutMode",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "real",
        "virtual"
      ],
      "labels": {
        "real": "真实切口",
        "virtual": "虚拟切口"
      },
      "default": "real",
      "recommended": "real",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionView",
      "step": "4",
      "tab": "业务",
      "label": "模型切剖视图 Section View",
      "path": "ui.sectioning.enabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionSizeControl",
      "step": "4",
      "tab": "业务",
      "label": "切剖面尺寸控制 Section Size Control",
      "path": "ui.sectioning.sizeControl",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "free",
        "numeric"
      ],
      "labels": {
        "free": "自由编辑",
        "numeric": "数值编辑"
      },
      "default": "free",
      "recommended": "free",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ],
      "asArray": true
    },
    {
      "id": "info.physical.sectionRotationControl",
      "step": "4",
      "tab": "业务",
      "label": "切剖面角度控制 Section Rotation Control",
      "path": "ui.sectioning.rotationDeg",
      "widget": "number",
      "min": -180,
      "max": 180,
      "stepSize": 0.5,
      "unit": "deg",
      "enum": null,
      "labels": null,
      "default": 0,
      "recommended": 0,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionMultiPlaneControl",
      "step": "4",
      "tab": "业务",
      "label": "切剖面的多面组合控制 Section Multi-Plane / Box Control",
      "path": "ui.sectioning.faces",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "front",
        "back",
        "left",
        "right",
        "top",
        "bottom"
      ],
      "labels": {
        "front": "前",
        "back": "后",
        "left": "左",
        "right": "右",
        "top": "上",
        "bottom": "下"
      },
      "default": [
        "front"
      ],
      "recommended": [
        "front"
      ],
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionCapping",
      "step": "4",
      "tab": "业务",
      "label": "切面的封口控制 Section Capping",
      "path": "ui.sectioning.capping",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": true
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionOpacity",
      "step": "4",
      "tab": "业务",
      "label": "切剖面自身不透明度",
      "path": "ui.sectioning.sectionOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.15",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.0"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectioningPlane",
      "step": "4",
      "tab": "业务",
      "label": "切剖面位置归一化",
      "path": "ui.sectioning.sectioningPlane",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.5",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.2"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionPlaneSize",
      "step": "4",
      "tab": "业务",
      "label": "切剖面尺寸模式",
      "path": "ui.sectioning.PlaneSize",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "default",
        "custom"
      ],
      "labels": null,
      "default": "default",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "default"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.enabled",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionPlaneAxis",
      "step": "4",
      "tab": "业务",
      "label": "切剖面法线轴",
      "path": "ui.sectioning.planeAxis",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "x",
        "y",
        "z"
      ],
      "labels": null,
      "default": "y",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "z"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionPlaneArmMs",
      "step": "4",
      "tab": "业务",
      "label": "切剖面长按激活 ms",
      "path": "ui.sectioning.planeArmMs",
      "widget": "number",
      "min": 0,
      "max": 5000,
      "stepSize": 100,
      "unit": "ms",
      "enum": null,
      "labels": null,
      "default": 500,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": 1700
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionOtherOpacity",
      "step": "4",
      "tab": "业务",
      "label": "切剖时非聚焦不透明度",
      "path": "ui.sectioning.otherOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.3",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.4"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionFocusOpacity",
      "step": "4",
      "tab": "业务",
      "label": "切剖时聚焦不透明度",
      "path": "ui.sectioning.focusOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "1.0",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "1.0"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionHideOtherTag",
      "step": "4",
      "tab": "业务",
      "label": "切剖时隐藏其他标签",
      "path": "ui.sectioning.hideOtherTag",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": true
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionOtherTagOpacity",
      "step": "4",
      "tab": "业务",
      "label": "切剖时其他标签不透明度",
      "path": "ui.sectioning.OtherTagOpacity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "0.6",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "0.6"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionHideSectionTag",
      "step": "4",
      "tab": "业务",
      "label": "隐藏切剖标签",
      "path": "ui.sectioning.hideSectionTag",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": false
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionEdgeColor",
      "step": "4",
      "tab": "业务",
      "label": "切剖面描边色",
      "path": "ui.sectioning.edgeColor",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "#FFFFFF",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": {
        "芯片": "#FFFFFF"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionCapMaterialColor",
      "step": "4",
      "tab": "业务",
      "label": "封口材质与颜色 Cap Material / Color",
      "path": "ui.sectioning.cap",
      "widget": "json",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "diffuse",
        "reflective",
        "transparent"
      ],
      "labels": {
        "diffuse": "漫射",
        "reflective": "反射",
        "transparent": "透明"
      },
      "default": {
        "materials": [
          "diffuse"
        ],
        "color": "#A6C9DC"
      },
      "recommended": {
        "materials": [
          "diffuse"
        ],
        "color": "#A6C9DC"
      },
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.capping",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.capping",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.pathFocusColor",
      "step": "4",
      "tab": "业务",
      "label": "路径聚焦色",
      "path": "pathUi.focusColor",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": "#ffffff"
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.pathIdleOutline",
      "step": "4",
      "tab": "业务",
      "label": "路径空闲描边色",
      "path": "pathUi.idleOutline",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": "#939393"
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.pathBundleDimOpacity",
      "step": "4",
      "tab": "业务",
      "label": "束路径非聚焦不透明度",
      "path": "pathUi.bundlePathDimOpacity",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": 0.2
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.pathBundleFocusDimOpacity",
      "step": "4",
      "tab": "业务",
      "label": "束路径焦点外不透明度",
      "path": "pathUi.bundlePathFocusDimOpacity",
      "widget": "number",
      "min": 0,
      "max": 1,
      "stepSize": null,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": 0.05
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.pathNegativeSlackColor",
      "step": "4",
      "tab": "业务",
      "label": "Negative Slack 路径色",
      "path": "pathUi.negativeSlackColor",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": "#c850ff"
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.physical.sectionExclusionList",
      "step": "4",
      "tab": "业务",
      "label": "切剖排除选择器 Exclusion List",
      "path": "ui.sectioning.exclusion",
      "widget": "multi",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "__all__",
        "core-timing-path"
      ],
      "labels": {
        "__all__": "全部",
        "core-timing-path": "核心时序路径"
      },
      "default": null,
      "recommended": [
        "core-timing-path"
      ],
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": [
          "core-timing-path"
        ]
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": {
        "path": "ui.sectioning.capping",
        "eq": true
      },
      "condition": {
        "path": "ui.sectioning.capping",
        "eq": true
      },
      "fieldRole": "domainOnly",
      "panel": {
        "section": "physical",
        "group": "切剖图",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    },
    {
      "id": "info.sim.styleMode",
      "step": "4",
      "tab": "业务",
      "label": "仿真层UI风格 Style Mode",
      "path": "simUi.styleMode",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "realistic",
        "virtual"
      ],
      "labels": {
        "realistic": "写实",
        "virtual": "虚拟"
      },
      "default": "realistic",
      "recommended": "realistic",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.stackNumber",
      "step": "4",
      "tab": "业务",
      "label": "仿真信息叠加数量 Simulated Information Stack Number",
      "path": "simUi.stackNumber",
      "widget": "number",
      "min": 0,
      "max": 7,
      "stepSize": 1,
      "unit": "count",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": 1
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.stackType",
      "step": "4",
      "tab": "业务",
      "label": "仿真信息叠加方式 Simulated Information Stack Type",
      "path": "simUi.stackType",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "attached",
        "float"
      ],
      "labels": {
        "attached": "叠加至物理模型",
        "float": "悬浮于物理模型"
      },
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": [
          "attached"
        ]
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.gap",
      "step": "4",
      "tab": "业务",
      "label": "仿真信息间的距离 Simulated Information Gap",
      "path": "simUi.gap",
      "widget": "number",
      "min": 0,
      "max": 7,
      "stepSize": 1,
      "unit": "modelUnit",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "芯片"
      ],
      "domainDefaults": {
        "芯片": 1
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": {
        "path": "simUi.stackType",
        "eq": "float"
      },
      "condition": {
        "path": "simUi.stackType",
        "eq": "float"
      },
      "fieldRole": "domainOnly",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.transparency",
      "step": "4",
      "tab": "业务",
      "label": "仿真信息透明度 Simulated Information Transparency",
      "path": "simUi.transparency",
      "widget": "number",
      "min": 0.1,
      "max": 100,
      "stepSize": 0.1,
      "unit": "percent",
      "enum": null,
      "labels": null,
      "default": 100,
      "recommended": null,
      "recommendedFor": [
        "GTS领域"
      ],
      "domainDefaults": {
        "GTS领域": "x"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.dataFilter",
      "step": "4",
      "tab": "业务",
      "label": "仿真信息数值过滤器 Simulated Information Data Filter",
      "path": "simUi.dataFilter",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.timeline",
      "step": "4",
      "tab": "业务",
      "label": "仿真时间轴 Simulated Timeline",
      "path": "simUi.timeline",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": true,
      "recommended": true,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.timelineStep",
      "step": "4",
      "tab": "业务",
      "label": "仿真时间轴步长 Simulated Timeline Step",
      "path": "simUi.timelineStep",
      "widget": "number",
      "min": 1,
      "max": 60,
      "stepSize": 0.1,
      "unit": "count",
      "enum": null,
      "labels": null,
      "default": 1,
      "recommended": null,
      "recommendedFor": [
        "GTS领域"
      ],
      "domainDefaults": {
        "GTS领域": "x"
      },
      "domainExclusive": false,
      "map": null,
      "visibleWhen": {
        "path": "simUi.timeline",
        "eq": true
      },
      "condition": {
        "path": "simUi.timeline",
        "eq": true
      },
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.sim.playbackControl",
      "step": "4",
      "tab": "业务",
      "label": "仿真时间轴播放速率 Simulated Timeline Playback Control",
      "path": "simUi.playbackControl",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "x1.5",
        "x2",
        "x5",
        "x10",
        "x20"
      ],
      "labels": {
        "x1.5": "x1.5",
        "x2": "x2",
        "x5": "x5",
        "x10": "x10",
        "x20": "x20"
      },
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "GTS领域"
      ],
      "domainDefaults": {
        "GTS领域": [
          "x2"
        ]
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": {
        "path": "simUi.timeline",
        "eq": true
      },
      "condition": {
        "path": "simUi.timeline",
        "eq": true
      },
      "fieldRole": "domainOnly",
      "panel": {
        "section": "sim",
        "group": "仿真层UI",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.logic.lightMode",
      "step": "4",
      "tab": "业务",
      "label": "逻辑层光源模式 Light Mode",
      "path": "logicUi.lightMode",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "default",
        "custom"
      ],
      "labels": {
        "default": "默认光源",
        "custom": "自定义"
      },
      "default": "default",
      "recommended": "default",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "logic",
        "group": "逻辑层显示",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "logic"
      ]
    },
    {
      "id": "info.logic.topoLayout",
      "step": "4",
      "tab": "业务",
      "label": "逻辑层拓扑排布方式 Topo Diagram Layout",
      "path": "logicUi.topoLayout",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "center",
        "staggered"
      ],
      "labels": {
        "center": "居中对齐",
        "staggered": "错落分布"
      },
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "GTS领域"
      ],
      "domainDefaults": {
        "GTS领域": [
          "staggered"
        ]
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "logic",
        "group": "逻辑层显示",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "logic"
      ]
    },
    {
      "id": "info.logic.expandableSubNode",
      "step": "4",
      "tab": "业务",
      "label": "可展开的子节点数量 Expandable Sub Node",
      "path": "logicUi.expandableSubNode",
      "widget": "number",
      "min": 1,
      "max": 10,
      "stepSize": 0.1,
      "unit": "count",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "GTS领域"
      ],
      "domainDefaults": {
        "GTS领域": 5
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "logic",
        "group": "逻辑层显示",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "logic"
      ]
    },
    {
      "id": "info.logic.topoDepth",
      "step": "4",
      "tab": "业务",
      "label": "可跳转的层级数量 Topo Depth",
      "path": "logicUi.topoDepth",
      "widget": "number",
      "min": 1,
      "max": 5,
      "stepSize": 0.1,
      "unit": "count",
      "enum": null,
      "labels": null,
      "default": null,
      "recommended": null,
      "recommendedFor": [
        "GTS领域"
      ],
      "domainDefaults": {
        "GTS领域": 1
      },
      "domainExclusive": true,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "domainOnly",
      "panel": {
        "section": "logic",
        "group": "逻辑层显示",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "logic"
      ]
    },
    {
      "id": "info.simCloud.lightMode",
      "step": "4",
      "tab": "业务",
      "label": "仿真层模式光源 Light Mode",
      "path": "simCloud.lightMode",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "default",
        "custom"
      ],
      "labels": {
        "default": "默认光源",
        "custom": "自定义"
      },
      "default": "default",
      "recommended": "default",
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层模式",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.simCloud.enabled",
      "step": "4",
      "tab": "业务",
      "label": "仿真云图",
      "path": "simCloud.enabled",
      "widget": "boolean",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": false,
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层模式",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.simCloud.channel",
      "step": "4",
      "tab": "业务",
      "label": "云图通道",
      "path": "simCloud.channel",
      "widget": "select",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": [
        "temp",
        "run",
        "traffic",
        "load"
      ],
      "labels": null,
      "default": "temp",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "sim",
        "group": "仿真层模式",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "simulation"
      ]
    },
    {
      "id": "info.tree.granularity",
      "step": "4",
      "tab": "业务",
      "label": "结构树粒度",
      "path": "ui.tree.granularity",
      "widget": "text",
      "min": null,
      "max": null,
      "stepSize": null,
      "unit": "",
      "enum": null,
      "labels": null,
      "default": "row",
      "recommended": null,
      "recommendedFor": null,
      "domainDefaults": null,
      "domainExclusive": false,
      "map": null,
      "visibleWhen": null,
      "condition": null,
      "fieldRole": "userInput",
      "panel": {
        "section": "logic",
        "group": "逻辑层显示",
        "order": 400
      },
      "dependsOn": [],
      "affects": [
        "space"
      ]
    }
  ]
}
```

## 全部领域配置

### domains/common/asset-schema.yaml

```yaml
assetTypes:
  - id: common.object
    label: 通用对象
    parent: null
  - id: common.assembly
    label: 装配体
    parent: common.object
  - id: common.part
    label: 零件
    parent: common.assembly
relations:
  - parentAssetId → children[]
requiredOnPickable: [assetId, assetType, modelNodeId]
legacyMap:
  matRole: semanticRole
  matClass: assetTypeHint

```

### domains/common/data-schema.yaml

```yaml
# 产品层测点约定骨架；本 skill 不实现连接器
points: []
qualityCodes: [good, uncertain, bad, stale]
clockModes: [realtime, history, simulation, paused]

```

### domains/common/manifest.yaml

```yaml
id: common
version: 1.0.0
label: 通用三维
projectDomains: [universal, common]
templateIds: [universal]
extends: []
interactionProfile: sceneNavigation
cameraTier: bbox
emptyScaleLevel: L19
capabilities:
  - scene-camera
  - lighting
  - interaction
  - performance-baseline

```

### domains/common/presets.yaml

```yaml
# common 场景预设（与 Step1 普适 default / recommended.scene 对齐）
seed:
  foundation.length: "1:1m"
  foundation.gridMajorMm: 1000
  ui.scale.activeScaleLevelId: L19
  foundation.focalLengthMm: 36
  foundation.sensorHeightMm: 24
  controls.polarDeg: 30
  controls.azimuthDeg: 150
  foundation.shadowEnabled: true
layersDefault: [camera, lighting, scale, length]

```

### domains/common/rules.yaml

```yaml
constraints:
  - id: length-four-tiers
    path: foundation.length
    enum: ["1:1km", "1:1m", "1:1cm", "1:1mm"]
  - id: model-scale-locked
    path: foundation.modelScale
    equals: 1
    reason: Step2 铁律
  - id: missing-gap-never-zero
    when: { path: ui.exploded, eq: true }
    forbid: { path: ui.explodeGap, equals: 0 }
alarms: []

```

### domains/common/ui-layout.yaml

```yaml
panelHints:
  defaultSections: [rules, scene, token, physical, sim, logic, roam]
  restoreScope: currentProfile
permissions:
  applyProfileRequiresConfirm: true
  autoPersistTemplate: false

```

### domains/data-center/asset-schema.yaml

```yaml
assetTypes:
  - id: datacenter.room
    label: 机房
    parent: null
  - id: datacenter.row
    label: 机柜列
    parent: datacenter.room
  - id: datacenter.rack
    label: 机柜
    parent: datacenter.row
  - id: datacenter.pdu
    label: PDU
    parent: datacenter.rack
  - id: datacenter.cooling
    label: 冷却末端
    parent: datacenter.room
relations:
  - room → row[] → rack[] → pdu[]
requiredOnPickable: [assetId, assetType, modelNodeId]
semanticRoles: [room, row, rack, pdu, craH, busway]
legacyMap:
  matRole: semanticRole
  matClass: assetTypeHint

```

### domains/data-center/data-schema.yaml

```yaml
points:
  - id: inletTemperature
    unit: C
  - id: power.kw
    unit: kW
  - id: humidity
    unit: percent
  - id: capacity.u
    unit: count
qualityCodes: [good, uncertain, bad, stale]
clockModes: [realtime, history, simulation, paused]

```

### domains/data-center/manifest.yaml

```yaml
id: data-center
version: 1.0.0
label: 数据中心
projectDomains: [data-center, yunhe, compute-center, 云核, 算力中心]
templateIds: [yunhe, compute]
extends: [common]
interactionProfile: sceneNavigation
cameraTier: keep
emptyScaleLevel: L16
capabilities:
  - rack-semantics
  - capacity-hooks
  - thermal-floor-hooks
  - pdu-telemetry-hooks
profiles:
  - id: yunhe
    label: 云核
    templateId: yunhe
  - id: compute
    label: 算力中心
    templateId: compute

```

### domains/data-center/presets.yaml

```yaml
seed:
  foundation.length: "1:1m"
  foundation.gridMajorMm: 1000
  foundation.focalLengthMm: 36
  foundation.sensorHeightMm: 24
  controls.polarDeg: 30
  controls.azimuthDeg: 150
layersDefault: [camera, lighting, scale, length]
profileOverrides:
  yunhe:
    ui.scale.activeScaleLevelId: L18
  compute:
    ui.scale.activeScaleLevelId: L16

```

### domains/data-center/rules.yaml

```yaml
constraints:
  - id: keep-scene-navigation
    interactionProfile: sceneNavigation
  - id: no-silent-chip-camera
    forbidRestoreFrom: chip
alarms:
  - id: rack-inlet-temp
    channel: inletTemperature
    severity: warning
    threshold: { gte: 27, unit: C }
  - id: pdu-overload
    channel: power.kw
    severity: critical
    threshold: { gte: 0.95, unit: ratio }

```

### domains/data-center/ui-layout.yaml

```yaml
panelHints:
  preferGroups: [空间尺寸与单位, 观察视角, 连带交互, 仿真层UI]
  lockCameraTier: keep
permissions:
  applyProfileRequiresConfirm: true
  visualizationLayerOptIn: true

```

### domains/gts/asset-schema.yaml

```yaml
assetTypes:
  - { id: gts.campus, label: 园区, parent: null }
  - { id: gts.building, label: 数据中心主楼, parent: gts.campus }
  - { id: gts.road, label: 园区道路, parent: gts.campus }
  - { id: gts.cooling-unit, label: 楼顶散热机组, parent: gts.building }
  - { id: gts.lamp, label: 路灯, parent: gts.campus }
relations:
  - campus → building[] → cooling-unit[]
  - campus → road[]
  - campus → lamp[]
requiredOnPickable: [assetId, assetType, modelNodeId]
semanticRoles: [campus, building, cooling, energy-flow, road, lamp]

```

### domains/gts/data-schema.yaml

```yaml
points:
  - { id: energy.flow, unit: ratio }
  - { id: cooling.airflow, unit: ratio }
  - { id: fan.speed, unit: ratio }
  - { id: building.light, unit: ratio }
  - { id: sensor.alarm, unit: boolean }
qualityCodes: [good, uncertain, bad, stale]
clockModes: [realtime, history, simulation, paused]

```

### domains/gts/manifest.yaml

```yaml
id: gts
version: 1.0.0
label: GTS领域
projectDomains: [gts, GTS, GTS领域, AIDC]
templateIds: [gts]
extends: [common]
interactionProfile: sceneNavigation
cameraTier: keep
emptyScaleLevel: L15
parameterSource: AIDC与数字孪生skill-三表汇总.xlsx
capabilities:
  - campus-layout
  - energy-flow-visualization
  - cooling-flow-visualization
  - themed-material-palette
profiles:
  - id: gts
    label: GTS领域
    templateId: gts

```

### domains/gts/presets.yaml

```yaml
# GTS 领域参数。来源：AIDC 对照表；数值均保留 AIDC 的深/浅主题差异。
# seed 只放语义与量纲可安全映射到通用 Step 字段的参数。
seed:
  foundation.length: "1:1m"
  foundation.gridMajorMm: 1000
  foundation.focalLengthMm: 30
  foundation.sensorHeightMm: 24
  controls.polarDeg: 12.4
  controls.azimuthDeg: 32.5
  foundation.lightDecay: quadratic
  foundation.shadowEnabled: true
  ui.scale.activeScaleLevelId: L15
layersDefault: [camera, lighting, scale, length]

# 下列值是 AIDC 原始 3D 参数，不会被错误转换成通用 field；由 GTS 宿主 Adapter 消费。
gts3d:
  unitAssumption: "1 unit = 1 m"
  world:
    ground: { size: [10000, 1, 10000], centerY: -0.5 }
    roads: { width: 5.6, thickness: 0.06, length: 500, z: [-98, -34, 30, 94], x: [-118, -48, 22, 92] }
    paving: { width: 1.5, thickness: 0.15, intersectionMargin: 4.25 }
    floors: { count: 4, levelsY: [0, 3, 6, 9], floorHeight: 3, builtHeight: 12 }
    buildings:
      - { id: b1, center: [-19, 0], footprint: [32, 26], height: 12 }
      - { id: b2, center: [55, 0], footprint: [38, 24], height: 12 }
      - { id: b3, center: [-18, -66], footprint: [30, 28], height: 12 }
      - { id: b4, center: [55, -66], footprint: [34, 27], height: 12 }
      - { id: b5, center: [-87, 0], footprint: [32, 25], height: 12 }
      - { id: b6, center: [-86, -66], footprint: [28, 30], height: 12 }
      - { id: b7, center: [57, 64], footprint: [34, 23], height: 12 }
      - { id: b8, center: [-86, 64], footprint: [26, 28], height: 12 }
      - { id: b9, center: [126, 0], footprint: [31, 25], height: 12 }
      - { id: b10, center: [126, -66], footprint: [31, 27], height: 12 }
    lampPole: { height: 5, radius: [0.045, 0.075], spacing: 14 }
  camera:
    near: 0.5
    far: 900
    pixelRatioMax: 1.35
    login: { distance: 122.9, lookAt: [12, 15, 0], zoom: 0.85, panX: 0, panY: 5, azimuthOffsetDeg: -2, azimuthBaseDeg: 34.5, elevationDeg: 12.4, fovDeg: 43, motion: 0.7, drift: 2 }
    narrowViewportFovDeg: 58
    backgroundView: { moveSpeed: 28, shiftMultiplier: 2, radius: [50, 240], pitchRad: [0.14, 1.3], targetBounds: { x: [-70, 90], z: [-80, 80], y: 15 }, exit: Esc, exitDurationMs: 800 }
  lighting:
    hemisphere: { sky: "#d5e0ee", ground: "#596149", dark: 0.7, light: 0 }
    sun:
      color: "#f0f3fa"
      dark: { intensity: 4.3, azimuthDeg: -60, elevationDeg: 46, position: [-96.3, 115.1, 55.6] }
      light: { intensity: 4.6, azimuthDeg: -56, elevationDeg: 37, position: [-105.9, 96.3, 71.5] }
    rim: { color: "#d8dfe9", intensity: 0, position: [50, 35, -60] }
    energyPoint: { position: [22, 1.6, -34], decay: 2, distance: 16, baseIntensity: 8, amplitude: 2, frequency: 0.5 }
    coolingPoints: { count: 3, decay: 2, distance: 16, baseIntensity: 5, amplitude: 1.2, frequency: 0.4, color: "#b9d8e4" }
    environmentReflection:
      type: PMREM
      background: "#303033"
      panels: [{ position: [-30, 30, 0], size: [1, 50, 80] }, { position: [0, 65, 0], size: [100, 1, 35] }, { position: [60, 20, -45], size: [1, 30, 100] }]
    toneMapping: ACESFilmic
    exposure: { dark: 0.6, light: 0.95 }
    emissive:
      buildingLight: { darkOpacity: 0.0216, lightBaseOpacity: 0.135, lightPeakOpacity: 0.2475 }
      glass: { dark: 0.16, light: [0.12, 0.27] }
      blendMode: { dark: AdditiveBlending, light: NormalBlending }
      energyStrength: { dark: 2, light: 2 }
      coolingLight: { dark: 0.55, light: 0.8 }
      lampBrightness: { dark: 0.45, light: 2 }
      glow: { dark: 0, light: 0.031 }
      sensorOpacity: { dark: 0, light: 0 }
      edgeOpacity: { dark: 0, light: 1 }
  shadow:
    dark: { strength: 0.75, radius: 2, normalBias: 0.12 }
    light: { strength: 1, radius: 6, normalBias: 0 }
    map: { size: 2048, type: PCF, bias: -0.0002 }
    camera: { left: -150, right: 150, top: 150, bottom: -150, near: 1, far: 300 }
  atmosphere:
    dark: { sky: "#313235", fog: [260, 750], horizon: [300, 450], dof: { enabled: true, autoFocus: true, focusDistance: 120, focusRange: 75, softness: 67, blur: 0.5, near: 0.8, far: 1.4 } }
    light: { sky: "#edf0f2", fog: [600, 1200], horizon: [600, 750], dof: { enabled: true, autoFocus: true, focusDistance: 500, focusRange: 154, softness: 213, blur: 2.5, near: 0, far: 1.35 } }
  materials:
    structure: { dark: { roughness: 0.78, metalness: 0.05, opacity: 1, transmission: 0 }, light: { roughness: 1, metalness: 0.11, opacity: 0.78, transmission: 0.27 }, thickness: 1.2, ior: 1.45 }
    glass: { dark: { opacity: 0.94, roughness: 0.25, transmission: 0.05 }, light: { opacity: 0.92, roughness: 0.64, transmission: 0.05 }, thickness: 0.3, metalness: 0.25, ior: 1.45 }
    auxiliary: { darkRoughness: 0, lightRoughness: 1 }
    fixed: { groundRoughness: 0.96, roadRoughness: 0.87, pavingRoughness: 0.9, waterRoughness: 0.12, waterMetalness: 0.45 }
  palette:
    dark: { mountain: "#262626", ground: "#222326", road: "#919191", walk: "#a8a8a8", wall: "#565758", trim: "#4f4f4f", auxiliary: "#9c9c9c", roofCooling: "#303a43", roofFans: "#7a858f", roofPanels: "#28323c", plant: "#3b5443", glass: "#367eab", buildingLight: "#3b6f97", sensor: "#ff0000", lamp: "#ffdd00", energyBase: "#33754b", energy: "#00fe87", air: "#ffffff", water: "#00bfff", scan: "#3794cd" }
    light: { mountain: "#bac4ca", ground: "#d5d9dc", road: "#b2bbc0", walk: "#e0e4e6", wall: "#dce2e6", trim: "#3e4b55", auxiliary: "#819098", roofCooling: "#585b5f", roofFans: "#8bb5bb", roofPanels: "#585b5f", plant: "#536c55", glass: "#367eab", buildingLight: "#304b5d", sensor: "#ff0000", lamp: "#ddd59c", energyBase: "#788b80", energy: "#29986b", air: "#ffffff", water: "#00bfff", scan: "#5fCAFF" }
    scanAlpha: { dark: 0.35, light: 1 }
  animation:
    speed: 2
    flowSpeed: 2.8
    coolingSpeed: 0.8
    fanSpeed: 1.6
    energyStyle: 0
    coolingStyle: 5
    scanStyle: 0
    scan: { strength: 0.45, periodSec: 9.5, width: 0.4 }
    breath: { darkEnabled: false, lightEnabled: true, periodSec: 7.5, strength: 0.15 }

```

### domains/gts/rules.yaml

```yaml
constraints:
  - id: meter-world-units
    require: foundation.length == "1:1m"
  - id: preserve-aidc-camera-semantics
    note: AIDC zoom 是 PerspectiveCamera.zoom；不得映射为 orbit.minDistance。
  - id: preserve-aidc-exposure-semantics
    note: AIDC exposure 是 tone-mapping；不得映射为 foundation.lightingExposure。
  - id: background-view-is-not-first-person
    note: AIDC 背景查看移动观察目标，不具备人眼高度和碰撞，不得映射为真实漫游。
alarms:
  - id: campus-energy-flow
    channel: energy.flow
    severity: warning
    threshold: { lte: 0, unit: ratio }
  - id: cooling-flow
    channel: cooling.airflow
    severity: warning
    threshold: { lte: 0, unit: ratio }

```

### domains/gts/ui-layout.yaml

```yaml
panelHints:
  preferGroups: [空间尺寸与单位, 观察视角, 模型光源, 渲染机制]
  lockCameraTier: keep
  themeModes: [dark, light]
permissions:
  applyProfileRequiresConfirm: true
  visualizationLayerOptIn: true

```

### domains/semiconductor/asset-schema.yaml

```yaml
assetTypes:
  - id: semiconductor.package
    label: 封装
    parent: null
  - id: semiconductor.die
    label: Die
    parent: semiconductor.package
  - id: semiconductor.layer
    label: 工艺层
    parent: semiconductor.die
  - id: semiconductor.bond
    label: 键合
    parent: semiconductor.package
relations:
  - package → die[] → layer[]
requiredOnPickable: [assetId, assetType, modelNodeId, semanticRole]
semanticRoles: [package, die, metal, poly, via, bond, substrate]
legacyMap:
  matRole: semanticRole
  matClass: assetTypeHint

```

### domains/semiconductor/data-schema.yaml

```yaml
points:
  - id: temperature
    unit: C
    range: [-40, 150]
  - id: timing.slack
    unit: ns
  - id: yield
    unit: percent
    range: [0, 100]
qualityCodes: [good, uncertain, bad, stale]
clockModes: [realtime, history, simulation, paused]

```

### domains/semiconductor/manifest.yaml

```yaml
id: semiconductor
version: 1.0.0
label: 芯片
projectDomains: [semiconductor, 芯片]
templateIds: [chip]
extends: [common]
interactionProfile: chipInspection
cameraTier: chip
emptyScaleLevel: L27
legacyPackage: 领域/芯片默认参数包.yaml
capabilities:
  - chip-camera
  - explode-layers
  - die-package-semantics
  - thermal-visual-hooks

```

### domains/semiconductor/presets.yaml

```yaml
# 芯片场景预设（与 domainDefaults / 芯片默认参数包 seed 对齐的最小集）
seed:
  foundation.length: "1:1cm"
  foundation.gridMajorMm: 10
  ui.scale.activeScaleLevelId: L27
  foundation.focalLengthMm: 80
  foundation.sensorHeightMm: 24
  controls.polarDeg: 15
  controls.azimuthDeg: 0
  foundation.shadowEnabled: false
  foundation.background: "#000000"
  foundation.envMapIntensity: 0.06
# Step4 默认不自动应用；显式 visualization layer 时可用
visualizationSeed:
  ui.explodeGap: 8
  ui.explodeGapUnit: mm
layersDefault: [camera, lighting, scale, length]
legacySeedFile: 领域/芯片默认参数包.yaml
# 灯光灯具、业务示意图、点选层级、键位和引擎阻尼在领域包 force，不写进普适 min/default
forceOnTemplate: chip

```

### domains/semiconductor/rules.yaml

```yaml
constraints:
  - id: chip-camera-baseline
    paths:
      foundation.focalLengthMm: 80
      controls.polarDeg: 15
      controls.azimuthDeg: 0
    on: restoreProfileDefaults
  - id: explode-requires-layers
    when: { path: ui.exploded, eq: true }
    require:
      - model.explosionCapability.enabled
      - model.explosionCapability.layerCount.gte: 2
      - ui.explodeGap.gt: 0
  - id: bbox-must-not-downgrade
    note: 已生效 semiconductor profile 不被 800mm 展示尺度降级
alarms:
  - id: thermal-hotspot
    channel: temperature
    severity: warning
    threshold: { gte: 95, unit: C }

```

### domains/semiconductor/ui-layout.yaml

```yaml
panelHints:
  preferGroups: [观察视角, 模型光源, 爆炸图视图, 模型间的距离, 切剖图]
  lockCameraTier: chip
permissions:
  applyProfileRequiresConfirm: true
  visualizationLayerOptIn: true

```

### 领域/芯片默认参数包.yaml

```yaml
# 芯片领域默认参数包（全量对照路径检查 demo 3D）
# 说明：同目录 芯片领域参数.md
# 源：projects/chip-twin-demo-v1.01（亦可对照 路径检查demo + 3d-source）
# 写入：面板选「芯片」→ writeTemplateSeedFields + domainDefaults + CHIP_ENGINE_EXTRAS
# 反哺：demo「生效/导出领域包」→ chip-domain-feed JSON → scripts/feed-chip-domain-pack.mjs
#
# 分层：
#   seed          → 进 twinState（合法范围内的产品参数）
#   engineExtras  → 引擎 API 形（select/selectFocus/section/threshold），宿主按 path 消费
#   force         → 只属于芯片。不改普适 min/max/default。点「领域场景模板-芯片」时强制写入并生效
#   geometry      → 建模尺寸目录（只登记，禁止面板改顶点；modelScale 铁律=1）
#   omit          → 有意不写入普适字段（铁律冲突）。引擎原值改放 force，不放宽普适范围
#
# 约束：以 demo 为基准改芯片点值；不改普适 default/min/max；不污染非芯片参数。

domain: 芯片
templateId: chip
cameraTier: chip
emptyScaleLevel: L27

omit:
  foundation.modelScale: { demo: 1.2, keep: 1, reason: Step2 铁律，禁止写入 1.2 }
  orbit.dampingFactor_demo: { demo: 0.06, keep: 0.1, reason: 普适 min=0.1 不动。面板字段仍取 0.1；引擎阻尼 0.06 只在 force.orbit }
  "*Event / mouseEvent / keyEvent": { reason: 函数体不进点值。触发条件改写成 force.interactionRules 数据 }

# —— Step 写入点（与参数.yaml domainDefaults / recommended.chip 对齐）——
seed:
  foundation.length: "1:1cm"
  foundation.gridMajorMm: 10
  foundation.gridSubdivisions: 1
  ui.scale.activeScaleLevelId: L27
  foundation.focalLengthMm: 80
  foundation.fov: 17.06
  foundation.near: 0.01
  foundation.sensorMm: [36, 24]
  controls.polarDeg: 15
  controls.azimuthDeg: 0
  foundation.globalBrightness: 1.0
  foundation.lightingMode: threePoint
  foundation.lightContrast: low
  foundation.lightingTypes: [directional, area, environment]
  foundation.lightingIntensity: { directional: 8, area: 8, environment: 16 }
  foundation.lightingTemperature: { directional: 6500, area: 6500, environment: 4200 }
  foundation.lightingColorHsv: { directional: "0-0-100", area: "0-0-100", environment: "0-0-100" }
  foundation.lightingExposure: { directional: 0, area: 0, environment: 0 }
  foundation.keyIntensity: 8
  foundation.keyColor: "#FFFFFF"
  foundation.keyTemperatureK: 6500
  foundation.keyAzimuthDeg: [-85, -30]
  foundation.keyElevationDeg: 30
  foundation.shadowEnabled: false
  foundation.background: "#000000"
  foundation.uiBackground: "#2B2B2B"
  foundation.environmentIntensity: 0.028
  foundation.envMapIntensity: 0.06
  foundation.toneMapping: ACESFilmic
  foundation.workingSpace: ACEScg
  foundation.viewTransform: "ACES 1.0 SDR-video"
  foundation.reflective: { metalness: 0.08, roughness: 0.78 }
  foundation.transparent: { ior: 2, roughness: 0.72 }
  foundation.scaleLodMode: step
  foundation.scaleAdaptGrid: false
  foundation.motionBezier: "0.2,0,0.1,1"
  foundation.motionCurve: "cubic-bezier(0.2,0,0.1,1)"
  render.occlusion.strategy: perspective
  render.occlusion.blockageTransparency: 30
  orbit.dampingFactor: 0.1
  orbit.panSpeed: 1.0
  orbit.rotateSpeed: 1.0
  orbit.zoomSpeed: 1.0
  orbit.minDistance: 0.1
  orbit.maxDistance: 400
  orbit.verticalFieldRangeMinDeg: 0
  orbit.verticalFieldRangeMaxDeg: 90
  select.orbitAroundSelection: true
  interaction.camera.orbitAroundSelection: true
  select.duration: "600"
  selectFocus.focusView: "67"
  selectFocus.focusAngle: "15"
  selectFocus.duration: "750"
  selectFocus.hideOtherMesh: true
  selectFocus.relocateTarget: true
  interaction.adaptive.selectReposition.othersOpacityPct: 40
  interaction.adaptive.selectReposition.dimOthers: true
  interaction.hover.enabled: true
  interaction.adaptive.hoverCamera: false
  interaction.adaptive.hoverReposition.dimOthers: false
  interaction.adaptive.hoverReposition.showOutline: false
  interaction.adaptive.hoverReposition.othersOpacityPct: 100
  interaction.orientationToken.types: [axes]
  ui.explodeGap: 8
  ui.assembleGap: 0
  ui.sectioning.faces: [front]
  ui.sectioning.capping: true
  ui.sectioning.exclusion: [core-timing-path]
  simUi.stackNumber: 1
  simUi.stackType: [attached]
  simUi.gap: 1

# —— 引擎 API 块（demo defaultSelectApi / selectFocus / section / threshold）——
engineExtras:
  select:
    angle: "60"
    focus: "120"
    origin: "0,0,0.5*(object)"
    orbitAroundSelection: true
    duration: "600"
    motionCurve: "cubic-bezier(0.2,0,0.1,1)"
    selectOpacity: "1.0"
    otherOpacity: "0.4"
    hideOtherTag: false
    otherTagOpacity: "0.6"
  selectFocus:
    focusAngle: "15"
    focusView: "67"
    duration: "750"
    motionCurve: "cubic-bezier(0.2,0,0.1,1)"
    hideOtherMesh: true
    relocateTarget: true
    focusOpacity: "1.0"
    otherOpacity: "0.4"
    hideOtherTag: false
    otherTagOpacity: "0.6"
  thresholdTranisition:
    foucsThreshold: "114"
    foucsStep: "10"
    duration: "150"
    foucsDelay: "20"
    motionCurve: "cubic-bezier(0.2,0,0.1,1)"
    motionBlur: true
    focusOpacity: "1.0"
    otherOpacity: "0.4"
    hideOtherTag: false
    OtherTagOpacity: "0.6"
  dynamicSectioning:
    otherOpacity: "0.4"
    focusOpacity: "1.0"
    sectionOpacity: "0.0"
    sectioningPlane: "0.2"
    PlaneSize: default
    hideOtherTag: true
    OtherTagOpacity: "0.6"
    hideSectionTag: false
    sectionCapColor: "#A6C9DC"
    sectionEdgeColor: "#FFFFFF"
    sectionCapEnabled: true
    planeAxis: z
    planeArmMs: 1700
  labelsTags:
    select.hideOtherTag: false
    select.otherTagOpacity: "0.6"
    selectFocus.hideOtherTag: false
    selectFocus.otherTagOpacity: "0.6"
    threshold.hideOtherTag: false
    threshold.OtherTagOpacity: "0.6"
    section.hideOtherTag: true
    section.OtherTagOpacity: "0.6"
    section.hideSectionTag: false
  pathInteraction:
    # 时序路径 / 连线在 3D 中的交互态（demo _applyHighlight / bundle dim）
    focusColor: "#ffffff"
    idleOutline: "#939393"
    bundlePathDimOpacity: 0.2
    bundlePathFocusDimOpacity: 0.05
    solidMultiPathColor: "#939393"
    sectionPlaneProxyColor: "#595959"
    negativeSlackColor: "#c850ff"
    pinLabelKeepOnPath: true
    pathBgKeepWhenSection: true
    defaultZoomPercent: 100
    baseFitDist: 12
    # 3D 模型态（与上面的线透明度不是同一组数）
    nonFocusModelFactor: 0.2
    dieBlockFactor: 0.25
    pathMacroOpacity: 0.4
    onSegmentMacroOpacity: 0.4
    offSegmentMacroOpacity: 0.2
    endpointOpacity: 1
    pinOpacity: 1
    hotMacroOpacity: 1
    edgeRowOpacity: 0.4
    lineSegmentOtherOpacity: 0.35
    lineSegmentWarmOpacity: 0.28
  thermalSim:
    planeSlotGap: 0.9
    rangeLo: 0
    rangeHi: 1
    legendTempMin: 20
    legendTempMax: 80
    emissiveIntensity: 0.22

# —— 芯片强制包。运行时镜像：面板/chip-domain-pack.js ——
# 不改普适 min/max/default/enum。点「领域场景模板-芯片」整包生效；离开芯片则撤下。
# 面板字段装不下的值（阻尼 0.06、拖拽键位、灯具尺寸、业务示意图、点选层级）只放这里。
force:
  camera:
    runtimeFov: 18
    polarDeg: 15
    azimuthDeg: 0
    defaultZoomPercent: 100
    assembleFitPadding: 1.25
    fitFrameRatio: 0.8
  orbit:
    engineDampingFactor: 0.06
    panSpeed: 1
    rotateSpeed: 1
    zoomSpeed: 1
    wheel: scaleStep
  lighting:
    keyAzimuthDeg: [-85, -30]
    keyElevationDeg: 30
    lightContrast: low
    keyMap: 0.36
    directionalScale: 0.45
    environmentDivisor: 20
    fillRatio: 0.48
    rimRatio: 0.32
    rig:
      key: { width: 16, height: 12 }
      fill: { width: 12, height: 10 }
      rim: { width: 10, height: 8 }
      hemiSky: 0xF0F8FF
      hemiGround: 0x1A1A1A
  pathModel:
    nonFocusModelFactor: 0.2
    dieBlockFactor: 0.25
    pathMacroOpacity: 0.4
    onSegmentMacroOpacity: 0.4
    offSegmentMacroOpacity: 0.2
    endpointOpacity: 1
    pinOpacity: 1
    hotMacroOpacity: 1
    edgeRowOpacity: 0.4
    lineOverviewIdleOpacity: 0.2
    lineOverviewFocusOpacity: 0.05
    lineSegmentOtherOpacity: 0.35
    lineSegmentWarmOpacity: 0.28
  businessIllustration:
    top: 0.88
    sideLight: 0.74
    sideDark: 0.71
    diffuseGain: 0.65
    edgeStrength: 0.32
    edgeStartPixels: 6
    edgeFullPixels: 18
  interactionHierarchy:
    order: [package, die, floorplan]
    dieBeforeChild: true
    hideBondsOnDieFocus: true
    sameDieKeepsCamera: true
    ascendToDieRefits: true
  interactionRules:
    select: { pointer: click, empty: deselect, key: Esc, duration: "600", angle: "60", focus: "120", origin: "0,0,0.5*(object)", selectOpacity: "1.0", otherOpacity: "0.4" }
    selectFocus: { pointer: dblclick, key: Esc, duration: "750", focusAngle: "15", focusView: "67", hideOtherMesh: true, relocateTarget: true }
    threshold: { wheelDown: activate, wheelUp: deactivate, key: "Shift+ / Shift-", duration: "150", foucsThreshold: "114", foucsStep: "10", motionBlur: true }
    section: { click: frozen, planeDrag: longPress, planeArmMs: 1700, key: Esc }
  hover:
    enabled: true
    quiet: true
    camera: false
    dimOthers: false
    showOutline: false
    othersOpacityPct: 100
  interaction:
    mouse:
      left: orbitImmediate
      leftClick: select
      leftDblclick: selectFocus
      middle: pan
      right: pan
      panButtons: [1, 2]
    keyboard:
      orbit: 上下左右
      zoom: 放大+键，缩小-键
      restore: Space
      deselect: Esc
      select: 无

# —— 建模尺寸目录（mm；只供判断/建模对照，不进面板改网格）——
geometry:
  sceneMetersPerUnit_demo: 0.01
  DIE_MACRO_HEIGHT_MM: 0.5
  DIE_SUBSTRATE_HEIGHT_MM: 0.1
  DIE_STRUCT_BLOCK_HEIGHT_MM: 0.05
  INTERPOSER_CORE_HEIGHT_MM: 0.5
  PACKAGE_SUBSTRATE_HEIGHT_MM: 1
  EXPLODE_LAYER_GAP_MM: 8
  MU_BUMP_DIAMETER_MM: 0.2
  C4_BALL_DIAMETER_MM: 0.8
  HYBRID_BOND_CUBE_MM: 0.5
  HYBRID_BOND_PITCH_MM: 1.2
  HYBRID_BOND_OVERLAP: 0.8
  HYBRID_BOND_COLOR_TOPTOP_UPPER: "0x7db3b3"
  HYBRID_BOND_COLOR_TOPTOP_LOWER: "0x4d8c52"
  HYBRID_BOND_COLOR_TOP_UPPER: "0x4d8c52"
  HYBRID_BOND_COLOR_TOP_LOWER: "0x726d52"
  gridHelperColors: { major: "0x454545", minor: "0x3a3a3a" }
  cameraHomeDemo: [0, 3.106, 11.591]
  lightFillRatio_lowContrast: 0.48
  lightRimRatio_lowContrast: 0.32

```

## 能力说明与实现文件索引

以下索引覆盖规范、面板、运行实现及工具。文件存在不代表能力完成；隐藏控件和动态行为需按此追踪。

- `agents/openai.yaml`
- `assets/rect-area-light-uniforms.js`
- `assets/three.js`
- `bridge/atomic-groups.js`
- `bridge/axis-token.js`
- `bridge/capability-registry.js`
- `bridge/environment-timeline.js`
- `bridge/geometry-runtime.js`
- `bridge/host-adapter.template.js`
- `bridge/interaction-effects.js`
- `bridge/interaction-keys.js`
- `bridge/model-lighting.js`
- `bridge/panel-entry.js`
- `bridge/pointer-controller.js`
- `bridge/project-state-policy.js`
- `bridge/README.md`
- `bridge/scene-channels.js`
- `domains/common/asset-schema.yaml`
- `domains/common/data-schema.yaml`
- `domains/common/manifest.yaml`
- `domains/common/presets.yaml`
- `domains/common/rules.yaml`
- `domains/common/ui-layout.yaml`
- `domains/data-center/asset-schema.yaml`
- `domains/data-center/data-schema.yaml`
- `domains/data-center/manifest.yaml`
- `domains/data-center/presets.yaml`
- `domains/data-center/rules.yaml`
- `domains/data-center/ui-layout.yaml`
- `domains/gts/asset-schema.yaml`
- `domains/gts/data-schema.yaml`
- `domains/gts/manifest.yaml`
- `domains/gts/presets.yaml`
- `domains/gts/rules.yaml`
- `domains/gts/ui-layout.yaml`
- `domains/README.md`
- `domains/semiconductor/asset-schema.yaml`
- `domains/semiconductor/data-schema.yaml`
- `domains/semiconductor/manifest.yaml`
- `domains/semiconductor/presets.yaml`
- `domains/semiconductor/rules.yaml`
- `domains/semiconductor/ui-layout.yaml`
- `fixtures/campus-large/fixture.json`
- `fixtures/chip-800mm-missing-gap/fixture.json`
- `fixtures/chip-profile-restore/fixture.json`
- `fixtures/empty-scene/fixture.json`
- `fixtures/field-roles.json`
- `fixtures/fps-roam/fixture.json`
- `fixtures/interaction-nesting-conflict/fixture.json`
- `fixtures/manifest.json`
- `fixtures/panel-write-no-render/fixture.json`
- `fixtures/README.md`
- `fixtures/transparent-canvas-focus/fixture.json`
- `fixtures/unsupported-fields.json`
- `fixtures/yunhe-cloud/fixture.json`
- `package.json`
- `README.md`
- `scripts/audit-field-coverage.mjs`
- `scripts/audit-state.mjs`
- `scripts/build-field-roles.mjs`
- `scripts/build-panel-fields.mjs`
- `scripts/feed-chip-domain-pack.mjs`
- `scripts/load-domain-pack.mjs`
- `scripts/package-runtime.mjs`
- `scripts/query-parameters.mjs`
- `scripts/regress-fixtures.mjs`
- `scripts/test-atomic-groups.mjs`
- `scripts/test-capability-contract.mjs`
- `scripts/test-delivery.mjs`
- `scripts/test-field-coverage.mjs`
- `scripts/test-import-lifecycle.mjs`
- `scripts/test-model-lighting.mjs`
- `scripts/test-native-panel-dom.mjs`
- `scripts/test-panel-entry.mjs`
- `scripts/test-pointer-controller.mjs`
- `scripts/test-presentation-contract.mjs`
- `scripts/test-project-state-policy.mjs`
- `scripts/test-runtime.mjs`
- `scripts/test-transactions.mjs`
- `scripts/twin.mjs`
- `scripts/verify-runtime.mjs`
- `SKILL.md`
- `step-01-基础空间/参数.yaml`
- `step-01-基础空间/指南.md`
- `step-01-基础空间/详情.md`
- `step-01-基础空间/验收.md`
- `step-02-导入对象/参数.yaml`
- `step-02-导入对象/指南.md`
- `step-02-导入对象/详情.md`
- `step-02-导入对象/验收.md`
- `step-03-场景控制/参数.yaml`
- `step-03-场景控制/指南.md`
- `step-03-场景控制/详情.md`
- `step-03-场景控制/验收.md`
- `step-04-业务信息/参数.yaml`
- `step-04-业务信息/指南.md`
- `step-04-业务信息/详情.md`
- `step-04-业务信息/验收.md`
- `templates/new-project.html`
- `底座/C4D对照.md`
- `底座/README.md`
- `底座/全字段验收.md`
- `底座/判断.md`
- `底座/参数契约.md`
- `底座/可渲染状态.md`
- `底座/可验证交付.md`
- `底座/安全模式.md`
- `底座/宿主接入.md`
- `底座/工作流.md`
- `底座/比例尺.md`
- `底座/注册表.yaml`
- `底座/渐进交付.md`
- `底座/自检.md`
- `底座/铁律.md`
- `底座/领域包.md`
- `当前实现总结.md`
- `架构.md`
- `维护/README.md`
- `维护/职责与边界.md`
- `维护/运行时迁移矩阵-20261104.md`
- `面板/chip-domain-pack.js`
- `面板/logic.js`
- `面板/panel.js`
- `面板/字段.js`
- `面板/字段.json`
- `面板/预览.html`
- `领域/芯片领域参数.md`
- `领域/芯片默认参数包.yaml`
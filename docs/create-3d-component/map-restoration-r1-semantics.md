# R1 来源参数消费与冲突核验

这是静态来源核验，服务于清理及重新实现计划，不是运行验收。S=`D:/cyc/project/octo/gts/map`。地图HTML指`map-experience-v297/assets/上海地图-v2.97-基线-v2.1/上海地图-v2.97-参数锁定-v2.1.dc.html`；热力JS指`map-traffic-heatmap-v1.26.0/assets/maplibre-strong-halo-profile.js`。行号以本次34文件指纹快照为准。

## 地图42项主题字段

逐字段浅深默认值、输入范围、步长、输入事件和回调行见`native-work/map-components-restoration/evidence/r1-map-control-map.json`；以下分组列出实际消费与条件，每个字段均明确列名。数值权威是来源参数JSON，控件范围不是公共API校验。HTML 2541–2542直接写状态并调用回调，没有统一的类型、有限值或范围校验。

|字段|消费位置（HTML行）|运行语义及条件|
|---|---|---|
|ground、water、green|1612–1712 applyColors|按背景/水/绿地语义图层设置颜色；深色清除相关pattern，浅色恢复缓存。颜色为sRGB，不是无量纲数值|
|road、roadOutline、road3DDarken|783–789、1617–1618、1650–1664|只有3d模式道路及描边随Z15→16变暗；darken clamp 0–1。2d直接使用原色|
|roadOutlineWidth|1660、2240起scaleSize|缓存原始线宽并缩放表达式；值是倍率，不是最终CSS像素；该调用无额外clamp|
|greenParkOpacity、greenWoodOpacity、greenGrassOpacity、greenOtherOpacity|1680–1700|按公园/树林/草地/其他分类消费，clamp 0–1；不是四层重复叠加|
|districts|2216–2219|切换sh-districts可见性；布尔开关|
|placeColor、roadMajorColor、roadMinorColor、labelHalo|2223–2235|交通名称按motorway/trunk/primary区分主路，其余道路用次路色；非道路符号用placeColor；halo统一设置|
|labelSize|2260–2275|原始text-size缓存后乘倍率，缺失回退16；不是字号像素；无局部clamp|
|roadLabelDensity|2278–2295|clamp 0–1；间距round(1800-density*1620)，≤.01隐藏道路文字；同时禁止重叠|
|skyColor|711–728|容器背景总是尝试设置；支持setSky时配置天空/地平线/雾混色，异常被来源吞掉；不是天空加载成功的证明|
|building、buildingGlow|523–558、1715–1775、1777–1808|基色与白色按glow*.28混色，glow也影响光照反差；混色处不clamp，applyLight处clamp 0–1|
|buildingShadeStrength、buildingEdgeShadow|529–558、1777–1808|两者clamp 0–1；shade^.72控制五档明度差；圆角按depthTone，原始建筑按高度阶梯回退；edge不是独立投影透明度|
|buildingGradient、buildingTopLight、buildingBottomLight、buildingFillLight|1715–1808、820–888|gradient>.01打开原生vertical-gradient；六个光照比例在applyLight内分别clamp 0–1；共同计算顶部颜色和反差，不能当独立线性亮度|
|lightColor、intensity、azimuth、altitude|1777–1808、876–885、1971–1973|普通建筑setLight以光色/反差/方向生效，明珠同步；intensity在幂运算前没有局部clamp。角度为度，阴影高度角另clamp 8–90，不能把该范围误用于所有光照消费|
|pearlColor、pearlGlow、pearlRoughness、pearlLightMatch、pearlFillLight、pearlBrightness|820–889|模型加载后materials存在才生效；glow 0–1→emissive*.045；roughness .35–1；match 0–1；fill偏移-1–1；brightness曝光0–4；颜色还用于补光。绑定普通建筑光照但允许相对偏移|
|shadow、shadowColor|2182–2214、2151–2162、561–564|关闭或zoom<15隐藏投影；颜色用于联合遮罩，另有buildingTurnShadowColor函数引用，不能只因函数存在就断言存在可见转折层|
|shadowStrength|2046–2058|乘高度角/柔化补偿/zoom可见度后clamp到0–.88；不等于直接raster透明度|
|shadowRange|1971–2000|倍率clamp .5–4；方向azimuth+180，距离还受高度/生长/上限28+range*32影响|
|shadowSoftness|2049、2123–2148|softness/2 clamp 0–1；≤.001不虚化，否则方向采样/模糊；参与浓度补偿；与先合并遮罩再统一透明度配套|

公共条件：1715–1775建筑可见条件是3d或zoom≥15；圆角未准备好/特殊区域使用原始层或哈利克补充。731–758普通建筑生长由zoom决定；不因为模式名称为2d就保证建筑消失。389–393保存过滤临时面板/查询状态，状态保存异常吞掉；预设另用版本化键，不能照搬为通用组件全局存储。

主题字段之外的交互仍纳入M10/M12/M13/M14：视图center/zoom/bearing/pitch及模式、搜索定位、主题预设保存应用、面板折叠、哈利克逐建筑visible/brightness/scale/rotation/offsetDepth/offsetAlong/offsetHeight。1814–1824提供逐建筑有限数值回退，2817–2841绑定编辑与重置；2545–2565俯仰clamp15–75并按帧更新。源中遗留彩色哈利克材质控件不据此重新启用已撤销彩模。搜索/面板状态属于example；建筑数据编辑由宿主配置传入；不将整套页面状态强塞进组件API。

## 范围外参数：有规范，无对应可运行基线

`assets/管辖范围外样式参数-v1.0.json`两主题各16项为权威默认值。groundColor/roadColor/roadOutlineColor/waterColor/greenColor/buildingColor/placeColor/roadMajorColor/roadMinorColor/labelHaloColor/borderColor均为颜色；roadOutlineWidth为原道路宽倍率；greenOpacity/labelOpacity/borderOpacity为0–1；borderWidth为CSS px。启用条件、边界开关、外侧描边位置来自JSON元配置，不是主题颜色参数。

34文件中没有该功能所指的禁用态HTML v1.3/v1.4实现；因此不能填写虚假的消费代码行或已支持结论。M15按`references/管辖范围外样式-v1.1.md`重新实现并单独验收；JSON没规定的数值范围不自行宣布冻结。独立配色、孔洞、同步视角合成、外描边、事件穿透与有限缓冲均保留。它是明确的来源缺失，不阻止提出R2清理计划，但阻止R3仅凭基础HTML宣称完整范围外还原。

## 散点：参数由规范定义，不能拿旧库算法补充权威

值源：`map-scatter/references/implementation.md`默认参数、主题与参数持久化章节；渲染形状源为`assets`内SVG。该来源没有完整可运行组件，消费实现属于R4。

|参数组|来源要求与消费计划|
|---|---|
|pointRadius、点描边宽/颜色|3.4 CSS px、1.5 CSS px；画布按DPR配置，逻辑尺寸不乘地图缩放|
|聚合标记宽高、数量字体/描边|SVG24×29；文字16px/500，主体中心+0.5px，三位及以上*.82；字体加载后重绘|
|clusterDistance、clusterMinCount|28 CSS px、9；逻辑模式用zoomTarget分段网格，地理模式独立坐标适配，禁止宣称旧邻接聚合完全等价|
|zoomTarget、zoomCurrent、缩放步长|归一化0–1，默认.12、步长.16；分箱用target，插值用current（.14）；固定标记尺寸|
|theme、tone、自定义颜色|system/light/dark；完整红绿蓝灰语义表，自定义色优先；监听宿主系统主题变化并释放|
|选中、稳定ID、样本种子|保存真实ID，成员与选中稳定；热点60%/背景30%/离群10%仅显式样本；业务空数组不造数据|
|持久化、旧参数迁移|版本键、白名单/有限值、旧半径×2映射宽度、旧色归浅色；恢复默认清存储；存储策略属于宿主/演示集成|

未在来源明确的公共API类型、输入拒绝范围与宿主缩放换算须在R4实现计划中定义并测试，不假称已有执行校验。S01–S09处置覆盖这些参数对应的功能与无障碍行为。

## 热力：实际源码消费

|参数/数据|消费位置（热力JS）与行为|
|---|---|
|colors、opacities、blurMultipliers、thresholds、blankThreshold|readOptions（75起）：逐级颜色回退；alpha 0–1、blur倍率0–2、阈值0–1、blank 0–.35；buildColorExpression拒绝非严格递增/不高于blank的分段。颜色不是任意字符串已通过校验|
|PROFILE五级常量|buildColorExpression按外内过渡份额与最小平台构建停靠点；不是简单五色等距。固定默认表达式26停靠点；改参数后不能要求所有退化情况仍26个|
|radiusScale、pointRadiusCssPx|influenceRadiusCssPx（175起）：radiusScale clamp .4–4；30*scale + scaledBlur*edgeRadiusShare。30是固定PROFILE基值，不是同名自由参数|
|面积/参考面积/尺寸/倍率界限|readSurfaceSize、surfaceAreaScale（185–230）：显式面积优先，继而尺寸/容器；关闭或面积缺失→1；参考默认642×698，平方根比，默认clamp .25–8；CSS面积不再乘DPR|
|blurCssPx与blurMultipliers|scaledBlurCssPx、buildRadiusExpression（232–244）：等级1用于实际heatmap-radius，feature radiusFactor缺省1；其余等级并非五个独立heatmap图层|
|intensity、opacity、minZoom、maxZoom|buildPaint/buildLayer（246–270）：强度.2–2，透明度0–1；缩放仅有限值检查，默认3/20，未检查min<max|
|sourceId、layerId、beforeId、container、observeSurfaceResize|installLayer（273–310）：缺省ID，只有不存在才add；不更新已存在source的数据；resize按帧合并。destroy只断开observer/取消帧，不移除图层与数据源|
|id/lng/lat/value及别名|normalizeRecords（313起）：数字转换、经度±180/纬度±85.051129/非负值过滤；缺ID按索引补；不能把索引ID当业务稳定ID保证|
|targetBounds、paddingFactor|transformDemoRecords：Mercator一次等比映射；padding .1–1，默认.9；只变换演示数据，不平移真实业务坐标|
|valueMin、valueMax、traffic|recordsToFeatureCollection：未传取全输入极值，span至少.000001；traffic=clamp((value-min)/span,0,1)。全等数据得到零；源码未验证max>min，不能宣称恒定正值也必有热量|

R5适配责任：明确拥有的source/layer与监听，dispose仅移除自有资源；更新/样式重载恢复不靠重复install碰运气；输入校验在变更资源前完成。生命周期完善不应改变来源颜色与核半径算法。

## 冲突与关闭条件

|编号|冲突/缺口|处置与验证责任|
|---|---|---|
|K1|地图文字“回2d收回”与高zoom仍显示、HTML zoom生长冲突|以代码为静态基线；R3运行同zoom模式切换及Z15–16.35曲线，记录画面，不擅改成强制隐藏|
|K2|范围外仅文档与参数，无可运行参考|M15单独重新实现并验收；不得称已从HTML还原|
|K3|散点只有规范/SVG，旧库邻接算法并非逻辑网格|R4新实现明确逻辑与地理模式，按稳定成员/固定CSS尺寸分别测|
|K4|热力文档示例遇坏记录抛错，实际profile normalize过滤|区分实际profile与示例；有效子集按来源过滤，记录坏行；业务入口严格校验策略显式记录，不混入样本|
|K5|来源空数据回退样本与用户业务空隐藏|业务空隐藏；显式来源演示才回退，记录missing/empty/invalid/unavailable；不改变已确认决策|
|K6|能量守恒文字与原生核行为不一致|来源模式优先，物理模式非本次默认；R5不得宣称≤1%已满足|
|K7|固定范围100/零密度透明与reference铺满|遵守既有用户决定；分模式检查零数据和零密度背景；背景着色不代表零数据产生热量|
|K8|来源无完整生命周期与类型校验|R3–R5组件化补齐，原始渲染与工程改动分别记录；R6验证导出，R7验证入库|

PNG延期只对应H09，不影响H01/H04/H05/H06/H07算法。视觉还原、用户取舍、导出、工程验证及发布继续分开记录。本表没有将来源缺失转成已实现能力。

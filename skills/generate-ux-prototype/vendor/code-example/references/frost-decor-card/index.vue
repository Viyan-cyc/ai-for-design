<script setup>
// frost-decor-card — 品牌色块磨砂装饰（设计系统 §7.6 配方）
// 品牌重点卡：不透明品牌蓝渐变底 + 白字内容 + 右上边角磨砂圆形/圆角块。
// 档位：card（几何 1:1）/ panel（缩放 1.35，宽幅概览卡）同页对照。
// 换色系：替换 .brand-card 渐变里的两个色板端点（--brand-50 → --brand-40，浅→深）即可，
// 装饰图形是半透明白无需跟随；换其他色系（如 red-*）须设计侧裁决（§7.6 禁新增紫、粉色相）。
import { ElTag } from 'element-plus'

defineOptions({ name: 'FrostDecorCardPage' })

const cardMetrics = [
  { key: 'total', label: '接入设备', value: '1,286' },
  { key: 'online', label: '在线数', value: '1,274' },
  { key: 'alarm', label: '今日告警', value: '17' },
]
</script>

<template>
  <div class="page-root">
    <div class="demo-grid">
      <!-- 形态一：card 档（装饰几何 1:1） -->
      <section class="brand-card">
        <div class="card-head">
          <div class="card-title">设备运行总览</div>
          <ElTag effect="plain" round class="head-tag">实时</ElTag>
        </div>
        <div class="metric-row">
          <div v-for="m in cardMetrics" :key="m.key" class="metric">
            <div class="metric-label">{{ m.label }}</div>
            <div class="metric-value">{{ m.value }}</div>
          </div>
        </div>
      </section>

      <!-- 形态二：panel 档（装饰缩放 1.35，宽幅概览） -->
      <section class="brand-card brand-card-panel">
        <div class="card-head">
          <div class="card-title">集群健康度</div>
          <ElTag effect="plain" round class="head-tag">本周</ElTag>
        </div>
        <div class="panel-body">
          <div class="panel-score">
            <div class="panel-score-num">98.6</div>
            <div class="panel-score-label">健康分</div>
          </div>
          <div class="panel-desc">
            覆盖 3 个可用区、12 个集群；核心链路 SLA 达标，
            容量水位处于安全区间，无需扩容操作。
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="less">
.page-root {
  min-height: 100%;
  padding: var(--space-size-24);
  background: var(--color-bg-1);
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--space-size-24);
  align-items: start;
}

/* ===== 品牌重点卡（§7.6）=====
   层次：同色相弱渐变底 → 边角磨砂图形（伪元素，无语义）→ 清晰内容（z-index:1）。
   宿主保持不透明色底与原有圆角；不同时启用整块毛玻璃、不嵌套背景模糊。 */
.brand-card {
  position: relative;
  overflow: hidden;
  padding: var(--space-size-24);
  border-radius: var(--radius-size-medium);
  background: linear-gradient(
    115deg,
    var(--brand-50) 0%,
    var(--brand-50) 60%,
    var(--brand-40) 100%
  );
  box-shadow: var(--shadow-5);
}

/* 边角磨砂图形：1–2 个裁切圆形/圆角块，右上与右侧，避开文字。
   几何（card 档）：圆形 d146px top -88px right 2px；圆角块 86px top 42px right -52px
   圆角 20px 旋转 -24°。填充白 gray-0 不透明度 10%→2.5%；描边白 13%、宽随宿主
   --border-width-normal；模糊引用 --frost-blur-control（不编造值）。
   可见面积控制在宿主 10%–20%，不拦截点击、不进键盘焦点、无动画。 */
.brand-card::before,
.brand-card::after {
  position: absolute;
  content: '';
  pointer-events: none;
  border: var(--border-width-normal) solid rgba(255, 255, 255, 0.13);
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(var(--frost-blur-control));
  -webkit-backdrop-filter: blur(var(--frost-blur-control));
}

.brand-card::before {
  top: -88px;
  right: 2px;
  width: 146px;
  height: 146px;
  border-radius: 50%;
}

.brand-card::after {
  top: 42px;
  right: -52px;
  width: 86px;
  height: 86px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.025);
  transform: rotate(-24deg);
}

/* panel 档：装饰几何整体缩放 1.35（146→197、86→116，偏移同步缩放），
   仅宽幅概览卡（≥560px 内容宽）使用。 */
.brand-card-panel::before {
  top: -119px;
  right: 3px;
  width: 197px;
  height: 197px;
}

.brand-card-panel::after {
  top: 57px;
  right: -70px;
  width: 116px;
  height: 116px;
}

/* 内容层：统一反色白，字号/字重分层级；置于装饰之上保证可读。 */
.card-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: var(--font-size-normal1);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-inverse);
}

.head-tag {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.14);
  color: var(--color-text-inverse);
}

.metric-row {
  position: relative;
  z-index: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-size-16);
  margin-top: var(--space-size-20);
}

.metric {
  padding: var(--space-size-12) var(--space-size-16);
  border-radius: var(--radius-size-medium);
  background: rgba(255, 255, 255, 0.08);
}

.metric-label {
  font-size: var(--font-size-small);
  color: var(--color-text-inverse);
  opacity: 0.75;
}

.metric-value {
  margin-top: var(--space-size-4);
  font-family: var(--font-family-numeric);
  font-size: var(--font-size-big);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-inverse);
}

.panel-body {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--space-size-32);
  margin-top: var(--space-size-20);
}

.panel-score {
  flex-shrink: 0;
}

.panel-score-num {
  font-family: var(--font-family-numeric);
  font-size: 40px;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-inverse);
}

.panel-score-label {
  margin-top: var(--space-size-4);
  font-size: var(--font-size-small);
  color: var(--color-text-inverse);
  opacity: 0.75;
}

.panel-desc {
  max-width: 380px;
  font-size: var(--font-size-normal);
  line-height: 1.7;
  color: var(--color-text-inverse);
}

/* ===== 使用规则速记（生成页面前先对照） =====
   1. 选用条件：总览/主指标/品牌展示、大面积单调色底、边角避开文字；
      参考尺寸 ≥240×112，尺寸达标不等于必须装饰。
   2. 额度：同组 1 张主卡，同屏 1 处、最多 2 处；用户要简洁时关闭。
   3. 禁用面：普通卡片/导航/按钮/表格/表单/图表绘图区/告警成功语义色块。
   4. 内容白字须按合成底色过对比度；高光不得压住文本区域。
   5. 深色主题沿用同一几何（品牌蓝不变），无需单独调参。 */
</style>

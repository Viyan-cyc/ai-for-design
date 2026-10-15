<script setup>
// glow-cards — 卡片氛围光两种形态示例（角部高光 / 中心辐射）
// 色相跟语义走：本例角部高光用品牌蓝（信息卡）、中心辐射用告警红（异常场景卡）。
// 换语义换色系即可：告警橙 --orange-10/--orange-05、成功绿用功能色对应 subtle 与浅档，
// 峰值恒取该色系最浅档，各形态写法与通用规则见下方样式注释块。
import { ElIcon, ElTag } from 'element-plus'
import { Odometer, Warning } from '@element-plus/icons-vue'

defineOptions({ name: 'GlowCardsPage' })

const metrics = [
  { key: 'total', label: '设备总量', value: '1,286' },
  { key: 'online', label: '在线率', value: '99.2%' },
  { key: 'alarm', label: '活动告警', value: '17' },
]
</script>

<template>
  <div class="page-root">
    <div class="demo-grid">
      <section class="card corner-glow">
        <div class="card-head">
          <div class="head-icon">
            <ElIcon :size="20"><Odometer /></ElIcon>
          </div>
          <div class="card-head-text">
            <div class="card-title">集群运行总览</div>
            <div class="card-sub">信息卡 · 角部高光形态</div>
          </div>
          <ElTag type="primary" effect="plain" round>常态</ElTag>
        </div>
        <div class="metric-row">
          <div v-for="metric in metrics" :key="metric.key" class="metric">
            <div class="metric-label">{{ metric.label }}</div>
            <div class="metric-value">{{ metric.value }}</div>
          </div>
        </div>
      </section>

      <section class="card center-glow">
        <div class="stage">
          <div class="stage-caption">异常扩散判定：上联抖动 + 同机柜多点掉线</div>
          <div class="stage-node">
            <div class="node-icon">
              <ElIcon :size="16"><Warning /></ElIcon>
            </div>
            <div class="node-text">
              <div class="node-name">AGG-CORE-07</div>
              <div class="node-desc">汇聚核心 · 异常源</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped lang="less">
.page-root {
  display: flex;
  min-height: 100%;
  padding: var(--space-size-24);
  background: var(--color-bg-1);
}

.demo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: var(--space-size-24);
  width: 100%;
  align-items: start;
}

.card {
  border-radius: var(--radius-size-medium);
  overflow: hidden;
}

/* ===== 形态一：角部高光（实底托色的信息卡） =====
   光压住实底、全卡带色；峰值可用次浅档（下方有实底压着，不会读成色块）。
   换色系：把两处 brand 档位成对替换（如 --red-10/--red-05）。 */
.corner-glow {
  position: relative;
  padding: var(--space-size-24);
  background:
    radial-gradient(120% 150% at 0% 0%, var(--brand-10) 0%, transparent 55%),
    var(--brand-05);
  box-shadow: var(--shadow-5);

  &::after {
    position: absolute;
    inset: 0;
    content: '';
    background: linear-gradient(
      100deg,
      color-mix(in srgb, var(--gray-0) 0%, transparent) 30%,
      color-mix(in srgb, var(--gray-0) 50%, transparent) 48%,
      color-mix(in srgb, var(--gray-0) 0%, transparent) 62%
    );
    pointer-events: none;
  }
}

/* ===== 形态二：中心辐射（白底容器内的环境光） =====
   光聚中部、四周留白；峰值只用最浅档，fade 拉满到渐变自身边界（transparent 100%），
   不提前截断——提前截断会出现可见边缘圈。 */
.center-glow {
  border: 1px solid var(--color-border-separator-subtle);
  background: var(--color-bg-5);
  box-shadow: var(--shadow-1);
}

.stage {
  position: relative;
  overflow: hidden;
  margin: var(--space-size-16);
  padding: var(--space-size-32) var(--space-size-24);
  border-radius: var(--radius-size-medium);
  background:
    radial-gradient(
      46% 48% at 50% 44%,
      var(--red-05) 0%,
      transparent 100%
    ),
    var(--color-bg-5);
  box-shadow: inset 0 0 0 1px var(--color-border-separator-subtle);
}

.card-head {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: var(--space-size-12);
}

.head-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: var(--radius-size-medium);
  background: var(--color-bg-5);
  box-shadow: var(--shadow-1);
  color: var(--color-brand);
}

.card-head-text {
  flex: 1;
  min-width: 0;
}

.card-title {
  font-size: var(--font-size-normal1);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.card-sub {
  margin-top: var(--space-size-4);
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
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
  padding: var(--space-size-16);
  border: 1px solid var(--color-border-separator-subtle);
  border-radius: var(--radius-size-medium);
  background: var(--color-bg-5);
  box-shadow: var(--shadow-1);
}

.metric-label {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}

.metric-value {
  margin-top: var(--space-size-8);
  font-family: var(--font-family-numeric);
  font-size: var(--font-size-big);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.stage-caption {
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}

.stage-node {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-size-12);
  margin-top: var(--space-size-20);
  padding: var(--space-size-12) var(--space-size-16);
  border: 1px solid var(--red-30);
  border-radius: var(--radius-size-medium);
  background: var(--color-bg-5);
  box-shadow: var(--shadow-3);
}

.node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-size-normal);
  background: var(--color-error-subtle);
  color: var(--color-error);
}

.node-name {
  font-size: var(--font-size-normal);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.node-desc {
  margin-top: 2px;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
}
</style>

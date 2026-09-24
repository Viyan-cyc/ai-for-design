<script setup>
import { ref } from 'vue'
import { ElRow, ElCol, ElTag, ElButton } from 'element-plus'
import FrostSurface from './frost-surface.vue'

defineOptions({ name: 'FrostMaterial' })

const reduced = ref(false)
</script>

<template>
  <div class="frost-material-page">
    <header class="page-header">
      <h3 class="page-title">毛玻璃材质</h3>
      <p class="page-desc">
        设计系统 §7：材质强调用于标签、次级按钮、概览卡片和轻量浮层；
        常驻毛玻璃总面积为主内容视口的 10%–20%（上限 25%），不必用满。
      </p>
    </header>

    <section class="demo-section">
      <div class="section-head">
        <span class="section-title">三档材质对照</span>
        <ElTag size="small" type="info">control / card / overlay</ElTag>
      </div>
      <div class="frost-backdrop">
        <ElRow :gutter="16">
          <ElCol :xs="24" :md="8">
            <FrostSurface
              level="control"
              title="control 档"
              description="AI 建议、推荐标签、次级工具按钮。同一区域突出 1–3 个，主操作和告警保留原语义。"
            >
              <ElButton size="small" class="solid-action">次级操作</ElButton>
            </FrostSurface>
          </ElCol>
          <ElCol :xs="24" :md="8">
            <FrostSurface
              level="card"
              title="card 档"
              description="指标、智能摘要、概览卡片。同屏重点卡通常 1–3 张。"
            >
              <ElButton size="small" class="solid-action">查看详情</ElButton>
            </FrostSurface>
          </ElCol>
          <ElCol :xs="24" :md="8">
            <FrostSurface
              level="overlay"
              title="overlay 档"
              description="菜单、浮动工具条、轻量面板。背景复杂时优先提高填充不透明度；长篇内容使用实色。"
            >
              <ElButton size="small" class="solid-action">打开面板</ElButton>
            </FrostSurface>
          </ElCol>
        </ElRow>
      </div>
      <p class="section-note">
        渐变背景放在独立父级（frost-backdrop），毛玻璃卡片垫其上；同一位置只保留一层背景模糊。
      </p>
    </section>

    <section class="demo-section">
      <div class="section-head">
        <span class="section-title">薄染色对照（card 档）</span>
        <ElTag size="small" type="info">一页优先一种染色</ElTag>
      </div>
      <ElRow :gutter="16">
        <ElCol :xs="24" :md="12" :lg="6">
          <FrostSurface level="card" title="中性磨砂" description="默认材质，不带染色。" />
        </ElCol>
        <ElCol :xs="24" :md="12" :lg="6">
          <FrostSurface level="card" tint="blue" title="blue 染色" description="色板端点淡彩，浅色 alpha .08 / 深色 .10。" />
        </ElCol>
        <ElCol :xs="24" :md="12" :lg="6">
          <FrostSurface level="card" tint="lavender" title="lavender 染色" description="色板端点淡彩，浅色 alpha .06 / 深色 .08。" />
        </ElCol>
        <ElCol :xs="24" :md="12" :lg="6">
          <FrostSurface level="card" tint="teal" title="teal 染色" description="色板端点淡彩，浅色 alpha .05 / 深色 .07。" />
        </ElCol>
      </ElRow>
      <p class="section-note">
        染色不表达成功、告警等功能状态；淡彩毛玻璃不超过主内容视口的 8%，计入总面积预算。
      </p>
    </section>

    <section class="demo-section">
      <div class="section-head">
        <span class="section-title">交互状态与回退</span>
        <ElTag size="small" type="info">hover +.04 / active +.08 / solid 回退</ElTag>
      </div>
      <label class="reduced-toggle">
        <input v-model="reduced" type="checkbox" />
        <span>模拟减少透明度（data-transparency=&quot;reduced&quot;）</span>
      </label>
      <div class="frost-backdrop" :data-transparency="reduced ? 'reduced' : undefined">
        <ElRow :gutter="16">
          <ElCol :xs="24" :md="8">
            <FrostSurface
              level="card"
              title="hover / active"
              description="悬停或按下这张卡：只调整填充层 alpha（+.04 / +.08）和阴影，不改变模糊强度；active 档阴影为 none。"
            />
          </ElCol>
          <ElCol :xs="24" :md="8">
            <FrostSurface
              level="card"
              title="focus 轮廓"
              description="键盘 Tab 聚焦这张卡：保留当前填充，出现 2px 焦点色外轮廓，偏移 2px。"
              tabindex="0"
            />
          </ElCol>
          <ElCol :xs="24" :md="8">
            <FrostSurface
              level="card"
              title="实色回退"
              :solid="true"
              description="不支持 backdrop-filter 或减少透明度时，使用不透明表面。"
            />
          </ElCol>
        </ElRow>
      </div>
      <p class="section-note">
        卡内按钮为实色——毛玻璃卡内的按钮和标签不再开启 backdrop-filter。
        生产中 data-transparency 放在不支持环境的作用域根上，本页用勾选项演示。
      </p>
    </section>
  </div>
</template>

<style scoped lang="less">
.frost-material-page {
  --page-gutter: var(--space-size-24);
  max-width: 1280px;
  margin: 0 auto;
  padding: var(--page-gutter);
  display: flex;
  flex-direction: column;
  gap: var(--space-size-32);
}

.page-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-8);
}

.page-title {
  margin: 0;
  font-size: var(--font-size-big);
  color: var(--color-text-primary);
  line-height: var(--font-line-height-normal);
}

.page-desc {
  margin: 0;
  max-width: 720px;
  font-size: var(--font-size-normal);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}

.demo-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-size-16);
}

.section-head {
  display: flex;
  align-items: center;
  gap: var(--space-size-12);
}

.section-title {
  font-size: var(--font-size-medium);
  font-weight: 600;
  color: var(--color-text-primary);
}

.section-note {
  margin: 0;
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  line-height: var(--font-line-height-normal);
}

.frost-backdrop {
  position: relative;
  padding: var(--space-size-24);
  border-radius: var(--radius-size-big);
  background:
    radial-gradient(ellipse 70% 100% at 15% 20%, var(--frost-backdrop-blue) 0%, transparent 72%),
    radial-gradient(ellipse 65% 90% at 90% 75%, var(--frost-backdrop-lavender) 0%, transparent 75%),
    var(--frost-backdrop-base);
}

.reduced-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-size-8);
  font-size: var(--font-size-small);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.solid-action {
  background: var(--gray-0);
  border-color: var(--color-border);
  color: var(--color-text-primary);
}
</style>

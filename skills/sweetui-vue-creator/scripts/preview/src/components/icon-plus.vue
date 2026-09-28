<script setup>
// icon-plus — 公司图标（icon+）语义包装组件
// name 命中 fetch-icons 落盘的公司 SVG（icon-barrel）→ 渲染双主题 SVG；
// 未命中 → 回落 SweetUI 自带字体图标 sweetui-icon-{name}-l。
// build 门禁只对 name 做 WARN 级检查（sweetui-icons.json ∪ 已下载 SVG），
// 双落空时字体类名也不存在，渲染为空 <i>（页面可跑）。
import { computed } from 'vue'

const props = defineProps({
  name: { type: String, required: true },
  size: { type: [Number, String], default: undefined },
  color: { type: String, default: undefined },
})

let barrel = {}
try {
  // 预览由 index.gts.html 把 fetch-icons 产物注册为 "icon-barrel" 模块；
  // 真实工程中由构建别名或相对导入提供。静态可解析环境会报错，故容错。
  barrel = (await import('icon-barrel'))?.icons ?? {}
} catch {
  barrel = {}
}

const svgSrc = computed(() => barrel[props.name] ?? null)
const fontClass = computed(() => `sweetui-icon-${props.name}-l`)
const style = computed(() => {
  const s = {}
  if (props.size) s['font-size'] = typeof props.size === 'number' ? `${props.size}px` : props.size
  if (props.color) s.color = props.color
  return s
})
</script>

<template>
  <span v-if="svgSrc" class="swt-icon-pair" :style="style">
    <img class="swt-icon-light" :src="svgSrc.light" alt="" />
    <img class="swt-icon-dark" :src="svgSrc.dark" alt="" />
  </span>
  <i v-else :class="['sweet-icon', fontClass]" :style="style" />
</template>

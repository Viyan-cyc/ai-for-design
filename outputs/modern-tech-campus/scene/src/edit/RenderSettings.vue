<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { Bridge } from './Bridge';
import type { RendererConfig } from '../scene3d/scene-core/types';
import { QUALITY_PRESETS, qualityPreset, SHADOW_SIZES, normalizeRenderer, type QualityPreset } from '../scene3d/scene-core/index';
const props = defineProps<{ bridge: Bridge }>();
const engine = props.bridge.handle.internals.rendererEngine;
const config = ref(engine.getConfig());
const lightSizes = ref(props.bridge.handle.internals.lightEngine.getConfigs());
const revision = ref(0);
const error = ref('');
const fpsCustom = ref(![0, 30, 60].includes(config.value.maxFps ?? 60));
watch(() => config.value.maxFps, value => { fpsCustom.value = ![0, 30, 60].includes(value ?? 60); });
const fpsChoice = computed(() => fpsCustom.value ? 'custom' : String(config.value.maxFps));
const qualityHint = computed(() => ({ fluent: '优先流畅响应，关闭阴影。', balanced: '适度提升清晰度，开启阴影。', fine: '提升清晰度与阴影细节。', custom: '已使用自定义画质参数。' }[preset.value]));
const qualityLabel = computed(() => ({ fluent: '流畅', balanced: '均衡', fine: '精细', custom: '自定义' }[preset.value]));
const help = ref('');
function toggleHelp(key: string): void { help.value = help.value === key ? '' : key; }
function chooseFps(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  fpsCustom.value = value === 'custom';
  if (!fpsCustom.value) apply({ maxFps: Number(value) });
}
const unsubscribe = props.bridge.onState(() => {
  config.value = engine.getConfig();
  lightSizes.value = props.bridge.handle.internals.lightEngine.getConfigs(); revision.value++;
});
const unsubscribeResize = props.bridge.handle.internals.renderLoop.onResize(() => { revision.value++; });
onBeforeUnmount(() => { unsubscribe(); unsubscribeResize(); });
const preset = computed(() => lightSizes.value.some(light => light.castShadow && light.shadowMapSize !== config.value.shadowMapSize)
  ? 'custom' : qualityPreset(config.value));
const pending = computed(() => config.value.antialias !== engine.initialOptions.antialias
  || config.value.logarithmicDepthBuffer !== engine.initialOptions.logarithmicDepthBuffer);
const actual = computed(() => {
  void revision.value;
  const canvas = engine.renderer.domElement;
  return `${canvas.width} × ${canvas.height}`;
});
const deviceRatio = window.devicePixelRatio;
function apply(patch: Partial<RendererConfig>): void {
  error.value = '';
  try { normalizeRenderer({ ...engine.getConfig(), ...patch }); props.bridge.commit('渲染设置', () => props.bridge.handle.update({ renderer: patch })); }
  catch (e) { error.value = e instanceof Error ? e.message : String(e); }
}
function choose(key: QualityPreset): void { apply(QUALITY_PRESETS[key]); }
function number(field: 'pixelRatio' | 'shadowMapSize' | 'maxFps' | 'exposure', event: Event): void {
  const input = event.target as HTMLInputElement;
  if (input.value.trim() === '') { error.value = '请输入数值'; return; }
  const value = Number(input.value);
  if (!Number.isFinite(value) || (field === 'exposure' && value <= 0)) { error.value = '请输入有效数值'; return; }
  apply({ [field]: value });
}
function checked(event: Event): boolean { return (event.target as HTMLInputElement).checked; }
</script>

<template>
  <section class="render-settings ed-sec" aria-label="渲染设置">
    <div class="ed-sec__t">画质与性能</div>
    <div class="setting"><span class="ed-label">画质 <button class="help" aria-label="画质说明" :aria-expanded="help === 'quality'" @click="toggleHelp('quality')">?</button></span>
      <div class="presets" role="group" aria-label="画质档位">
        <button v-for="(label, key) in { fluent: '流畅', balanced: '均衡', fine: '精细' }" :key="key" class="ed-btn"
          :aria-pressed="preset === key" :class="{ 'ed-btn--active': preset === key }" @click="choose(key)">{{ label }}</button>
      </div>
    </div>
    <p class="hint" role="status"><span :class="{ custom: preset === 'custom' }">当前：{{ qualityLabel }}</span> · {{ qualityHint }}</p>
    <p v-if="help === 'quality'" class="help-text">切换档位会应用像素比、阴影开关、算法和全部灯光的阴影分辨率，不改变帧率上限和渲染方式。</p>
    <label class="setting"><span class="ed-label">帧率上限</span><select aria-label="帧率上限" :value="fpsChoice" @change="chooseFps"><option value="30">30 FPS</option><option value="60">60 FPS</option><option value="0">不限制</option><option value="custom">自定义</option></select></label>
    <label v-if="fpsCustom" class="setting"><span class="ed-label">自定义帧率</span><input aria-label="自定义帧率" type="number" min="1" max="240" step="1" :value="config.maxFps || 60" @change="number('maxFps', $event)"></label>
    <div class="setting"><span class="ed-label">渲染方式 <button class="help" aria-label="渲染方式说明" :aria-expanded="help === 'mode'" @click="toggleHelp('mode')">?</button></span><select aria-label="渲染方式" :value="config.renderMode" @change="apply({ renderMode: ($event.target as HTMLSelectElement).value as 'demand' | 'continuous' })"><option value="demand">按需渲染</option><option value="continuous">持续渲染</option></select></div>
    <p v-if="help === 'mode'" class="help-text">按需渲染在静止时休眠，交互、动画与内容变化时恢复；持续渲染按帧率上限绘制。上限不保证实际帧率，不限制仍受设备和屏幕刷新率影响。</p>
    <details>
      <summary><span class="chevron">›</span>高级设置<span class="summary-note">开发者参数</span></summary>
      <label class="setting"><span>实际像素比<small>pixelRatio · 不叠加设备倍率</small></span><input aria-label="实际像素比" type="number" min="0.5" max="2" step="0.05" :value="config.pixelRatio" @change="number('pixelRatio', $event)"></label>
      
      <label class="setting"><span>阴影<small>shadowMap.enabled</small></span><input type="checkbox" :checked="config.shadowMapEnabled" @change="apply({ shadowMapEnabled: checked($event) })"></label>
      <label class="setting"><span>阴影分辨率<small>应用全部灯光</small></span><select aria-label="阴影分辨率" :disabled="!config.shadowMapEnabled" :value="config.shadowMapSize" @change="number('shadowMapSize', $event)"><option v-for="size in SHADOW_SIZES" :key="size" :value="size">{{ size }}</option></select></label>
      <label class="setting"><span>阴影算法<small>shadowMap.type</small></span><select :disabled="!config.shadowMapEnabled" :value="config.shadowMap" @change="apply({ shadowMap: ($event.target as HTMLSelectElement).value as RendererConfig['shadowMap'] })"><option v-for="type in ['Basic', 'PCF', 'PCFSoft', 'VSM']" :key="type">{{ type }}</option></select></label>

      <label class="setting"><span>抗锯齿<small>antialias · 重新打开后生效</small></span><input aria-label="抗锯齿" type="checkbox" :checked="config.antialias" @change="apply({ antialias: checked($event) })"></label>
      <label class="setting"><span>大尺度深度精度<small>logarithmicDepthBuffer · 重新打开后生效</small></span><input aria-label="大尺度深度精度" type="checkbox" :checked="config.logarithmicDepthBuffer" @change="apply({ logarithmicDepthBuffer: checked($event) })"></label>

      <p v-if="pending" class="pending" role="status">保存并回写工程后，重新打开更新后的场景生效。当前初始化值：抗锯齿 {{ engine.initialOptions.antialias ? '开启' : '关闭' }}；对数深度 {{ engine.initialOptions.logarithmicDepthBuffer ? '开启' : '关闭' }}。</p>
      <label class="setting"><span>色调映射</span><select :value="config.toneMapping" @change="apply({ toneMapping: ($event.target as HTMLSelectElement).value as RendererConfig['toneMapping'] })"><option v-for="type in ['NoToneMapping', 'Linear', 'Reinhard', 'Cineon', 'ACESFilmic', 'AgX', 'Neutral']" :key="type">{{ type }}</option></select></label>
      <label class="setting"><span>曝光</span><input type="number" min="0.01" step="0.05" :value="config.exposure" @change="number('exposure', $event)"></label>
      <details class="runtime"><summary><span class="chevron">›</span>当前运行参数</summary><p>设备像素比：{{ deviceRatio }} · 实际倍率：{{ engine.renderer.getPixelRatio() }}</p><p>绘制分辨率：{{ actual }}</p><p>实际 MSAA：{{ engine.renderer.getContext().getContextAttributes()?.antialias ? '开启' : '关闭' }}</p><p>对数深度：{{ engine.initialOptions.logarithmicDepthBuffer ? '开启' : '关闭' }}</p>      <p v-for="light in lightSizes.filter(l => l.castShadow)" :key="light.id" class="hint">{{ light.id }}：{{ light.shadowMapSize ?? 512 }} × {{ light.shadowMapSize ?? 512 }}（{{ config.shadowMapEnabled ? '已启用' : '全局阴影已关闭' }}）</p></details>
    </details>
    <p v-if="error" role="alert" class="error">{{ error }}</p>
  </section>
</template>

<style scoped>
.render-settings { font-size:12px; }
.custom { font-weight:400; letter-spacing:0; }
.setting { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:10px 0; min-height:28px; }
.setting > span { color:var(--ed-dim); font-size:11px; min-width:0; }
.setting small { display:block; font-size:10px; color:var(--ed-dim); margin-top:3px; overflow-wrap:anywhere; }
.setting input[type=number], .setting select { flex:0 0 112px; width:112px; min-width:0; }
.presets { display:flex; flex:1; gap:4px; }
.presets button { flex:1; padding:5px 4px; }
.hint { font-size:11px; color:var(--ed-dim); line-height:1.6; margin:6px 0 12px; }
.help { display:inline-flex; justify-content:center; align-items:center; width:14px; height:14px; padding:0; border:1px solid var(--ed-border); border-radius:50%; background:transparent; color:var(--ed-dim); font-size:10px; cursor:pointer; }
.help:hover, .help[aria-expanded=true] { color:var(--ed-accent); background:var(--ed-accent-soft); }
.help-text { padding:8px 10px; border-radius:var(--ed-radius-s); background:var(--ed-input); color:var(--ed-dim); font-size:11px; line-height:1.7; margin:6px 0 12px; }
summary { display:flex; align-items:center; gap:6px; cursor:pointer; padding:10px 0; list-style:none; color:var(--ed-dim); font-size:11px; }
summary::-webkit-details-marker { display:none; }
.chevron { font-size:16px; line-height:1; transition:transform .15s; }
details[open] > summary > .chevron { transform:rotate(90deg); }
.summary-note { margin-left:auto; font-size:10px; }
.render-settings > details { border-top:1px solid var(--ed-border); margin-top:12px; }
.runtime { margin-top:14px; border-top:1px solid var(--ed-border); }
.runtime p { color:var(--ed-dim); font-size:11px; line-height:1.6; margin:7px 0; overflow-wrap:anywhere; }
.pending { background:#fff5df; border-radius:var(--ed-radius-s); padding:8px 10px; color:#95620a; font-size:11px; line-height:1.7; }
.error { color:var(--ed-danger); font-size:11px; line-height:1.7; }
</style>

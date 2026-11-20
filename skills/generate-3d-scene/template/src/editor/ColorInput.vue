<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { hexToHsv, hsvToHex, kelvinToHex, normalizeHex } from './color-input';
import { vNumberDisplay } from './number-display';

const props = defineProps<{ modelValue: string; label: string; temperature?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', color: string): void; (e: 'begin'): void; (e: 'end'): void }>();
let picking = false;
function pickerEnd(): void { if (picking) { picking = false; emit('end'); } }
function pickerInput(event: Event): void {
  const color = normalizeHex((event.target as HTMLInputElement).value);
  if (!color || color === normalizeHex(props.modelValue)) return;
  temperatureColor = null; kelvin.value = null; error.value = '';
  if (!picking) { picking = true; emit('begin'); }
  emit('update:modelValue', color);
}
onBeforeUnmount(pickerEnd);
const mode = ref('hex');
const error = ref('');
const rememberedHue = ref(0);
const kelvin = ref<number | null>(null);
let temperatureColor: string | null = null;
const hsv = computed<[number, number, number]>(() => {
  const result: [number, number, number] = hexToHsv(props.modelValue) ?? [0, 0, 0];
  if (result[1] === 0) result[0] = rememberedHue.value;
  return result;
});
watch(() => props.modelValue, value => {
  error.value = '';
  const parsed = hexToHsv(value);
  if (parsed && parsed[1] > 0) rememberedHue.value = parsed[0];
  if (value !== temperatureColor) kelvin.value = null;
}, { immediate: true });
function commit(color: string | null): void {
  if (!color) return;
  error.value = '';
  if (color === normalizeHex(props.modelValue)) return;
  emit('begin');
  emit('update:modelValue', color);
  emit('end');
}
function hexChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const color = normalizeHex(input.value);
  if (!color) { error.value = '请输入六位 HEX 色值'; input.value = props.modelValue; return; }
  temperatureColor = null; kelvin.value = null;
  commit(color); input.value = color;
}
function hsvChange(index: number, event: Event): void {
  const input = event.target as HTMLInputElement;
  const values: [number, number, number] = [...hsv.value];
  values[index] = input.value.trim() ? Number(input.value) : NaN;
  const color = hsvToHex(values[0], values[1], values[2]);
  if (!color) { error.value = 'H 为 0–360°，S/V 为 0–100%'; input.value = String(hsv.value[index]); return; }
  rememberedHue.value = values[0]; temperatureColor = null; kelvin.value = null;
  commit(color);
}
function temperatureChange(event: Event): void {
  const input = event.target as HTMLInputElement;
  const value = input.value.trim() ? Number(input.value) : NaN;
  const color = kelvinToHex(value);
  if (!color) { error.value = '色温范围为 1000–40000 K'; input.value = kelvin.value === null ? '' : String(kelvin.value); return; }
  kelvin.value = value; temperatureColor = color; commit(color);
}
</script>

<template>
  <div class="color-input" :data-color-label="label">
    <div class="color-input__line">
      <input type="color" :aria-label="label" :value="normalizeHex(modelValue) ?? '#000000'" @input="pickerInput" @change="pickerEnd" @blur="pickerEnd">
      <select v-model="mode" :aria-label="label + '输入方式'" @change="error = ''">
        <option value="hex">HEX</option><option value="hsv">HSV</option>
        <option v-if="temperature" value="temperature">色温</option>
      </select>
      <input v-if="mode === 'hex'" type="text" class="color-input__hex" :aria-label="label + ' HEX'" :value="modelValue" spellcheck="false" @change="hexChange">
      <template v-if="mode === 'temperature'">
        <input v-number-display="kelvin" type="number" :aria-label="label + ' 色温 K'" :value="kelvin ?? ''" placeholder="色温" title="1000–40000 K；近似换算为颜色，不从当前颜色反推色温" min="1000" max="40000" step="100" @change="temperatureChange">
        <span class="ed-label">K</span>
      </template>
    </div>
    <div v-if="mode === 'hsv'" class="color-input__hsv">
      <label v-for="(axis, i) in ['H °', 'S %', 'V %']" :key="axis">{{ axis }}
        <input v-number-display="hsv[i]" type="number" :aria-label="label + ' ' + axis" :value="hsv[i]" min="0" :max="i === 0 ? 360 : 100" step="0.1" @change="hsvChange(i, $event)">
      </label>
    </div>
    <small v-if="error" role="alert" class="color-input__error">{{ error }}</small>
  </div>
</template>

<style scoped>
.color-input { flex: 1; min-width: 0; }
.color-input__line { display: flex; gap: 6px; align-items: center; min-width: 0; }
.color-input__line + .color-input__line, .color-input__hsv { margin-top: 6px; }
.color-input__line select { flex: 0 0 60px; min-width: 0; padding-inline: 4px; }
.color-input__line input[type=color] { flex: 0 0 40px; }
.color-input__line input:not([type=color]) { flex: 1; width: 0; min-width: 0; }
.color-input__hsv { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.color-input__hsv label { color: var(--ed-dim); font-size: 11px; min-width: 0; }
.color-input__hsv input { display: block; width: 100%; min-width: 0; box-sizing: border-box; }
.color-input__error { display: block; margin-top: 6px; font-size: 11px; white-space: normal; color: var(--ed-dim); }
.color-input__error { color: var(--ed-danger); }
</style>

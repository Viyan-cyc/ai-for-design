<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { ElIcon, ElDropdown, ElDropdownMenu, ElDropdownItem } from 'element-plus'
import { Plus, Promotion, Close, Document, Box, ArrowDown, Check, VideoPause } from '@element-plus/icons-vue'
const props = defineProps({ modelValue: {type:String, default:''}, model:String, models:Array, busy:Boolean, placeholder: {type:String,default:'输入问题，支持 @ 引用文件、/ 调用命令，Shift + Enter 换行'}, references:{type:Array,default:()=>[]}, commands:{type:Array,default:()=>[]} })
const emit=defineEmits(['update:modelValue','update:model','send','stop'])
const modelMenuOpen=ref(false)
const selectedModel=computed(()=>props.models?.find(item=>item.id===props.model)?.label || '选择模型')
const textArea=ref(null)
const fileInput=ref(null)
const attachments=ref([])
const composing=ref(false)
const suggestionIndex=ref(0)
const dismissed=ref(false)
const trigger=computed(()=>props.modelValue.match(/(?:^|\s)([@/])([^\s@/]*)$/))
const suggestions=computed(()=>{
 if (!trigger.value || dismissed.value) return []
 const source=trigger.value[1]==='@'?props.references:props.commands
 return source.filter(x=>x.label.toLowerCase().includes(trigger.value[2].toLowerCase()))
})
const canSend=computed(()=>!!props.modelValue.trim() || !!attachments.value.length)
watch(()=>props.modelValue,async()=>{ dismissed.value=false;suggestionIndex.value=0;await nextTick(); resize() })
function resize(){ if(textArea.value){textArea.value.style.height='auto';textArea.value.style.height=`${Math.min(140,Math.max(32,textArea.value.scrollHeight))}px`} }
function update(event){emit('update:modelValue',event.target.value)}
function choose(item){
 const match=trigger.value
 if(!match) return
 const prefix=props.modelValue.slice(0,props.modelValue.length-match[0].length)
 emit('update:modelValue',`${prefix}${match[0].startsWith(' ')?' ':''}${match[1]==='@'?'@'+item.label:item.value} `)
 textArea.value?.focus()
}
function keydown(event){
 if(event.isComposing || composing.value) return
 if(event.key==='Escape'){dismissed.value=true;return}
 if(suggestions.value.length && ['ArrowDown','ArrowUp'].includes(event.key)){
  event.preventDefault();suggestionIndex.value=(suggestionIndex.value+(event.key==='ArrowDown'?1:-1)+suggestions.value.length)%suggestions.value.length;return
 }
 if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();if(suggestions.value.length) choose(suggestions.value[suggestionIndex.value]);else send()}
}
function send(){if(props.busy||!canSend.value)return;emit('send',{text:props.modelValue.trim(),files:[...attachments.value],model:props.model});attachments.value=[];emit('update:modelValue','')}
function attach(event){attachments.value.push(...Array.from(event.target.files));event.target.value='';textArea.value?.focus()}
</script>
<template>
 <div class="composer-root">
  <div v-if="suggestions.length" class="suggestions" role="listbox" aria-label="引用和命令建议">
   <div class="suggest-title">{{ trigger[1] === '@' ? '引用上下文' : '快捷命令' }}</div>
   <button v-for="(item,index) in suggestions" :key="item.id" role="option" :aria-selected="index===suggestionIndex" :class="{selected:index===suggestionIndex}" @click="choose(item)"><ElIcon><Document /></ElIcon>{{ item.label }}</button>
  </div>
  <div class="composer" :class="{busy}">
   <div v-if="attachments.length" class="attachments"><span v-for="(file,index) in attachments" :key="file.name+'-'+index"><ElIcon><Document /></ElIcon>{{ file.name }}<button :aria-label="`移除${file.name}`" @click="attachments.splice(index,1)"><ElIcon><Close /></ElIcon></button></span></div>
   <textarea ref="textArea" :value="modelValue" :placeholder="placeholder" maxlength="4000" aria-label="对话输入" rows="1" @input="update" @keydown="keydown" @compositionstart="composing=true" @compositionend="composing=false" />
   <div class="tools">
    <input ref="fileInput" type="file" multiple class="file-input" @change="attach" />
    <button class="tool" aria-label="添加附件" title="添加本地附件（不上传）" :disabled="busy" @click="fileInput?.click()"><ElIcon :size="18"><Plus /></ElIcon></button>
    <ElDropdown trigger="click" placement="top-start" popper-class="gts-composer-model-menu" :disabled="busy" @visible-change="modelMenuOpen=$event" @command="emit('update:model',$event)">
     <button type="button" class="model-trigger" :disabled="busy" aria-label="选择模型" aria-haspopup="menu" :aria-expanded="modelMenuOpen"><ElIcon :size="16"><Box /></ElIcon><span>{{ selectedModel }}</span><ElIcon class="model-arrow" :class="{open:modelMenuOpen}" :size="12"><ArrowDown /></ElIcon></button>
     <template #dropdown><ElDropdownMenu><ElDropdownItem v-for="item in models" :key="item.id" :command="item.id" :class="{'model-selected':item.id===model}"><span class="gts-model-option"><span>{{ item.label }}</span><ElIcon class="gts-model-check" :style="{visibility:item.id===model?'visible':'hidden'}"><Check /></ElIcon></span></ElDropdownItem></ElDropdownMenu></template>
    </ElDropdown>
    <span class="counter">{{ busy ? '正在生成…' : modelValue.length ? modelValue.length+' / 4000' : '' }}</span>
    <button v-if="busy" class="send stop" aria-label="停止生成" @click="emit('stop')"><ElIcon :size="18"><VideoPause /></ElIcon></button>
    <button v-else class="send" :disabled="!canSend" aria-label="发送消息" @click="send"><ElIcon :size="18"><Promotion /></ElIcon></button>
   </div>
  </div>
  <p class="disclaimer">内容由 AI 生成，请结合实际业务判断 · 当前为离线交互演示</p>
 </div>
</template>
<style scoped lang="less">
.composer-root { position: relative; width: 100%; --page-composer-border: color-mix(in srgb, var(--color-brand) 18%, var(--color-bg-2)); }
.composer { border: 1px solid var(--page-composer-border); border-radius: var(--radius-size-big2); padding: var(--space-size-12) var(--space-size-16) var(--space-size-8); background: var(--color-bg-2); transition: border-color .18s, box-shadow .18s; }
.composer:focus-within { border-color: var(--color-brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-brand) 9%, transparent); }
textarea { display: block; width: 100%; box-sizing: border-box; border: 0; outline: 0; resize: none; min-height: 32px; max-height: 140px; background: transparent; color: var(--color-text-primary); font: inherit; line-height: var(--font-line-height-normal); padding: var(--space-size-4) 0; }
textarea::placeholder { color: var(--color-text-placeholder); }
.tools { display: flex; align-items: center; gap: var(--space-size-12); margin-top: var(--space-size-8); }
button { cursor: pointer; font: inherit; background: transparent; border: 0; color: var(--color-text-secondary); }
button:focus-visible { outline: 2px solid var(--color-brand); outline-offset: 2px; }
button:disabled { cursor: default; color: var(--color-text-disabled); }
.tool { display: grid; place-items: center; padding: var(--space-size-4); }
.model-trigger { display: flex; align-items: center; gap: var(--space-size-8); padding: var(--space-size-4) var(--space-size-8); border-radius: var(--radius-size-normal); font-size: var(--font-size-small); max-width: 240px; }
.model-trigger span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.model-trigger:hover:not(:disabled) { background: var(--color-hover); color: var(--color-text-primary); }
.model-arrow { flex-shrink: 0; transition: transform .18s; }
.model-arrow.open { transform: rotate(180deg); }
.model-selected { color: var(--color-brand); font-weight: var(--font-weight-bold); }
.counter { flex: 1; text-align: right; font-size: var(--font-size-small); color: var(--color-text-placeholder); }
.send { width: 32px; height: 32px; max-width: 100%; border-radius: var(--radius-size-medium); display: grid; place-items: center; flex-shrink: 0; }
.send:not(:disabled) { background: var(--color-brand); color: var(--color-text-inverse); }
.disclaimer { text-align: center; color: var(--color-text-placeholder); font-size: var(--font-size-small); margin: var(--space-size-8) 0 0; }
.file-input { display: none; }
.attachments { display: flex; flex-wrap: wrap; gap: var(--space-size-8); margin-bottom: var(--space-size-8); }.attachments span { display: flex; align-items: center; gap: var(--space-size-4); background: var(--color-fill); border-radius: var(--radius-size-normal); padding: var(--space-size-4) var(--space-size-8); font-size: var(--font-size-small); max-width: 100%; overflow-wrap: anywhere; }
.suggestions { position: absolute; bottom: 100%; left: 0; width: 100%; background: var(--color-bg-4); border: 1px solid var(--page-composer-border); border-radius: var(--radius-size-medium); box-shadow: var(--shadow-1); padding: var(--space-size-8); box-sizing: border-box; z-index: 5; }
.suggest-title { color: var(--color-text-secondary); font-size: var(--font-size-small); padding: var(--space-size-4) var(--space-size-8); }
.suggestions button { display: flex; gap: var(--space-size-8); align-items: center; width: 100%; text-align: left; padding: var(--space-size-8); border-radius: var(--radius-size-normal); }.suggestions .selected { background: var(--color-select); color: var(--color-brand); }
</style>

<style lang="less">
/* Teleported menu: namespaced so other dropdowns keep their own styling. */
.gts-composer-model-menu.el-popper {
  border-radius: var(--radius-size-medium);
  box-shadow: var(--shadow-1);
}
.gts-composer-model-menu .el-dropdown-menu {
  padding: var(--space-size-8);
  border-radius: var(--radius-size-medium);
}
.gts-composer-model-menu .el-dropdown-menu__item {
  border-radius: var(--radius-size-normal);
  padding: var(--space-size-8) var(--space-size-12);
}
.gts-composer-model-menu .model-selected {
  background: var(--color-select);
  color: var(--color-brand);
  font-weight: var(--font-weight-bold);
}
.gts-composer-model-menu .gts-model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-size-24);
  width: 100%;
}
.gts-composer-model-menu .gts-model-check { flex-shrink: 0; }
</style>

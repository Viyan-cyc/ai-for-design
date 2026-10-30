<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { SweetIcon, SweetSelect, SweetOption, SweetButton } from '@hw-seq/sweet-ui-base'
const props = defineProps({ modelValue: {type:String, default:''}, model:String, models:{type:Array,default:()=>[]}, busy:Boolean, placeholder: {type:String,default:'输入问题，Shift + Enter 换行'}, references:{type:Array,default:()=>[]}, commands:{type:Array,default:()=>[]}, labels:{type:Object,default:()=>({})}, disclaimer:{type:String,default:''} })
const emit=defineEmits(['update:modelValue','update:model','send','stop'])
const labels=computed(()=>({suggestions:'引用和命令建议',references:'引用上下文',commands:'快捷命令',remove:'移除附件',input:'对话输入',attach:'添加附件',model:'选择模型',busy:'正在生成…',stop:'停止生成',send:'发送消息',...props.labels}))
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
 if(!item) return
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
function attach(event){if(props.busy)return;attachments.value.push(...Array.from(event.target.files));event.target.value='';textArea.value?.focus()}
</script>
<template>
 <div class="composer-root">
  <div v-if="suggestions.length" class="suggestions" role="listbox" :aria-label="labels.suggestions">
   <div class="suggest-title">{{ trigger[1] === '@' ? labels.references : labels.commands }}</div>
   <button type="button" v-for="(item,index) in suggestions" :key="item.id" role="option" :aria-selected="index===suggestionIndex" :class="{selected:index===suggestionIndex}" @click="choose(item)"><SweetIcon icon-class="sweetui-icon-file-l" />{{ item.label }}</button>
  </div>
  <div class="composer" :class="{busy}">
   <div v-if="attachments.length" class="attachments"><span v-for="(file,index) in attachments" :key="file.name+'-'+index"><SweetIcon icon-class="sweetui-icon-file-l" />{{ file.name }}<button type="button" :aria-label="labels.remove + file.name" @click="attachments.splice(index,1)"><SweetIcon icon-class="sweetui-icon-close" /></button></span></div>
   <textarea ref="textArea" :value="modelValue" :placeholder="placeholder" maxlength="4000" :aria-label="labels.input" rows="1" @input="update" @keydown="keydown" @compositionstart="composing=true" @compositionend="composing=false" />
   <div class="tools">
    <input ref="fileInput" type="file" multiple class="file-input" @change="attach" />
    <SweetButton class="tool" :aria-label="labels.attach" :disabled="busy" @click="fileInput?.click()"><SweetIcon :size="18" icon-class="sweetui-icon-add-l" /></SweetButton>
    <div v-if="models.length" class="model"><SweetIcon :size="16" icon-class="sweetui-icon-menu-l" /><SweetSelect :model-value="model" :aria-label="labels.model" :disabled="busy" @update:model-value="emit('update:model',$event)"><SweetOption v-for="item in models" :key="item.id" :value="item.id" :label="item.label" /></SweetSelect></div>
    <span class="counter">{{ busy ? labels.busy : modelValue.length ? modelValue.length+' / 4000' : '' }}</span>
    <SweetButton v-if="busy" class="send stop" :aria-label="labels.stop" @click="emit('stop')"><SweetIcon :size="18" icon-class="sweetui-icon-stop-l" /></SweetButton>
    <SweetButton v-else type="primary" class="send" :disabled="!canSend" :aria-label="labels.send" @click="send"><SweetIcon :size="18" icon-class="sweetui-icon-arrow-up" /></SweetButton>
   </div>
  </div>
  <p v-if="disclaimer" class="disclaimer">{{ disclaimer }}</p>
 </div>
</template>
<style scoped>
.composer-root { position: relative; width: 100%; --page-composer-border: color-mix(in srgb, var(--swt-color-accent-normal) 18%, var(--swt-color-bg-primary)); }
.composer { border: 1px solid var(--page-composer-border); border-radius: var(--swt-radius-size-big2); padding: var(--swt-space-size-12) var(--swt-space-size-16) var(--swt-space-size-8); background: var(--swt-color-bg-primary); transition: border-color .18s, box-shadow .18s; }
.composer:focus-within { border-color: var(--swt-color-accent-normal); box-shadow: 0 0 0 3px color-mix(in srgb, var(--swt-color-accent-normal) 9%, transparent); }
textarea { display: block; width: 100%; box-sizing: border-box; border: 0; outline: 0; resize: none; min-height: 32px; max-height: 140px; background: transparent; color: var(--swt-color-text-primary); font: inherit; line-height: var(--swt-font-line-height-normal); padding: var(--swt-space-size-4) 0; }
textarea::placeholder { color: var(--swt-color-text-extra); }
.tools { display: flex; flex-wrap: wrap; align-items: center; gap: var(--swt-space-size-12); margin-top: var(--swt-space-size-8); }
.suggestions button, .attachments button { cursor: pointer; font: inherit; background: transparent; border: 0; color: var(--swt-color-text-secondary); }
.suggestions button:focus-visible,.attachments button:focus-visible { outline: 2px solid var(--swt-color-accent-normal); outline-offset: 2px; }
.suggestions button:disabled { cursor: default; color: var(--swt-color-text-disabled); }
.tool { display: grid; place-items: center; padding: var(--swt-space-size-4); }
.model { display: flex; align-items: center; gap: var(--swt-space-size-4); color: var(--swt-color-text-secondary); min-width: 0; }
.model { max-width: 220px; }
.counter { flex: 1; text-align: right; font-size: var(--swt-font-size-small); color: var(--swt-color-text-extra); }
.send { width: 32px; height: 32px; max-width: 100%; border-radius: var(--swt-radius-size-medium); display: grid; place-items: center; flex-shrink: 0; }

.disclaimer { text-align: center; color: var(--swt-color-text-extra); font-size: var(--swt-font-size-small); margin: var(--swt-space-size-8) 0 0; }
.file-input { display: none; }
.attachments { display: flex; flex-wrap: wrap; gap: var(--swt-space-size-8); margin-bottom: var(--swt-space-size-8); }.attachments span { display: flex; align-items: center; gap: var(--swt-space-size-4); background: var(--swt-color-bg-secondary); border-radius: var(--swt-radius-size-normal); padding: var(--swt-space-size-4) var(--swt-space-size-8); font-size: var(--swt-font-size-small); max-width: 100%; overflow-wrap: anywhere; }
.suggestions { position: absolute; bottom: 100%; left: 0; width: 100%; background: var(--swt-color-bg-primary); border: 1px solid var(--page-composer-border); border-radius: var(--swt-radius-size-medium); box-shadow: var(--swt-shadow1); padding: var(--swt-space-size-8); box-sizing: border-box; z-index: 5; }
.suggest-title { color: var(--swt-color-text-secondary); font-size: var(--swt-font-size-small); padding: var(--swt-space-size-4) var(--swt-space-size-8); }
.suggestions button { display: flex; gap: var(--swt-space-size-8); align-items: center; width: 100%; text-align: left; padding: var(--swt-space-size-8); border-radius: var(--swt-radius-size-normal); }.suggestions .selected { background: var(--swt-color-overlay-gray1-and-accent-normal-opacity10); color: var(--swt-color-accent-normal); }
</style>

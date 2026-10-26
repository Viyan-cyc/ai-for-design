// Concrete native colors for Canvas options; does not register themes on an unrelated ECharts instance.
export function readNativeToken(name){
  const value=getComputedStyle(document.body).getPropertyValue(name).trim()
  if(!value||value.includes('var('))throw new Error('原生token未解析：'+name)
  return value
}
export function nativeChartOptions(input){
  const get=readNativeToken,text=get('--swt-color-text-primary'),secondary=get('--swt-color-text-secondary'),border=get('--swt-color-border'),background=get('--swt-color-bg-primary')
  const axis=a=>({...a,axisLabel:{color:secondary,...a.axisLabel},axisLine:{...a.axisLine,lineStyle:{color:border,...a.axisLine?.lineStyle}},splitLine:{...a.splitLine,lineStyle:{color:border,...a.splitLine?.lineStyle}}})
  const result={...input,color:input.color||Array.from({length:6},(_,i)=>get('--swt-color-chart-A'+(i+1))),backgroundColor:background,textStyle:{color:text,...input.textStyle}}
  const map=(value,fn)=>Array.isArray(value)?value.map(fn):fn(value)
  if(input.title)result.title=map(input.title,item=>({...item,textStyle:{color:text,...item.textStyle}}))
  if(input.legend)result.legend=map(input.legend,item=>({...item,textStyle:{color:secondary,...item.textStyle}}))
  if(input.tooltip)result.tooltip=map(input.tooltip,item=>({backgroundColor:background,borderColor:border,...item,textStyle:{color:text,...item.textStyle}}))
  for(const name of ['xAxis','yAxis'])if(input[name])result[name]=Array.isArray(input[name])?input[name].map(axis):axis(input[name])
  return result
}

import{ElMessageBox}from'element-plus';import{GMessage}from'../components/basic/GMessage';import{GNotification}from'../components/basic/GNotification'
export function usePageFeedback(){
  const saved=(ok=true)=>ok?GMessage.success('保存成功'):GMessage.error('保存失败，请重试')
  const batch=(ok=true,count=0)=>ok?GNotification.success({title:'批量操作完成',message:`已处理 ${count} 项`}):GNotification.error({title:'批量操作失败',message:'请检查失败项后重试'})
   const confirmDelete=(name='所选内容')=>ElMessageBox.confirm(`删除${name}后无法恢复，是否继续？`,'确认删除',{type:'warning',confirmButtonText:'删除',cancelButtonText:'取消'})
  return{saved,batch,confirmDelete}
}

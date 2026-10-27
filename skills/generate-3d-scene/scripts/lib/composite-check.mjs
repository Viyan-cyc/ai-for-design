import {createRequire} from 'node:module';
import {dependencyPath} from './environment.mjs';
const ts=createRequire(import.meta.url)(dependencyPath('typescript'));
/** Conservative checks of direct composite calls. No execution or browser simulation. */
export function checkCompositeSource(source,file='handler.ts'){
 const sf=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),errors=[];
 const report=(node,message)=>{const p=sf.getLineAndCharacterOfPosition(node.getStart(sf));errors.push(`${file}:${p.line+1}:${p.character+1} ${message}`);};
 const method=n=>ts.isCallExpression(n)&&ts.isPropertyAccessExpression(n.expression)?n.expression.name.text:null;
 const literal=n=>n&&(ts.isStringLiteral(n)||ts.isNoSubstitutionTemplateLiteral(n))?n.text:null;
 const visit=n=>{
  if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer&&ts.isCallExpression(n.initializer)&&ts.isIdentifier(n.initializer.expression)&&n.initializer.expression.text==='createComposite'){
   const name=n.name.text,block=n.parent.parent.parent;
   if(!ts.isBlock(block))return;
   const names=new Set();let ended=false;
   // Only unconditional direct statement order is used for lifetime/duplicate analysis.
   for(const statement of block.statements){
    if(statement.end<=n.end)continue;
    const calls=[];const gather=x=>{if(x!==statement&&(ts.isFunctionLike(x)||ts.isBlock(x)||ts.isIfStatement(x)||ts.isSwitchStatement(x)))return;if(method(x)&&x.expression.expression.getText(sf)===name)calls.push(x);ts.forEachChild(x,gather);};
    const isLoop=ts.isForStatement(statement)||ts.isForOfStatement(statement)||ts.isForInStatement(statement)||ts.isWhileStatement(statement);
    if(ts.isForOfStatement(statement)&&ts.isArrayLiteralExpression(statement.expression)&&statement.expression.elements.length>1){
     const loopWalk=x=>{if(ts.isFunctionLike(x))return;const m=method(x);if(['mesh','batchSlot'].includes(m)&&x.expression.expression.getText(sf)===name){const value=literal(x.arguments[0]);if(value!==null)report(x,`Composite: 循环内重复声明槽位 ${value}；使用稳定索引/方向名称，或循环外 batchSlot + add。`);}ts.forEachChild(x,loopWalk);};loopWalk(statement);
    }
    if(ts.isIfStatement(statement)||isLoop||ts.isSwitchStatement(statement)||ts.isTryStatement(statement))continue;
    gather(statement);
    for(const call of calls){const m=method(call);if(!['mesh','batch','batchSlot','finish'].includes(m))continue;
     if(ended)report(call,`Composite ${name}: finish() 后调用 ${m}()；把 finish() 放到全部槽位创建之后，只调用一次。`);
     if(m==='finish'){ended=true;continue;}
     const value=literal(call.arguments[0]);if(value!==null&&['mesh','batchSlot'].includes(m)){if(names.has(value))report(call,`Duplicate slot: ${value}；同一 builder 内名称必须唯一。`);names.add(value);}
    }
   }
   const inspect=x=>{if(x!==block&&ts.isFunctionLike(x))return;const m=method(x);if(['mesh','batch','batchSlot'].includes(m)&&x.expression.expression.getText(sf)===name){const arg=x.arguments[0],value=literal(arg);if(value!==null&&!/^[a-z][a-z0-9_]*$/.test(value))report(x,`Invalid slot name: ${value}；仅允许小写字母开头及小写字母、数字、下划线。`);
    if(arg&&ts.isTemplateExpression(arg)){for(const span of arg.templateSpans){let parent=x;while(parent&&parent!==block){if(ts.isForOfStatement(parent)&&ts.isArrayLiteralExpression(parent.expression)&&parent.initializer.getText(sf).replace(/^(const|let|var)\s+/,'')===span.expression.getText(sf)&&parent.expression.elements.some(e=>ts.isPrefixUnaryExpression(e)&&e.operator===ts.SyntaxKind.MinusToken))report(x,'Composite: 槽位名直接插入正负坐标会产生负号；将方向映射为 neg/pos，位置数值仅用于 transform。');parent=parent.parent;}}}
   }ts.forEachChild(x,inspect);};inspect(block);
  }
  ts.forEachChild(n,visit);
 };visit(sf);return [...new Set(errors)];
}

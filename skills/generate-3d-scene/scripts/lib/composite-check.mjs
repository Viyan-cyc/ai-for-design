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
   const names=new Set(),materials=new Map();let ended=false;
   // Prove identity only for fresh constructors and immutable local aliases.
   const identity=(expr,seen=new Set())=>{
    if(!expr)return null;
    if(ts.isNewExpression(expr))return expr;
    if(ts.isIdentifier(expr)&&!seen.has(expr.text)){
     seen.add(expr.text);
     for(const stmt of block.statements){
      if(stmt.pos>=expr.pos)break;
      if(ts.isVariableStatement(stmt)&&(stmt.declarationList.flags&ts.NodeFlags.Const)){
       const decl=stmt.declarationList.declarations.find(d=>ts.isIdentifier(d.name)&&d.name.text===expr.text);
       if(decl)return identity(decl.initializer,seen);
      }
     }
    }
    return null;
   };
   // Only unconditional direct statement order is used for lifetime/duplicate analysis.
   for(const statement of block.statements){
    if(statement.end<=n.end)continue;
    const calls=[];const gather=x=>{if(x!==statement&&(ts.isFunctionLike(x)||ts.isBlock(x)||ts.isIfStatement(x)||ts.isSwitchStatement(x)))return;if(method(x)&&x.expression.expression.getText(sf)===name)calls.push(x);ts.forEachChild(x,gather);};
    const isLoop=ts.isForStatement(statement)||ts.isForOfStatement(statement)||ts.isForInStatement(statement)||ts.isWhileStatement(statement);
    if(ts.isForOfStatement(statement)&&ts.isArrayLiteralExpression(statement.expression)&&statement.expression.elements.length>1){
     let exits=false;const exitWalk=x=>{if(ts.isFunctionLike(x))return;if(ts.isBreakStatement(x)||ts.isReturnStatement(x)||ts.isThrowStatement(x)||ts.isContinueStatement(x))exits=true;ts.forEachChild(x,exitWalk);};exitWalk(statement.statement);
     const loopWalk=x=>{if(ts.isFunctionLike(x)||ts.isIfStatement(x)||ts.isSwitchStatement(x)||ts.isTryStatement(x))return;const m=method(x);if(['mesh','batchSlot'].includes(m)&&x.expression.expression.getText(sf)===name){const value=literal(x.arguments[0]);if(value!==null)report(x,`Composite: 循环内重复声明槽位 ${value}；使用稳定索引/方向名称，或循环外 batchSlot + add。`);}if(m==='batch'&&x.expression.expression.getText(sf)===name&&literal(x.arguments[0])!==null&&x.arguments[2]&&ts.isNewExpression(x.arguments[2]))report(x,`Composite batch ${literal(x.arguments[0])}: 循环中反复 new 材质会产生不同实例；循环外 batchSlot(name, material)，循环内 slot.add(geometry, transform)。`);ts.forEachChild(x,loopWalk);};if(!exits)loopWalk(statement);
    }
    if(ts.isIfStatement(statement)||isLoop||ts.isSwitchStatement(statement)||ts.isTryStatement(statement))continue;
    gather(statement);
    for(const call of calls){const m=method(call);if(!['mesh','batch','batchSlot','finish'].includes(m))continue;
     if(ended)report(call,`Composite ${name}: finish() 后调用 ${m}()；把 finish() 放到全部槽位创建之后，只调用一次。`);
     if(m==='finish'){ended=true;continue;}
     const value=literal(call.arguments[0]);
     if(value!==null&&['batch','batchSlot'].includes(m)){
      const token=identity(call.arguments[m==='batch'?2:1]);
      if(token&&materials.has(value)&&materials.get(value)!==token)report(call,`Batch ${value} must use the same material instance；请复用循环外声明的材质，优先 batchSlot + add；不同材质使用不同槽位名。`);
      if(token)materials.set(value,token);
     }
     if(value!==null&&['mesh','batchSlot'].includes(m)){if(names.has(value))report(call,`Duplicate slot: ${value}；同一 builder 内名称必须唯一。`);names.add(value);}
    }
   }
   const inspect=x=>{if(x!==block&&ts.isFunctionLike(x))return;const m=method(x);if(['mesh','batch','batchSlot'].includes(m)&&x.expression.expression.getText(sf)===name){const arg=x.arguments[0],value=literal(arg);if(value!==null&&!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(value))report(x,`Invalid slot name: ${value}；允许字母或下划线开头，后接大小写字母、数字、下划线或连字符；斜线保留给槽位路径。`);
   }ts.forEachChild(x,inspect);};inspect(block);
  }
  ts.forEachChild(n,visit);
 };visit(sf);return [...new Set(errors)];
}

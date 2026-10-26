/** Small local-process lock. Dead owners are recovered; live owners are never killed. */
import {openSync,writeFileSync,readFileSync,closeSync,unlinkSync} from 'node:fs';
export function acquireFileLock(path,{timeoutMs=3000}={}) {
 const deadline=Date.now()+timeoutMs;const identity=JSON.stringify({pid:process.pid,nonce:Math.random().toString(36)});
 for(;;){try{const fd=openSync(path,'wx');try{writeFileSync(fd,identity);}finally{closeSync(fd);}return ()=>{try{if(readFileSync(path,'utf8')===identity)unlinkSync(path);}catch{}};}catch(e){if(e.code!=='EEXIST')throw e;
 try{const value=readFileSync(path,'utf8'),owner=JSON.parse(value);if(Number.isInteger(owner.pid)&&owner.pid>0){let dead=false;try{process.kill(owner.pid,0);}catch(err){dead=err.code==='ESRCH';}if(dead&&readFileSync(path,'utf8')===value){try{unlinkSync(path);}catch{}continue;}}}catch{}
 if(Date.now()>=deadline)throw new Error('Package is busy; retry after the current operation');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,25);
 }}
}
export function withFileLock(path,action){const release=acquireFileLock(path);try{return action();}finally{release();}}

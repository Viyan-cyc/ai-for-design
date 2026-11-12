import {readFile,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import baseline from '../src/baseline.json' with {type:'json'};
const root=new URL('../../../docs/create-3d-component/component-authoring-work/n2-isolated-grid/',import.meta.url);
for(const row of baseline.sources){const relative=row.path.slice('baseline/'.length);const target=new URL(relative==='docs/components/grid/demo.ts'?'reference/grid-demo.ts':relative,root);const stat=await lstat(target);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Expected real baseline file '+fileURLToPath(target));const actual=createHash('sha256').update(await readFile(target)).digest('hex');if(actual!==row.sha256)throw Error('Baseline mismatch '+relative);}
console.log('Isolated baseline verified: '+baseline.sources.length+' files');

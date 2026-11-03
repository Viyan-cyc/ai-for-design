import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {packageDelivery} from '../../skills/generate-3d-scene/template/scripts/package-delivery.mjs';
const out=fs.mkdtempSync(join(tmpdir(),'in-place-')),root=join(out,'source');
const put=(path,data)=>{fs.mkdirSync(join(path,'..'),{recursive:true});fs.writeFileSync(path,data);};
try {
 put(join(root,'src/user.ts'),'original');put(join(root,'offline/index.3d.html'),'<script src="./scene.js"></script>');put(join(root,'offline/scene.js'),'one');
 assert.equal(packageDelivery(root),join(out,'index.3d.html'));packageDelivery(root);
 put(join(out,'.history/entry.txt'),'history');put(join(out,'user.zip'),'asset');put(join(out,'preview/user.txt'),'notes');put(join(root,'src/user.ts'),'USER EDIT');put(join(root,'offline/scene.js'),'two');
 packageDelivery(root);
 for(const [p,value] of [['.history/entry.txt','history'],['user.zip','asset'],['preview/user.txt','notes'],['source/src/user.ts','USER EDIT'],['preview/scene.js','two']])assert.equal(fs.readFileSync(join(out,p),'utf8'),value);
 put(join(root,'offline/user.txt'),'collision');assert.throws(()=>packageDelivery(root),/非管理内容/);fs.unlinkSync(join(root,'offline/user.txt'));
 put(join(out,'preview/scene.js'),'manual');assert.throws(()=>packageDelivery(root),/已修改/);put(join(out,'preview/scene.js'),'two');
 const baseline=fs.readFileSync(join(out,'preview/.scene3d-preview-baseline.json'),'utf8');
 put(join(root,'offline/scene.js'),'three');
 const rename=fs.renameSync;let count=0;fs.renameSync=(...args)=>{if(++count===2)throw new Error('injected rename');return rename(...args);};syncBuiltinESMExports();
 try{assert.throws(()=>packageDelivery(root),/injected/);}finally{fs.renameSync=rename;syncBuiltinESMExports();}
 assert.equal(fs.readFileSync(join(out,'preview/scene.js'),'utf8'),'two');assert.equal(fs.readFileSync(join(out,'preview/.scene3d-preview-baseline.json'),'utf8'),baseline);
 packageDelivery(root);assert.equal(fs.readFileSync(join(out,'preview/scene.js'),'utf8'),'three');
 console.log('PASS in-place repeat, source/history/attachments preserved, collisions rejected, publication failure rollback');
}finally{assert(out.startsWith(join(tmpdir(),'in-place-')));fs.rmSync(out,{recursive:true,force:true});}

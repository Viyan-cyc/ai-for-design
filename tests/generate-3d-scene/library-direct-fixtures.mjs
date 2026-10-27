import assert from 'node:assert/strict';
import fs from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {downloadCandidate} from '../../skills/generate-3d-scene/scripts/lib/asset-service.mjs';
import {receive,inject,loadPackage} from '../../skills/generate-3d-scene/scripts/lib/designer-assets.mjs';
import {triangleGlb} from './asset-fixture-data.mjs';
const root=fs.mkdtempSync(resolve(tmpdir(),'library-direct-'));
const server=createServer((req,res)=>{res.writeHead(200);res.end(triangleGlb());});await new Promise(r=>server.listen(0,'127.0.0.1',r));
try {
 const origin=`http://127.0.0.1:${server.address().port}`,pkg=resolve(root,'remote'),project=resolve(root,'project');
 await downloadCandidate({remoteId:'rack',name:'机柜',entryUrl:origin+'/rack.glb'},pkg,{endpoint:origin+'/search',allowedOrigins:[origin]});
 assert.equal(loadPackage(pkg).confirmation,null);assert.equal(loadPackage(pkg).assets[0].technicalStatus,'structure_valid');
 assert.equal(inject(pkg,project).length,1);assert.equal(inject(pkg,project).length,1);
 const input=resolve(root,'upload-input');fs.mkdirSync(input);fs.writeFileSync(resolve(input,'rack.glb'),triangleGlb());const upload=resolve(root,'upload');receive(input,upload,'设计师包');assert.throws(()=>inject(upload,resolve(root,'upload-project')),/confirmation/);
 const a=loadPackage(pkg).assets[0];fs.appendFileSync(resolve(pkg,'files',a.entry),'changed');assert.throws(()=>inject(pkg,resolve(root,'changed-project')));
 console.log('PASS library download -> inject without browser/confirmation; repeat injection; upload confirmation retained; changed file rejected');
}finally{await new Promise(r=>server.close(r));}


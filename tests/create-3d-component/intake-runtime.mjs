// Template-specific lifecycle assertions. Real candidates need their own reviewed assertions.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
const [copy,category,name]=process.argv.slice(2),require=createRequire(join(copy,'package.json'));
const THREE=await import(pathToFileURL(join(copy,'node_modules/three/build/three.module.js')));
for(const lib of [await import(pathToFileURL(join(copy,'dist/es',category+'.js'))),require(join(copy,'dist/cjs',category+'.cjs'))]) {
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());root.add(mesh);const material=mesh.material,geometry=mesh.geometry;let borrowed=0;geometry.addEventListener('dispose',()=>borrowed++);
 if(name==='AuthoredComponent') {const c=new lib[name]({size:1.5});root.add(c);assert.equal(c.children[0].scale.x,1.5);c.setOptions({size:1.2});assert.equal(c.children[0].scale.x,1.2);assert.throws(()=>c.setOptions({size:99}));c.dispose();c.dispose();}
 else if(name==='HostHighlight'){let wakes=0;const c=new lib[name]({root,targets:[mesh],invalidate:()=>wakes++});c.setOptions({enabled:false});assert.equal(root.children.at(-1).visible,false);c.setOptions({enabled:true});assert.equal(c.tick(.1),false);c.dispose();c.dispose();assert(wakes>0);}
 else throw Error('此测试仅验证两个模板，不能代替新组件功能测试');
 assert.deepEqual(root.children,[mesh]);assert.equal(mesh.material,material);assert.equal(mesh.geometry,geometry);assert.equal(borrowed,0);
}
console.log('PASS ESM/CJS constructor, parameters, lifecycle, borrowed resource preservation');

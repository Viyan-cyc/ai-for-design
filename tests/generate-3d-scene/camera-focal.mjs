import assert from 'node:assert/strict';
import {focalFromFov,fovFromFocal,supportsFocal} from '../../skills/generate-3d-scene/template/src/edit/camera-focal.ts';
for(const fov of [1.01,10,27,50,73.123456789,120,178.99])assert.ok(Math.abs(fovFromFocal(focalFromFov(fov))-fov)<1e-10);
assert.ok(Math.abs(fovFromFocal(50)-26.991466561591622)<1e-10);
for(const n of [0,-1,NaN,Infinity,1e-20,1e20])assert.equal(fovFromFocal(n),null);
assert.equal(focalFromFov(180),null);
assert.equal(supportsFocal({isPerspectiveCamera:true,zoom:1}),true);
for(const c of [{isPerspectiveCamera:false,zoom:1},{isPerspectiveCamera:true,zoom:2},{isPerspectiveCamera:true,zoom:1,view:{enabled:true}},{isPerspectiveCamera:true,zoom:1,filmOffset:1}])assert.equal(supportsFocal(c),false);
console.log('PASS: focal conversion, invalid values and unsupported projections');

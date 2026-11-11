import * as THREE from '../vendor/three.module.js';
export function create(scene,preset){const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial({color:preset.design.color}),mesh=new THREE.Mesh(geometry,material);scene.add(mesh);let disposed=false;
return {update(p){mesh.scale.setScalar(p.design.size);material.color.set(p.design.color);},tick(){return false;},snapshot(){return {kind:'static-cube'};},dispose(){if(disposed)return;disposed=true;scene.remove(mesh);geometry.dispose();material.dispose();}};}

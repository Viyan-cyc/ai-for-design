import assert from 'node:assert/strict';
import { materialParamDisabledReason as reason } from '../../skills/generate-3d-scene/template/src/edit/material-conditions.ts';
const groups = {
  clearcoat: ['clearcoatRoughness', 'clearcoatNormalScale'],
  sheen: ['sheenColor', 'sheenRoughness'],
  iridescence: ['iridescenceIOR', 'iridescenceThicknessRange'],
  anisotropy: ['anisotropyRotation'],
};
for (const [strength, children] of Object.entries(groups)) {
  for (const value of [undefined, 0, 0.0001, 0.5]) {
    const spec = {type: 'MeshPhysicalMaterial', [strength]: value};
    const before = JSON.stringify(spec);
    assert.equal(reason(spec, strength), '');
    for (const child of children) assert.equal(Boolean(reason(spec, child)), !(value > 0));
    assert.equal(JSON.stringify(spec), before);
  }
}
for (const key of ['ior', 'thickness', 'transmission', 'specularIntensity', 'roughness']) {
  assert.equal(reason({type: 'MeshPhysicalMaterial'}, key), '');
}
console.log('material-conditions: passed');

/** Metadata computed when rebuilding the index, never by the generating LLM. */
import { readFileSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';

import { runtimeCompatibility } from '../../template/scripts/runtime-compatibility.mjs';
export { runtimeCompatibility };
export function assetMetadata(doc, libDir) {
  const bbox = doc.report?.bbox ?? doc.bbox;
  const valid = bbox && [bbox.min, bbox.max].every((v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite));
  const result = {
    bbox: valid ? { min: bbox.min, max: bbox.max, size: bbox.max.map((v, i) => v - bbox.min[i]) } : null,
    triangles: doc.report?.triangles ?? doc.polycount ?? null,
    units: doc.units ?? 'unverified',
    compatibility: { status: 'unknown', scope: 'loader-extensions-only' },
  };
  try {
    const root = resolve(libDir);
    const path = resolve(root, String(doc.modelPath ?? '').replace(/^assets[\\/]/, ''));
    const rel = relative(root, path);
    if (!doc.modelPath || isAbsolute(rel) || rel === '..' || rel.startsWith('..\\') || rel.startsWith('../')) throw new Error('Invalid model path');
    const bytes = readFileSync(path);
    let gltf;
    if (/\.gltf$/i.test(path)) gltf = JSON.parse(bytes.toString('utf8'));
    else {
      if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error('Invalid GLB');
      gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8').trim());
    }
    result.bytes = bytes.length;
    result.compatibility = runtimeCompatibility(gltf);
  } catch (e) { result.compatibility.reason = e.message; }
  return result;
}

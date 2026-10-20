const supported = new Set(['KHR_draco_mesh_compression', 'KHR_materials_unlit', 'KHR_materials_clearcoat',
  'KHR_materials_dispersion', 'KHR_materials_ior', 'KHR_materials_specular', 'KHR_materials_transmission',
  'KHR_materials_volume', 'KHR_materials_sheen', 'KHR_materials_emissive_strength', 'KHR_materials_iridescence',
  'KHR_materials_anisotropy', 'KHR_texture_transform', 'KHR_mesh_quantization', 'KHR_lights_punctual',
  'EXT_texture_webp', 'EXT_texture_avif', 'EXT_mesh_gpu_instancing']);
export function runtimeCompatibility(gltf) {
  const used = gltf.extensionsUsed || [];
  const required = gltf.extensionsRequired || [];
  const missing = [...new Set([...required.filter((x) => !supported.has(x)),
    ...used.filter((x) => ['KHR_texture_basisu', 'EXT_meshopt_compression', 'KHR_meshopt_compression'].includes(x))])];
  return { status: missing.length ? 'unsupported' : 'supported', missing, extensionsUsed: used,
    extensionsRequired: required, scope: 'loader-extensions-only' };
}

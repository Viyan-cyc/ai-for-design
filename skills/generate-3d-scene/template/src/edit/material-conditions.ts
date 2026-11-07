/** UI prerequisites only; never clear or rewrite dormant material properties. */
const prerequisites: Record<string, { key: string; label: string }> = {
  clearcoatRoughness: { key: 'clearcoat', label: '清漆强度' },
  clearcoatNormalScale: { key: 'clearcoat', label: '清漆强度' },
  sheenColor: { key: 'sheen', label: '织物光泽' },
  sheenRoughness: { key: 'sheen', label: '织物光泽' },
  iridescenceIOR: { key: 'iridescence', label: '虹彩强度' },
  iridescenceThicknessRange: { key: 'iridescence', label: '虹彩强度' },
  anisotropyRotation: { key: 'anisotropy', label: '各向异性强度' },
};
export function materialParamDisabledReason(spec: Record<string, unknown>, key: string): string {
  if (spec.type !== 'MeshPhysicalMaterial') return '';
  const prerequisite = prerequisites[key];
  if (!prerequisite) return '';
  return typeof spec[prerequisite.key] === 'number' && Number(spec[prerequisite.key]) > 0
    ? '' : `先提高${prerequisite.label}`;
}

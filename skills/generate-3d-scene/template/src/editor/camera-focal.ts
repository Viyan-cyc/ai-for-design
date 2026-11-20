/** Fixed sensor height is a UI convention; camera.fov remains the stored value. */
export const SENSOR_HEIGHT_MM = 24;
export function focalFromFov(fov: number): number | null {
  if (!Number.isFinite(fov) || fov <= 0 || fov >= 180) return null;
  return SENSOR_HEIGHT_MM / (2 * Math.tan(fov * Math.PI / 360));
}
export function fovFromFocal(mm: number): number | null {
  if (!Number.isFinite(mm) || mm <= 0) return null;
  const fov = 2 * Math.atan(SENSOR_HEIGHT_MM / (2 * mm)) * 180 / Math.PI;
  return fov >= 1 && fov <= 179 ? fov : null;
}
export function supportsFocal(camera: { isPerspectiveCamera?: boolean; zoom?: number; filmOffset?: number; view?: { enabled: boolean } | null }): boolean {
  return camera.isPerspectiveCamera === true && camera.zoom === 1
    && (camera.filmOffset ?? 0) === 0 && !camera.view?.enabled;
}

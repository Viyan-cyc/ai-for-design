import type { Map } from 'maplibre-gl';
export class MapExperience {
  constructor(map: Map, options?: Record<string, unknown>);
  state: Record<string, unknown>;
  applyThemeMode(mode: 'light' | 'dark'): void;
  switchViewMode(mode: '2d' | '3d'): void;
  themeValues(mode: string): Record<string, unknown>;
  buildingGrowthExpression(height: unknown): unknown;
  dispose(): void;
}

import maplibregl, { type Map as LibreMap } from 'maplibre-gl';
import { MapScatterLayer, MapHeatLayer, clusterScatter, heatFeatures, validateHeatOptions, resolveScatterColor, type MapHeatOptions, type MapHeatRecord, type MapScatterOptions, type MapScatterRecord } from '@a3d/a3d-components/map';
import { h, render, type Component, type AppContext } from 'vue';

type Common = { id: string; name?: string; visible?: boolean; locked?: boolean };
export type MapOverlayConfig = Common & (
  | { kind: 'scatter'; options?: Omit<MapScatterOptions, 'onSelect' | 'theme'>; data: MapScatterRecord[];
      card?: { type: string; props?: Record<string, unknown> } }
  | { kind: 'heat'; options: Omit<MapHeatOptions, 'id' | 'visible' | 'container'>; data: MapHeatRecord[] }
);

/** Template glue: serializable scene configuration and externally registered business Vue cards. */
export class MapOverlays {
  private map: LibreMap;
  private configs: MapOverlayConfig[] = [];
  private layers = new Map<string, MapScatterLayer | MapHeatLayer>();
  private theme: 'light' | 'dark';
  private cards: Record<string, Component>;
  private appContext?: AppContext;
  private popup?: maplibregl.Marker;
  private cardElement?: HTMLDivElement;
  private selected?: { layerId: string; pointId: string };
  constructor(map: LibreMap, theme: 'light' | 'dark', cards: Record<string, Component>, appContext?: AppContext) {
    this.map = map; this.theme = theme; this.cards = cards; this.appContext = appContext;
  }
  snapshot(): MapOverlayConfig[] { return structuredClone(this.configs); }
  setTheme(theme: 'light' | 'dark'): void {
    this.theme = theme;
    for (const layer of this.layers.values()) if (layer instanceof MapScatterLayer) layer.setOptions({ theme });
  }
  replace(configs: MapOverlayConfig[]): void {
    const nextConfigs = structuredClone(configs).map(config => {
      if (config.kind === 'heat') config.options.displayMode ??= config.options.blankThreshold !== undefined && config.options.blankThreshold <= 0.0001 ? 'reference' : 'transparent';
      return config;
    });
    const ids = new Set<string>();
    for (const config of nextConfigs) {
      if (!/^[a-z][a-z0-9_]*$/.test(config.id) || ids.has(config.id) || !['heat', 'scatter'].includes(config.kind)
          || !Array.isArray(config.data)) throw new Error('地图叠加层配置或 ID 无效');
      ids.add(config.id);
      if (config.kind === 'scatter') clusterScatter(config.data, this.map.getZoom(), config.options);
      else {
        validateHeatOptions({ ...config.options, id: `a3d_heat_${config.id}` });
        heatFeatures(config.data, config.options.valueRange);
        if (config.options.beforeId && !this.map.getLayer(config.options.beforeId)) throw new Error('Unknown heat beforeId');
      }
    }
    const previousConfigs = this.configs;
    const previousSelection = this.selected;
    try {
      this.applyLayers(nextConfigs);
    } catch (error) {
      // Creation can still fail (e.g. Canvas allocation), after validation succeeded.
      // Keep the last committed document and restore its visual resources.
      try {
        for (const layer of this.layers.values()) layer.dispose();
        this.layers.clear();
        this.applyLayers(previousConfigs);
        this.selected = previousSelection;
        if (previousSelection) {
          const layer = this.layers.get(previousSelection.layerId);
          if (layer instanceof MapScatterLayer) layer.select(previousSelection.pointId);
        }
        this.refreshCard();
      } catch (restoreError) {
        throw Object.assign(new Error('Overlay update failed and restoration failed'), { errors: [error, restoreError] });
      }
      throw error;
    }
    this.configs = nextConfigs;
    this.refreshCard();
  }
  private applyLayers(configs: MapOverlayConfig[]): void {
    const previousConfigs = this.configs;
    // Configurations are full replacements, matching scene map update semantics.
    for (const [id, layer] of this.layers) {
      const next = configs.find(config => config.id === id);
      const previous = this.configs.find(config => config.id === id);
      if (!next || next.kind !== previous?.kind || JSON.stringify(next.options) !== JSON.stringify(previous.options)) {
        layer.dispose(); this.layers.delete(id);
      }
    }
    for (const config of configs) {
      let layer = this.layers.get(config.id);
      if (!layer) {
        layer = config.kind === 'heat'
          ? new MapHeatLayer(this.map, { ...config.options, id: `a3d_heat_${config.id}`, visible: config.visible }, config.data)
          : new MapScatterLayer(this.map, { ...config.options, theme: this.theme, visible: config.visible,
              onSelect: marker => {
                const current = this.configs.find(item => item.id === config.id);
                if (!current || current.locked) return;
                if (marker.ids.length > 1) { this.closeCard(); return; }
                this.selected = { layerId: config.id, pointId: marker.ids[0]! }; this.refreshCard();
              } }, config.data);
        this.layers.set(config.id, layer);
      } else if (config.kind === 'heat' && layer instanceof MapHeatLayer) {
        if (JSON.stringify(previousConfigs.find(item => item.id === config.id)?.data) !== JSON.stringify(config.data)) layer.setData(config.data);
        layer.setOptions({ visible: config.visible });
      } else if (config.kind === 'scatter' && layer instanceof MapScatterLayer) {
        if (JSON.stringify(previousConfigs.find(item => item.id === config.id)?.data) !== JSON.stringify(config.data)) layer.setData(config.data);
        layer.setOptions({ visible: config.visible });
      }
    }
  }
  entries() {
    return this.configs.map(config => ({ id: `overlay_${config.id}`, name: config.name ?? config.id,
      colorEditable: config.kind === 'scatter', color: config.kind === 'scatter' ? resolveScatterColor({ ...config.options, theme: this.theme }) : '#E62D33',
      visible: config.visible !== false, locked: config.locked === true }));
  }
  update(id: string, patch: { color?: string; visible?: boolean; locked?: boolean }): void {
    const config = this.configs.find(item => `overlay_${item.id}` === id);
    if (!config) throw new Error('未知叠加层');
    if (config.locked && (patch.color !== undefined || patch.visible !== undefined)) throw new Error('对象已锁定，请先解锁');
    if (patch.color !== undefined && config.kind === 'scatter') {
      config.options = { ...config.options, color: patch.color };
      (this.layers.get(config.id) as MapScatterLayer).setOptions({ color: patch.color });
    }
    if (patch.visible !== undefined) { config.visible = patch.visible; this.layers.get(config.id)?.setOptions({ visible: patch.visible }); }
    if (patch.locked !== undefined) config.locked = patch.locked;
    this.refreshCard();
  }
  private refreshCard() {
    const config = this.configs.find(item => item.id === this.selected?.layerId);
    const point = config?.data.find(item => item.id === this.selected?.pointId);
    if (!config || config.kind !== 'scatter' || !point || !config.card || config.visible === false || config.locked) { this.closeCard(); return; }
    const component = this.cards[config.card.type];
    if (!component) { this.closeCard(); return; }
    if (!this.cardElement) {
      this.cardElement = document.createElement('div');
      this.cardElement.style.cssText = 'max-width:320px;max-height:40vh;overflow:auto';
      this.popup = new maplibregl.Marker({ element: this.cardElement, anchor: 'bottom', offset: [0, -12] }).setLngLat([point.lng, point.lat]).addTo(this.map);
    }
    this.popup!.setLngLat([point.lng, point.lat]);
    const vnode = h(component, { ...config.card.props, ...('properties' in point ? point.properties : {}), id: point.id, lng: point.lng, lat: point.lat }); vnode.appContext = this.appContext ?? null;
    render(vnode, this.cardElement);
  }
  private closeCard() { if (this.cardElement) render(null, this.cardElement); this.popup?.remove(); this.popup = undefined; this.cardElement = undefined; this.selected = undefined; }
  dispose(): void { this.closeCard(); for (const layer of this.layers.values()) layer.dispose(); this.layers.clear(); this.configs = []; }
}

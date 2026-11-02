// Adapted from map-experience-v297 baseline v2.97/v2.1. See map-source-mapping.md.
// Original algorithms retained; React, global storage and fixed landmarks removed.
import * as turf from '@turf/turf';
export class MapExperience {
  constructor(map, options = {}) {
    this.map = map;
    this.canvasId = `scene3d-map-shadow-${crypto.randomUUID()}`;
    this.state = { ...this.themeValues(options.themeMode || 'light'), viewMode: '3d', pitch: 45, bearing: map.getBearing(), zoom: map.getZoom(), ...options };
    this.listeners = [];
    const listen = (event, fn) => { map.on(event, fn); this.listeners.push([event, fn]); };
    const apply = () => {
      this.applyChinese(); this.tuneLabels(); this.addBuildings(); this.applyColors();
      this.applySky(); this.applyLight(); this.applyShadow(); this.hideRoadArrows();
      this.applyLabelColors(); this.applyLabelSize(); this.applyRoadLabelDensity();
    };
    listen('style.load', apply);
    listen('moveend', () => { this.state.zoom = map.getZoom(); this.state.bearing = map.getBearing(); this.refreshRoundedBuildings(); });
    this._closeBuildings = map.getZoom() >= 15;
    listen('zoom', () => {
      const close = map.getZoom() >= 15;
      if (close !== this._closeBuildings) {
        this._closeBuildings = close;
        this.applyBuildingMaterial(); this.applyShadow();
      }
      if (this.state.shadow && close) {
        if (map.getLayer('sh-shadow-raster')) map.setPaintProperty('sh-shadow-raster', 'raster-opacity', this.shadowRasterOpacity());
        this.scheduleTransitionShadows();
      }
    });
    try { if (map.isStyleLoaded()) apply(); } catch (error) { this.dispose(); throw error; }
  }
  setState(patch, callback) { Object.assign(this.state, patch); callback?.(); }
  save() {} // Persistence belongs to the scene document, never global localStorage.
  dispose() {
    const map = this.map;
    this.listeners.forEach(([event, fn]) => map.off(event, fn));
    this._roundToken = (this._roundToken || 0) + 1;
    this._viewToken = (this._viewToken || 0) + 1;
    for (const key of ['_shadowGeometryTimer','_transitionShadowTimer','_shadowRasterTimer','_shadowCanvasPauseTimer']) clearTimeout(this[key]);
    for (const key of ['_initialBuildingTimers','_initialShadowTimers']) for (const timer of this[key] || []) clearTimeout(timer);
    this._shadowCanvas?.remove();
    this.map = null;
  }
  targetPitch() {
    return this.state.viewMode === '3d' ? this.state.pitch : 0;
  }

  adjust(hex, amt) {
    let c = String(hex).replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    const f = amt < 0 ? (v) => Math.max(0, Math.round(v * (1 + amt))) : (v) => Math.round(v + (255 - v) * amt);
    return '#' + [f(r), f(g), f(b)].map(v => v.toString(16).padStart(2, '0')).join('');
  }

  mix(a, b, t) {
    const p = (h) => { let c = String(h).replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [parseInt(c.slice(0,2),16), parseInt(c.slice(2,4),16), parseInt(c.slice(4,6),16)]; };
    const A = p(a), B = p(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  vecSource() {
    const sources = this.map.getStyle().sources || {};
    if (sources.openmaptiles) return 'openmaptiles';
    return Object.keys(sources).find(k => sources[k].type === 'vector');
  }

  materialBuildingColor() {
    return this.mix(this.state.building, '#ffffff', this.state.buildingGlow * 0.28);
  }

  // 用同一白模基色生成克制的景深明度阶梯：近景对比更强，远景逐渐提亮。
  // 阶梯宽度复用“转折阴影强度”，不增加新的面板参数，也避免暗面再次融合成整块灰色。

  buildingDepthPalette() {
    const base = this.materialBuildingColor();
    const edge = Math.max(0, Math.min(1, this.state.buildingEdgeShadow));
    const shade = Math.max(0, Math.min(1, this.state.buildingShadeStrength));
    // 0% 表示真正的低反差白模：景深错层只保留约 0.3% 的微弱差异。
    // 随暗面强度提高再恢复原有的前后明度阶梯，默认值附近的层次保持不变。
    const shadeResponse = Math.pow(shade, 0.72);
    const spread = 0.003 + shadeResponse * (0.06 + edge * 0.025 + shade * 0.02);
    return [
      this.adjust(base, -spread * 0.9),
      this.adjust(base, -spread * 0.62),
      this.adjust(base, -spread * 0.38),
      this.adjust(base, -spread * 0.18),
      base,
    ];
  }

  // 圆角建筑带有按当前镜头深度计算的 depthTone，保证背光面也能看清前后层级。

  buildingDepthColorExpression() {
    const tones = this.buildingDepthPalette();
    return ['match', ['to-number', ['coalesce', ['get', 'depthTone'], 2]],
      0, tones[0], 1, tones[1], 3, tones[3], 4, tones[4], tones[2]];
  }

  // 圆角数据尚未准备好时，先按真实建筑高度做轻微明度错层，避免 Z15 初次出现时变成同色块。

  rawBuildingDepthColorExpression() {
    const tones = this.buildingDepthPalette();
    const height = ['to-number', ['coalesce', ['get', 'render_height'], ['get', 'height'], 6]];
    return ['step', height,
      tones[2], 24, tones[1], 45, tones[3], 75, tones[0], 110, tones[4], 180, tones[1], 280, tones[3]];
  }

  buildingTurnShadowColor() {
    const shaded = this.adjust(this.materialBuildingColor(), -0.32);
    return this.mix(shaded, this.state.shadowColor, 0.18);
  }

  applySky() {
    const m = this.map;
    if (!m) return;
    const color = this.state.skyColor;
    // MapLibre 5.6+ 原生天空；保留容器背景作为脚本加载或低俯仰时的安全回退。
    m.getContainer().style.backgroundColor = color;
    if (typeof m.setSky !== 'function') return;
    try {
      m.setSky({
        'sky-color': color,
        'sky-horizon-blend': 0.28,
        'horizon-color': this.mix(color, '#ffffff', 0.62),
        'horizon-fog-blend': 0.12,
        'fog-color': this.mix(color, '#ffffff', 0.78),
        'fog-ground-blend': 0.2,
        'atmosphere-blend': 0,
      });
    } catch (e) {}
  }

  // 完整恢复 v2.23：建筑高度由 Z15→Z16.35 的缩放进度直接驱动。

  buildingGrowthExpression(height) {
    return ['interpolate', ['cubic-bezier', 0.22, 0.61, 0.36, 1], ['zoom'],
      15, ['*', height, 0.08],
      16.35, height];
  }

  // 与普通建筑表达式完全一致的数值进度，供投影长度和显隐同步使用。

  ordinaryBuildingGrowthScale(zoom) {
    const progress = Math.max(0, Math.min(1, (zoom - 15) / 1.35));
    let parameter = progress;
    for (let i = 0; i < 6; i++) {
      const inverse = 1 - parameter;
      const x = 3 * inverse * inverse * parameter * 0.22
        + 3 * inverse * parameter * parameter * 0.36
        + parameter * parameter * parameter;
      const derivative = 3 * inverse * inverse * 0.22
        + 6 * inverse * parameter * (0.36 - 0.22)
        + 3 * parameter * parameter * (1 - 0.36);
      if (Math.abs(derivative) < 0.00001) break;
      parameter = Math.max(0, Math.min(1, parameter - (x - progress) / derivative));
    }
    const inverse = 1 - parameter;
    const eased = 3 * inverse * inverse * parameter * 0.61
      + 3 * inverse * parameter * parameter
      + parameter * parameter * parameter;
    return 0.08 + eased * 0.92;
  }



  // 保留用户设置的 2D 道路色，仅在进入 3D 时按同一镜头进度渐变加深。

  roadTransitionColor(baseColor) {
    if (this.state.viewMode !== '3d') return baseColor;
    const strength = Math.max(0, Math.min(1, this.state.road3DDarken));
    const darkColor = this.adjust(baseColor, -strength);
    return ['interpolate', ['cubic-bezier', 0.22, 0.61, 0.36, 1], ['zoom'],
      15, baseColor,
      16, darkColor];
  }

  // v3.0 地标资产：真实比例骨架 + 混元轮廓辅助；材质和方向光与普通建筑统一。

  baseMapLabelAnchor() {
    const m = this.map;
    if (!m) return undefined;
    const ownLayers = new Set([
      'sh-districts', 'sh-shadow-raster', 'sh-shadow', 'sh-shadow-edge',
      'sh-buildings-3d', 'sh-rounded-buildings-3d',
    ]);
    const layers = (m.getStyle() && m.getStyle().layers) || [];
    let lastBaseSurface = -1;
    for (let i = 0; i < layers.length; i++) {
      const layer = layers[i];
      if (ownLayers.has(layer.id)) continue;
      if (layer.type !== 'symbol' && layer.type !== 'custom') lastBaseSurface = i;
    }
    for (let i = lastBaseSurface + 1; i < layers.length; i++) {
      if (!ownLayers.has(layers[i].id) && layers[i].type === 'symbol') return layers[i].id;
    }
    const firstLabel = layers.find(layer => !ownLayers.has(layer.id) && layer.type === 'symbol');
    return firstLabel && firstLabel.id;
  }

  // 明确固定渲染顺序：地面/道路 → 行政线 → 投影 → 建筑 → 地标 → 文字。
  // 道路因此仍保留原样式和文字，但道路几何会被建筑正确遮挡，不再穿到屋顶或立面。

  enforce3DLayerOrder() {
    const m = this.map;
    if (!m || !m.isStyleLoaded()) return;
    const labelAnchor = this.baseMapLabelAnchor();
    if (!labelAnchor || !m.getLayer(labelAnchor)) return;
    const ordered = [
      'sh-districts', 'sh-shadow-raster', 'sh-shadow', 'sh-shadow-edge',
      'sh-buildings-3d', 'sh-rounded-buildings-3d',
    ];
    for (const id of ordered) {
      if (!m.getLayer(id)) continue;
      try { m.moveLayer(id, labelAnchor); } catch (e) {}
    }
  }

  addBuildings() {
    const m = this.map;
    const src = this.vecSource();
    if (!src) return;
    const layers = m.getStyle().layers || [];
    const firstSymbol = this.baseMapLabelAnchor();
    for (const L of layers) {
      if ((L['source-layer'] === 'building' || L.id.includes('building')) && L.id !== 'sh-buildings-3d' && L.id !== 'sh-shadow') {
        try { m.setLayoutProperty(L.id, 'visibility', 'none'); } catch (e) {}
      }
    }
    const h = ['coalesce', ['get', 'render_height'], ['get', 'height'], 6];
    const ordinaryBuildingFilter = ['literal', true];
    this._ordinaryBuildingBaseFilter = ordinaryBuildingFilter;
    const empty = { type: 'FeatureCollection', features: [] };
    // 投影使用独立的地理几何，而不是把建筑轮廓按屏幕像素整体平移。
    // 这样每个投影都能与建筑底面相连，并按建筑高度得到不同长度。
    if (!m.getSource('sh-building-shadows')) m.addSource('sh-building-shadows', { type: 'geojson', data: empty });
    if (!this._shadowCanvas) {
      this._shadowCanvas = document.createElement('canvas');
      this._shadowCanvas.id = this.canvasId;
      this._shadowCanvas.width = 1024;
      this._shadowCanvas.height = 1024;
      // CanvasSource 在部分浏览器中通过元素 ID 获取画布；放到视口外可避免离屏元素解析失败。
      Object.assign(this._shadowCanvas.style, {
        position: 'fixed', left: '-12000px', top: '-12000px', width: '1024px', height: '1024px',
        pointerEvents: 'none', opacity: '0', zIndex: '-1',
      });
      document.body.appendChild(this._shadowCanvas);
    }
    if (!m.getSource('sh-shadow-raster')) {
      const bounds = m.getBounds();
      m.addSource('sh-shadow-raster', {
        type: 'canvas', canvas: this.canvasId, animate: false,
        coordinates: [
          [bounds.getWest(), bounds.getNorth()], [bounds.getEast(), bounds.getNorth()],
          [bounds.getEast(), bounds.getSouth()], [bounds.getWest(), bounds.getSouth()],
        ],
      });
    }
    if (!m.getLayer('sh-shadow-raster')) {
      m.addLayer({ id: 'sh-shadow-raster', type: 'raster', source: 'sh-shadow-raster', minzoom: 15,
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 0, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, firstSymbol);
    }
    const shadowLayers = ['sh-shadow'];
    for (const id of shadowLayers) {
      if (!m.getLayer(id)) {
        m.addLayer({ id, type: 'fill', source: 'sh-building-shadows', minzoom: 15,
          paint: { 'fill-color': '#85817a', 'fill-opacity': 0, 'fill-antialias': false } }, firstSymbol);
      }
    }
    if (!m.getLayer('sh-shadow-edge')) {
      m.addLayer({ id: 'sh-shadow-edge', type: 'line', source: 'sh-building-shadows', minzoom: 15,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#85817a', 'line-opacity': 0, 'line-width': 0, 'line-blur': 0 } }, firstSymbol);
    }
    if (!m.getSource('sh-rounded-main')) m.addSource('sh-rounded-main', { type: 'geojson', data: empty });
    if (!m.getLayer('sh-buildings-3d')) {
      m.addLayer({ id: 'sh-buildings-3d', type: 'fill-extrusion', source: src, 'source-layer': 'building', minzoom: 15, filter: ordinaryBuildingFilter,
        paint: {
          'fill-extrusion-color': this.rawBuildingDepthColorExpression(),
          // 颜色与不透明度在整个过渡中保持稳定，仅高度使用缓入缓出曲线从地面生长。
          'fill-extrusion-height': this.buildingGrowthExpression(h),
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
          // 开启侧面纵向渐变，使顶部附近更亮、接地处略暗，避免暗面成为整块实色。
          'fill-extrusion-vertical-gradient': this.state.buildingGradient > 0.01,
        } }, firstSymbol);
    }
    if (!m.getLayer('sh-rounded-buildings-3d')) {
      m.addLayer({ id: 'sh-rounded-buildings-3d', type: 'fill-extrusion', source: 'sh-rounded-main', minzoom: 15,
        layout: { visibility: 'none' },
        paint: {
          'fill-extrusion-color': this.buildingDepthColorExpression(),
          'fill-extrusion-height': this.buildingGrowthExpression(['get', 'height']),
          'fill-extrusion-base': 0,
          'fill-extrusion-opacity': 1,
          'fill-extrusion-vertical-gradient': this.state.buildingGradient > 0.01,
        } }, firstSymbol);
    }

    // 2D line 图层不会参与建筑深度遮挡，绘制在拉伸层之后会穿透到屋顶形成长条线。
    // 轮廓关系改由建筑景深明度与真实投影表达，彻底停用这两层覆盖线。
    for (const id of ['sh-building-turn-shadow', 'sh-building-soft-edge']) {
      if (m.getLayer(id)) { try { m.removeLayer(id); } catch (e) {} }
    }
    this.enforce3DLayerOrder();
    // 自定义 3D 图层会持续请求重绘，不能只依赖可能永远不触发的 idle 事件。
    // 分阶段读取已加载瓦片，保证首次打开页面时建筑圆角与投影都能初始化。
    for (const timer of (this._initialBuildingTimers || [])) clearTimeout(timer);
    this._initialBuildingTimers = [500, 1500, 3200].map(delay =>
      setTimeout(() => this.refreshRoundedBuildings(), delay));
    // 投影不再等待圆角建筑计算完成；Z15 起直接从当前瓦片读取建筑并补做多次加载重试。
    for (const timer of (this._initialShadowTimers || [])) clearTimeout(timer);
    this._initialShadowTimers = [120, 420, 900, 1800].map(delay =>
      setTimeout(() => this.refreshBuildingShadows(), delay));
    m.once('idle', () => this.refreshRoundedBuildings());
  }

  refreshRoundedBuildings() {
    const m = this.map;
    if (!m || !turf || !m.isStyleLoaded()) return;
    if (m.getZoom() < 15) {
      this._roundToken = (this._roundToken || 0) + 1;
      this._roundedReady = false;
      this._roundedBuildingFeatures = [];
      this._roundedBuildingVersion = (this._roundedBuildingVersion || 0) + 1;
      this.scheduleBuildingShadows();
      this.applyBuildingMaterial();
      return;
    }
    const src = this.vecSource();
    if (!src || !m.getSource('sh-rounded-main')) return;
    let raw;
    try { raw = m.querySourceFeatures(src, { sourceLayer: 'building' }); } catch (e) { return; }
    const token = this._roundToken = (this._roundToken || 0) + 1;
    const main = [], seen = new Set();
    const cache = this._roundedCache || (this._roundedCache = new Map());
    if (cache.size > 5000) cache.clear();
    const viewCenter = m.getCenter();
    const viewBearing = m.getBearing() * Math.PI / 180;
    const viewEast = Math.sin(viewBearing);
    const viewNorth = Math.cos(viewBearing);
    const metersPerDegreeLon = 111320 * Math.cos(viewCenter.lat * Math.PI / 180);
    let index = 0;
    const schedule = window.requestIdleCallback
      ? (fn) => window.requestIdleCallback(fn, { timeout: 120 })
      : (fn) => window.setTimeout(() => fn({ timeRemaining: () => 8 }), 0);
    const work = (deadline) => {
      if (token !== this._roundToken || !this.map || !this.map.isStyleLoaded()) return;
      let processed = 0;
      while (index < raw.length && main.length < 800 && (processed < 24 || deadline.timeRemaining() > 3)) {
        const feature = raw[index++];
        processed++;
        const gj = feature.toJSON ? feature.toJSON() : { type: 'Feature', properties: feature.properties || {}, geometry: feature.geometry };
        if (!gj.geometry || !/Polygon/.test(gj.geometry.type)) continue;
        const p = gj.properties || {};
        const height = Math.max(3, +(p.render_height ?? p.height ?? 6) || 6);
        let box, bounds;
        try {
          bounds = turf.bbox(gj);
          box = bounds.map(v => v.toFixed(5)).join(',');
        } catch (e) { continue; }
        const key = `${feature.id ?? p.osm_id ?? p.id ?? ''}:${box}:${height}`;
        if (seen.has(key)) continue;
        seen.add(key);
        // 地图朝向为 0° 时，画面北侧是远景；旋转后随 bearing 同步更新景深方向。
        const centerLon = (bounds[0] + bounds[2]) * 0.5;
        const centerLat = (bounds[1] + bounds[3]) * 0.5;
        const eastMeters = (centerLon - viewCenter.lng) * metersPerDegreeLon;
        const northMeters = (centerLat - viewCenter.lat) * 111320;
        const viewDepth = eastMeters * viewEast + northMeters * viewNorth;
        let stableHash = 0;
        for (let i = 0; i < key.length; i++) stableHash = ((stableHash * 31) + key.charCodeAt(i)) >>> 0;
        // 镜头深度决定主层级；稳定的极小错层负责分开深度接近的相邻楼体，不产生随机闪烁。
        const localOffset = ((stableHash % 3) - 1) * 0.62;
        const depthTone = Math.max(0, Math.min(4, Math.round(2 + viewDepth / 360 + localOffset)));
        const cached = cache.get(key);
        if (cached) {
          main.push({ ...cached, properties: { ...cached.properties, ...p, height, depthTone } });
          continue;
        }
        try {
          // 只生成单层圆角主体，不叠加屋顶层。倒角半径由 1.8m 提高到 3.4m，
          // 正负缓冲仍保持 0.6m 的净差值，因此转角更圆润但建筑占地不会明显膨胀。
          const expanded = turf.buffer(gj, 3.4, { units: 'meters', steps: 4 });
          const rounded = turf.buffer(expanded, -2.8, { units: 'meters', steps: 4 }) || gj;
          const output = { ...rounded, properties: { ...p, height, depthTone } };
          // 缓存几何与源属性；景深色阶在每次镜头收尾时重新写入，旋转后仍保持正确前后关系。
          cache.set(key, { ...rounded, properties: { ...p, height } });
          main.push(output);
        } catch (e) {}
      }
      if (index < raw.length && main.length < 800) {
        schedule(work);
        return;
      }
      if (token !== this._roundToken) return;
      const source = this.map.getSource('sh-rounded-main');
      if (!source) return;
      source.setData({ type: 'FeatureCollection', features: main });
      this._roundedBuildingFeatures = main;
      this._roundedBuildingVersion = (this._roundedBuildingVersion || 0) + 1;
      // Z15 起准备投影数据；圆角白模仍在近景层级启用，避免远景额外负担。
      this._roundedReady = this.map.getZoom() >= 15;
      this.scheduleBuildingShadows();
      this.applyBuildingMaterial();
    };
    schedule(work);
  }

  isWorldGroundTextureLayer(layer) {
    const id = String(layer && layer.id || '').toLowerCase();
    const sl = String(layer && layer['source-layer'] || '').toLowerCase();
    const type = layer && layer.type;
    // OpenFreeMap 在低缩放级别还会使用 Natural Earth 等 raster 地貌底纹。
    // 自定义投影同样是 raster，必须明确排除，避免影响 Z15 以上建筑投影。
    if (type === 'raster') return id !== 'sh-shadow-raster' && !id.startsWith('sh-shadow');
    if (type !== 'fill' && type !== 'hillshade') return false;
    if (sl === 'water' || sl === 'waterway' || /water|ocean|sea|river|canal/.test(id)) return false;
    return sl === 'landcover' || sl === 'landuse'
      || /landcover|landuse|residential|industrial|commercial|hillshade|terrain|relief/.test(id)
      || /park|wood|forest|scrub|orchard|grass|meadow|cemetery|golf|garden|pitch|playground|recreation/.test(id);
  }

  limitWorldGroundTexture(layer) {
    const m = this.map;
    if (!m || !layer || !this.isWorldGroundTextureLayer(layer)) return;
    if (!this._worldGroundZoomRanges) this._worldGroundZoomRanges = {};
    if (!this._worldGroundZoomRanges[layer.id]) {
      this._worldGroundZoomRanges[layer.id] = {
        min: Number.isFinite(layer.minzoom) ? layer.minzoom : 0,
        max: Number.isFinite(layer.maxzoom) ? layer.maxzoom : 24,
      };
    }
    const range = this._worldGroundZoomRanges[layer.id];
    // Z8 以下（含 Z7）保持纯净世界底图；Z8 起才恢复城市地表细节。
    const cityMinZoom = 8;
    try {
      if (range.max <= cityMinZoom) {
        m.setLayoutProperty(layer.id, 'visibility', 'none');
      } else if (typeof m.setLayerZoomRange === 'function') {
        m.setLayerZoomRange(layer.id, Math.max(range.min, cityMinZoom), range.max);
      }
    } catch (e) {}
  }

  rememberBaseFillPaint(layer) {
    if (!layer || layer.type !== 'fill') return null;
    if (!this._baseFillPaint) this._baseFillPaint = {};
    if (!this._baseFillPaint[layer.id]) {
      const paint = layer.paint || {};
      const original = {};
      for (const property of ['fill-color', 'fill-outline-color', 'fill-pattern']) {
        original[property] = {
          exists: Object.prototype.hasOwnProperty.call(paint, property),
          value: this.map.getPaintProperty(layer.id, property),
        };
      }
      this._baseFillPaint[layer.id] = original;
    }
    return this._baseFillPaint[layer.id];
  }

  restoreBaseFillPaint(id, original, properties) {
    if (!original) return;
    for (const property of properties) {
      const saved = original[property];
      if (!saved) continue;
      try { this.map.setPaintProperty(id, property, saved.exists ? saved.value : null); } catch (e) {}
    }
  }

  rememberBaseLineColor(layer) {
    if (!layer || layer.type !== 'line') return null;
    if (!this._baseLineColors) this._baseLineColors = {};
    if (!(layer.id in this._baseLineColors)) {
      this._baseLineColors[layer.id] = this.map.getPaintProperty(layer.id, 'line-color');
    }
    return this._baseLineColors[layer.id];
  }

  setSemanticFill(id, color, outlineColor = color) {
    this.map.setPaintProperty(id, 'fill-color', color);
    if (this.state.themeMode !== 'dark') return;
    // Liberty 的道路面与湿地等图层可能仍引用浅色 sprite；深色模式统一改成纯色面。
    try { this.map.setPaintProperty(id, 'fill-pattern', null); } catch (e) {}
    try { this.map.setPaintProperty(id, 'fill-outline-color', outlineColor); } catch (e) {}
  }

  applyColors() {
    const m = this.map;
    if (!m) return;
    const { ground, road, water } = this.state;
    const isDarkTheme = this.state.themeMode === 'dark';
    const roadColor = this.roadTransitionColor(road);
    const roadOutlineColor = this.roadTransitionColor(this.state.roadOutline);
    for (const L of (m.getStyle().layers || [])) {
      const id = L.id, sl = L['source-layer'] || '', type = L.type;
      try {
        this.limitWorldGroundTexture(L);
        const originalFill = type === 'fill' ? this.rememberBaseFillPaint(L) : null;
        if (type === 'fill' && !isDarkTheme) {
          this.restoreBaseFillPaint(id, originalFill, ['fill-pattern', 'fill-outline-color']);
        }
        if (type === 'background') {
          m.setPaintProperty(id, 'background-color', ground);
          try { m.setPaintProperty(id, 'background-pattern', null); } catch (e) {}
          continue;
        }
        if (id === 'sh-buildings-3d') {
          m.setPaintProperty(id, 'fill-extrusion-color', this.rawBuildingDepthColorExpression());
          m.setPaintProperty(id, 'fill-extrusion-opacity', 1);
          m.setPaintProperty(id, 'fill-extrusion-vertical-gradient', this.state.buildingGradient > 0.01);
          continue;
        }
        if (id.startsWith('sh-shadow') || id === 'sh-districts') continue;

        const waterway = sl === 'waterway' || id.includes('waterway') || id.includes('river') || id.includes('canal');
        const waterish = sl === 'water' || id.includes('water') || id.includes('ocean') || id.includes('sea');
        if (waterway && type === 'line') { m.setPaintProperty(id, 'line-color', water); continue; }
        if (waterish && type === 'fill') { this.setSemanticFill(id, water); continue; }

        const isTransportation = sl === 'transportation' || id.includes('road') || id.includes('highway')
          || id.includes('bridge') || id.includes('tunnel') || id.includes('street');
        const isAeroway = sl === 'aeroway' || id.includes('aeroway') || id.includes('airport')
          || id.includes('runway') || id.includes('taxiway') || id.includes('apron');
        if (isTransportation || (isDarkTheme && isAeroway)) {
          if (type === 'line') {
            if (isAeroway && !isTransportation) this.rememberBaseLineColor(L);
            const isOutline = id.includes('casing') || id.includes('outline');
            if (isOutline) {
              m.setPaintProperty(id, 'line-color', roadOutlineColor);
              if (!this._origRoadOutlineWidth) this._origRoadOutlineWidth = {};
              if (!(id in this._origRoadOutlineWidth)) {
                const lw = m.getPaintProperty(id, 'line-width');
                this._origRoadOutlineWidth[id] = (lw === undefined || lw === null) ? 1 : lw;
              }
              m.setPaintProperty(id, 'line-width', this.scaleSize(this._origRoadOutlineWidth[id], this.state.roadOutlineWidth));
            } else m.setPaintProperty(id, 'line-color', roadColor);
            continue;
          }
          if (type === 'fill') {
            this.setSemanticFill(id, roadColor, roadOutlineColor);
            if (isAeroway && !isTransportation) {
              if (!this._darkSpecialFills) this._darkSpecialFills = new Set();
              this._darkSpecialFills.add(id);
            }
            continue;
          }
        }
        if (!isDarkTheme && isAeroway) {
          if (type === 'line' && this._baseLineColors && id in this._baseLineColors) {
            m.setPaintProperty(id, 'line-color', this._baseLineColors[id]);
          } else if (type === 'fill' && this._darkSpecialFills && this._darkSpecialFills.has(id)) {
            this.restoreBaseFillPaint(id, originalFill, ['fill-color', 'fill-outline-color', 'fill-pattern']);
          }
          continue;
        }

        const isPark = sl === 'park' || id.includes('park');
        const isWood = id.includes('wood') || id.includes('forest') || id.includes('scrub') || id.includes('orchard');
        const isGrass = id.includes('grass') || id.includes('meadow');
        const isOtherGreen = id.includes('cemetery') || id.includes('golf') || id.includes('garden')
          || id.includes('pitch') || id.includes('playground') || id.includes('recreation');
        const isGreen = isPark || isWood || isGrass || isOtherGreen;
        if (isGreen && type === 'fill') {
          const opacity = isPark ? this.state.greenParkOpacity
            : isWood ? this.state.greenWoodOpacity
            : isGrass ? this.state.greenGrassOpacity
            : this.state.greenOtherOpacity;
          this.setSemanticFill(id, this.state.green);
          m.setPaintProperty(id, 'fill-opacity', Math.max(0, Math.min(1, opacity)));
          continue;
        }
        const isLanduse = sl === 'landcover' || sl === 'landuse' || id.includes('landcover') || id.includes('landuse') || id.includes('residential') || id.includes('industrial') || id.includes('commercial');
        if (isLanduse && type === 'fill') { this.setSemanticFill(id, ground); continue; }
        // 深色模式兜底：任何仍依赖浅色 sprite 的面都转为地面纯色，杜绝白色纹理残留。
        if (type === 'fill' && isDarkTheme && originalFill && originalFill['fill-pattern'].exists) {
          this.setSemanticFill(id, ground);
          if (!this._darkSpecialFills) this._darkSpecialFills = new Set();
          this._darkSpecialFills.add(id);
          continue;
        }
        if (type === 'fill' && !isDarkTheme && this._darkSpecialFills && this._darkSpecialFills.has(id)) {
          this.restoreBaseFillPaint(id, originalFill, ['fill-color', 'fill-outline-color', 'fill-pattern']);
        }
      } catch (e) {}
    }
    this.applyBuildingMaterial();
  }

  // 统一建筑材质：只保留自定义白模层，避免底图建筑层以灰色混入。

  applyBuildingMaterial() {
    const m = this.map;
    if (!m) return;
    const showBuildings = this.state.viewMode === '3d' || m.getZoom() >= 15;
    // 恢复 v2.15：圆角几何准备完成后立即启用，不再要求地图先回到俯视角。
    const useRoundedBuildings = !!this._roundedReady;
    for (const L of (m.getStyle().layers || [])) {
      const id = L.id, sl = L['source-layer'] || '';
      if (id.startsWith('sh-shadow')) continue;
      const isBuilding = sl === 'building' || /(^|[-_])building(s)?($|[-_])/i.test(id);
      if (!isBuilding) continue;
      if (id === 'sh-rounded-buildings-3d') {
        try { m.setLayoutProperty(id, 'visibility', showBuildings && useRoundedBuildings ? 'visible' : 'none'); } catch (e) {}
        try { m.setPaintProperty(id, 'fill-extrusion-color', this.buildingDepthColorExpression()); } catch (e) {}
        try { m.setPaintProperty(id, 'fill-extrusion-opacity', 1); } catch (e) {}
        try { m.setPaintProperty(id, 'fill-extrusion-vertical-gradient', this.state.buildingGradient > 0.01); } catch (e) {}
        continue;
      }
      if (id === 'sh-building-soft-edge') {
        try { m.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {}
        try { m.setPaintProperty(id, 'line-opacity', 0); } catch (e) {}
        continue;
      }
      if (id === 'sh-building-turn-shadow') {
        try { m.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {}
        try { m.setPaintProperty(id, 'line-opacity', 0); } catch (e) {}
        continue;
      }
      if (id === 'sh-buildings-3d') {
        try { m.setLayoutProperty(id, 'visibility', showBuildings && !useRoundedBuildings ? 'visible' : 'none'); } catch (e) {}
        try { m.setPaintProperty(id, 'fill-extrusion-color', this.rawBuildingDepthColorExpression()); } catch (e) {}
        try { m.setPaintProperty(id, 'fill-extrusion-opacity', 1); } catch (e) {}
        try { m.setPaintProperty(id, 'fill-extrusion-vertical-gradient', this.state.buildingGradient > 0.01); } catch (e) {}
        continue;
      }
      try { m.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {}
      try {
        if (L.type === 'fill-extrusion') m.setPaintProperty(id, 'fill-extrusion-opacity', 0);
        if (L.type === 'fill') m.setPaintProperty(id, 'fill-opacity', 0);
        if (L.type === 'line') m.setPaintProperty(id, 'line-opacity', 0);
      } catch (e) {}
    }
  }

  applyLight() {
    const m = this.map;
    if (!m) return;
    try {
      // MapLibre 的 light intensity 同时控制方向光反差；限制上限并增加基础补光，避免背光面过暗。
      const glow = Math.max(0, Math.min(1, this.state.buildingGlow));
      const gradient = Math.max(0, Math.min(1, this.state.buildingGradient));
      const shadeStrength = Math.max(0, Math.min(1, this.state.buildingShadeStrength));
      const topLight = Math.max(0, Math.min(1, this.state.buildingTopLight));
      const bottomLight = Math.max(0, Math.min(1, this.state.buildingBottomLight));
      const fillLight = Math.max(0, Math.min(1, this.state.buildingFillLight));
      // MapLibre 的 light intensity 越高，受光面与背光面的差异越大。
      // 因此暗面强度为 0% 时必须把方向光反差降到接近 0，而不是保留旧版约三成的灰度。
      const shadeResponse = Math.pow(shadeStrength, 0.72);
      const effectiveTopLight = 1 - (1 - topLight) * shadeResponse;
      const topLightColor = this.adjust(this.state.lightColor, -(1 - effectiveTopLight) * 0.42);
      const maxContrast = Math.min(0.88,
        (0.38 + Math.pow(this.state.intensity, 0.82) * 0.36
          + gradient * (0.1 + shadeStrength * 0.06))
        * (1 - bottomLight * (0.05 + gradient * 0.04))
        * (1 - glow * 0.12));
      const fillRelief = 1 - fillLight * (0.08 + shadeStrength * 0.08);
      // 只给纵向渐变留下极弱残差，0% 时侧面接近白色但仍能辨认接地关系。
      const verticalResidual = gradient * (1 - bottomLight) * 0.012;
      const whiteModelIntensity = Math.min(0.88,
        verticalResidual + shadeResponse * maxContrast * fillRelief);
      m.setLight({ anchor: 'map', color: topLightColor, intensity: whiteModelIntensity,
        position: [1.2, this.state.azimuth, Math.max(0, 90 - this.state.altitude)] });
    } catch (e) {}
  }

  scheduleBuildingShadows() {
    clearTimeout(this._shadowGeometryTimer);
    // 光照滑块拖动时合并连续刷新，避免每个输入帧都重算数百栋建筑。
    this._shadowGeometryTimer = setTimeout(() => this.refreshBuildingShadows(), 64);
  }

  // 视图转换期间使用节流而不是防抖，避免连续 zoom 事件把投影更新一直推迟到建筑生长结束。

  scheduleTransitionShadows() {
    if (this._transitionShadowTimer) return;
    const now = (window.performance && performance.now) ? performance.now() : Date.now();
    const elapsed = now - (this._lastTransitionShadowAt || 0);
    const delay = Math.max(0, 120 - elapsed);
    this._transitionShadowTimer = setTimeout(() => {
      this._transitionShadowTimer = null;
      this._lastTransitionShadowAt = (window.performance && performance.now) ? performance.now() : Date.now();
      this.refreshBuildingShadows();
    }, delay);
  }

  // 投影始终读取当前视野中的原始建筑瓦片；圆角白模只负责显示，不能截断投影覆盖范围。

  shadowSourceBuildings() {
    const rounded = this._roundedBuildingFeatures || [];
    const now = Date.now();
    if (this._shadowFallbackFeatures && now - (this._shadowFallbackAt || 0) < 220) return this._shadowFallbackFeatures;
    const m = this.map;
    const src = m && this.vecSource();
    if (!m || !src) return rounded;
    let raw = [];
    try { raw = m.querySourceFeatures(src, { sourceLayer: 'building' }) || []; } catch (e) { return rounded; }
    // querySourceFeatures 会同时返回视野外的预加载瓦片和瓦片重复项。
    // 先筛到当前视野及投影缓冲区，再按离镜头中心的距离排序，避免固定上限被屏幕外建筑抢占。
    const bounds = m.getBounds();
    const spanX = Math.max(0.0001, bounds.getEast() - bounds.getWest());
    const spanY = Math.max(0.0001, bounds.getNorth() - bounds.getSouth());
    const padded = {
      west: bounds.getWest() - spanX * 0.32,
      east: bounds.getEast() + spanX * 0.32,
      south: bounds.getSouth() - spanY * 0.32,
      north: bounds.getNorth() + spanY * 0.32,
    };
    const center = m.getCenter();
    const metersPerLon = 111320 * Math.cos(center.lat * Math.PI / 180);
    const candidates = [], seen = new Set();
    for (const feature of raw) {
      const gj = feature.toJSON ? feature.toJSON() : { type: 'Feature', properties: feature.properties || {}, geometry: feature.geometry };
      if (!gj.geometry || !/Polygon/.test(gj.geometry.type)) continue;
      const p = gj.properties || {};
      const height = Math.max(3, +(p.render_height ?? p.height ?? 6) || 6);
      let box;
      try { box = turf.bbox(gj); } catch (e) { continue; }
      if (box[2] < padded.west || box[0] > padded.east || box[3] < padded.south || box[1] > padded.north) continue;
      const boxKey = box.map(v => v.toFixed(6)).join(',');
      const key = `${feature.id ?? p.osm_id ?? p.id ?? ''}:${boxKey}:${height}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const featureCenterX = (box[0] + box[2]) * 0.5;
      const featureCenterY = (box[1] + box[3]) * 0.5;
      const dx = (featureCenterX - center.lng) * metersPerLon;
      const dy = (featureCenterY - center.lat) * 111320;
      candidates.push({ feature: { ...gj, properties: { ...p, height } }, distanceSq: dx * dx + dy * dy });
    }
    candidates.sort((a, b) => a.distanceSq - b.distanceSq);
    const features = candidates.slice(0, 1800).map(item => item.feature);
    this._shadowFallbackFeatures = features;
    this._shadowFallbackAt = now;
    this._shadowFallbackVersion = (this._shadowFallbackVersion || 0) + 1;
    return features.length ? features : rounded;
  }

  refreshBuildingShadows() {
    const m = this.map;
    // CanvasSource 参与样式加载时，isStyleLoaded() 可能短暂保持 false；
    // 只要目标 source 已存在就可以安全更新，避免投影刷新形成循环等待。
    if (!m || !turf) return;
    const source = m.getSource('sh-building-shadows');
    if (!source) return;
    const buildings = this.shadowSourceBuildings();
    if (!buildings.length) {
      source.setData({ type: 'FeatureCollection', features: [] });
      this._shadowFeatures = [];
      this.renderShadowRaster([]);
      this._shadowGeometryKey = '';
      return;
    }

    const altitude = Math.max(8, Math.min(90, this.state.altitude));
    const range = Math.max(0.5, Math.min(4, this.state.shadowRange));
    const bearing = (this.state.azimuth + 180) % 360;
    const zoom = m.getZoom();
    // 与普通建筑的 cubic-bezier 生长严格同步，避免投影被第二套缓动重复压小。
    const growth = this.ordinaryBuildingGrowthScale(zoom);
    const key = [this._roundedBuildingVersion || 0, this._shadowFallbackVersion || 0, bearing.toFixed(1), altitude.toFixed(1), range.toFixed(2), growth.toFixed(2)].join(':');
    if (key === this._shadowGeometryKey) return;
    this._shadowGeometryKey = key;

    const tanAltitude = Math.max(0.14, Math.tan(altitude * Math.PI / 180));
    // 参考图中高层建筑拥有明显长投影；范围参数只控制合理上限，异常轮廓仍由下方校验拦截。
    const maxDistance = 28 + range * 32;
    const shadows = [];
    for (const building of buildings) {
      if (shadows.length >= 1600) break;
      const fullHeight = Math.max(3, +(building.properties && building.properties.height) || 6);
      const height = fullHeight * growth;
      if (growth <= 0.001 || !building.geometry) continue;
      // 复合建筑必须逐个 Polygon 处理；禁止把相距很远的多个体块做一次总凸包。
      const polygonParts = building.geometry.type === 'Polygon'
        ? [building.geometry.coordinates]
        : (building.geometry.type === 'MultiPolygon' ? building.geometry.coordinates : []);
      for (const coordinates of polygonParts) {
        if (shadows.length >= 1600 || !coordinates || !coordinates[0] || coordinates[0].length < 4) break;
        try {
          const part = turf.polygon(coordinates, building.properties || {});
          const footprintArea = turf.area(part);
          if (footprintArea < 2) continue;

          // 拒绝尺寸异常的瓦片/复合轮廓，防止单个坏要素覆盖整块地面。
          const box = turf.bbox(part);
          const midLat = (box[1] + box[3]) * 0.5 * Math.PI / 180;
          const widthMeters = Math.abs(box[2] - box[0]) * 111320 * Math.cos(midLat);
          const heightMeters = Math.abs(box[3] - box[1]) * 111320;
          const maxDimension = Math.max(widthMeters, heightMeters);
          if (!Number.isFinite(maxDimension) || maxDimension > 480 || footprintArea > 140000) continue;

          // 普通建筑以 50% 显示高度投影；高楼更长、低楼更短，并与生长进度同步。
          const displayHeight = height * 0.5;
          // 先计算完整建筑的最终投影长度，再乘同一个 growth；避免最小长度让投影抢在建筑前出现。
          const fullDisplayHeight = fullHeight * 0.5;
          const fullDistance = Math.min(maxDistance, Math.max(3.5, fullDisplayHeight * 1.15 / tanAltitude * range));
          const distance = fullDistance * growth;
          const shifted = turf.transformTranslate(part, distance, bearing, { units: 'meters', mutate: false });
          const points = [];
          // 只使用当前体块的外环，洞口和其他体块不会被错误连接成超大投影面。
          for (const coord of coordinates[0]) points.push(turf.point(coord));
          const shiftedOuter = shifted.geometry && shifted.geometry.coordinates && shifted.geometry.coordinates[0];
          if (!shiftedOuter) continue;
          for (const coord of shiftedOuter) points.push(turf.point(coord));
          const swept = turf.convex(turf.featureCollection(points));
          if (!swept) continue;

          // 最后一层面积保护：异常投影直接丢弃，不允许污染整张地图。
          const sweptArea = turf.area(swept);
          const safeArea = Math.max(18000, footprintArea * 10 + maxDimension * distance * 3);
          if (!Number.isFinite(sweptArea) || sweptArea > safeArea) continue;
          // 参考图中高层投影不会因长度增加而消失，给予高层略高的可见权重。
          const opacityWeight = Math.min(1.12, 0.82 + displayHeight / 600);
          swept.properties = { height, distance, opacityWeight };
          shadows.push(swept);
        } catch (e) {}
      }
    }
    this._shadowFeatures = shadows;
    source.setData({ type: 'FeatureCollection', features: shadows });
    this.renderShadowRaster(shadows);
  }

  scheduleShadowRaster() {
    clearTimeout(this._shadowRasterTimer);
    this._shadowRasterTimer = setTimeout(() => this.renderShadowRaster(this._shadowFeatures || []), 42);
  }

  shadowRasterOpacity() {
    const m = this.map;
    if (!m || m.getZoom() < 15) return 0;
    const softNorm = Math.max(0, Math.min(1, this.state.shadowSoftness / 2));
    const altitudeFactor = (90 - Math.max(4, Math.min(90, this.state.altitude))) / 86;
    const softnessCompensation = 1 + softNorm * 0.1;
    // Z15 时建筑已经具有 8% 的接地高度，投影同步出现但不再被二次压到仅 8% 浓度。
    // Z15→Z15.65 只负责把可见浓度平滑补齐；投影长度仍在几何层严格跟随建筑生长。
    const zoomProgress = Math.max(0, Math.min(1, (m.getZoom() - 15) / 0.65));
    const easedVisibility = zoomProgress * zoomProgress * (3 - 2 * zoomProgress);
    const zoomVisibility = 0.42 + easedVisibility * 0.58;
    return Math.max(0, Math.min(0.88,
      this.state.shadowStrength * (0.9 + altitudeFactor * 0.18) * softnessCompensation * zoomVisibility));
  }

  renderShadowRaster(features) {
    const m = this.map;
    const canvas = this._shadowCanvas;
    if (!m || !canvas) return;
    const source = m.getSource('sh-shadow-raster');
    if (!source) return;
    // 在修改画布前先恢复 CanvasSource 更新，避免慢设备上被上一次延迟暂停抢先截断。
    clearTimeout(this._shadowCanvasPauseTimer);
    try { if (source.play) source.play(); } catch (e) {}

    // 在当前视野外保留缓冲区，防止高斯模糊和长投影在画布边缘被裁切。
    const bounds = m.getBounds();
    let west = bounds.getWest(), east = bounds.getEast();
    let south = bounds.getSouth(), north = bounds.getNorth();
    const padX = Math.max(0.0008, (east - west) * 0.22);
    const padY = Math.max(0.0008, (north - south) * 0.22);
    west -= padX; east += padX; south -= padY; north += padY;
    const coordinates = [[west, north], [east, north], [east, south], [west, south]];
    const coordinateKey = [west, north, east, south].map(v => v.toFixed(7)).join(':');

    const mapCanvas = m.getCanvas();
    const cssSize = Math.max(mapCanvas.clientWidth || 700, mapCanvas.clientHeight || 700);
    const size = Math.max(768, Math.min(1280, Math.round(cssSize * 1.45)));
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }
    if (!this._shadowMaskCanvas) this._shadowMaskCanvas = document.createElement('canvas');
    const mask = this._shadowMaskCanvas;
    if (mask.width !== size || mask.height !== size) { mask.width = size; mask.height = size; }
    const maskCtx = mask.getContext('2d');
    const outCtx = canvas.getContext('2d');
    maskCtx.clearRect(0, 0, size, size);
    maskCtx.fillStyle = '#ffffff';
    maskCtx.globalAlpha = 1;

    const toPixel = (coord) => [
      (coord[0] - west) / (east - west) * size,
      (north - coord[1]) / (north - south) * size,
    ];
    const drawPolygon = (polygon) => {
      maskCtx.beginPath();
      for (const ring of polygon) {
        if (!ring || ring.length < 4) continue;
        const first = toPixel(ring[0]);
        maskCtx.moveTo(first[0], first[1]);
        for (let i = 1; i < ring.length; i++) {
          const point = toPixel(ring[i]);
          maskCtx.lineTo(point[0], point[1]);
        }
        maskCtx.closePath();
      }
      try { maskCtx.fill('evenodd'); } catch (e) { maskCtx.fill(); }
    };
    // 所有投影先以不透明白色写入同一遮罩；重叠区域仍然只有一份颜色，不会越叠越深。
    for (const feature of (features || [])) {
      const geometry = feature && feature.geometry;
      if (!geometry) continue;
      if (geometry.type === 'Polygon') drawPolygon(geometry.coordinates);
      else if (geometry.type === 'MultiPolygon') for (const polygon of geometry.coordinates) drawPolygon(polygon);
    }

    const softNorm = Math.max(0, Math.min(1, this.state.shadowSoftness / 2));
    if (!this._shadowBlurCanvas) this._shadowBlurCanvas = document.createElement('canvas');
    const blurCanvas = this._shadowBlurCanvas;
    if (blurCanvas.width !== size || blurCanvas.height !== size) { blurCanvas.width = size; blurCanvas.height = size; }
    const blurCtx = blurCanvas.getContext('2d');
    blurCtx.clearRect(0, 0, size, size);
    if (softNorm <= 0.001) {
      // 0%：直接使用实体联合遮罩，不做任何高斯模糊或周向扩散。
      blurCtx.drawImage(mask, 0, 0);
    } else {
      // 虚化沿光照反方向做单向采样，并只保留少量横向柔边。
      // 因此投影会向一个方向拖开，而不会在建筑四周形成均匀光晕。
      const shadowBearing = ((this.state.azimuth + 180) % 360) * Math.PI / 180;
      const directionX = Math.sin(shadowBearing);
      const directionY = -Math.cos(shadowBearing);
      const directionalSpread = 4 + Math.pow(softNorm, 0.82) * 42;
      const edgeBlur = 0.5 + Math.pow(softNorm, 0.9) * 8;
      const samples = 3 + Math.round(softNorm * 7);
      blurCtx.save();
      blurCtx.filter = `blur(${edgeBlur}px)`;
      for (let i = 0; i < samples; i++) {
        const progress = samples <= 1 ? 0 : i / (samples - 1);
        blurCtx.globalAlpha = (1.35 / samples) * (1 - progress * 0.55);
        blurCtx.drawImage(mask, directionX * directionalSpread * progress, directionY * directionalSpread * progress);
      }
      blurCtx.restore();
    }

    // 仍然只合成同一张联合遮罩，建筑之间不会因相互重叠而叠加变黑。
    outCtx.clearRect(0, 0, size, size);
    const densityPasses = softNorm <= 0.001 ? 1 : 1 + Math.round(softNorm * 2);
    for (let i = 0; i < densityPasses; i++) outCtx.drawImage(blurCanvas, 0, 0);
    outCtx.save();
    outCtx.globalCompositeOperation = 'source-in';
    // 长度已经随建筑生长，不再让透明度重复从零生长；Z15 起即可看到接地阴影。
    // 高虚化的补偿与当前浓度统一由 shadowRasterOpacity() 计算。
    const alpha = this.shadowRasterOpacity();
    // 画布内只保留一份不透明灰色遮罩，透明度由单个 raster 图层统一控制；
    // 因此建筑相互重叠时不会继续累积变黑。
    outCtx.fillStyle = this.state.shadowColor;
    outCtx.fillRect(0, 0, size, size);
    outCtx.restore();

    // 参数调节不会改变地图范围；避免每个 input 事件都重设 CanvasSource 四角，
    // 否则部分设备会短暂清空纹理。只有地图真的移动后才更新地理范围。
    if (coordinateKey !== this._shadowCoordinateKey) {
      try { source.setCoordinates(coordinates); this._shadowCoordinateKey = coordinateKey; } catch (e) {}
    }
    try { m.setPaintProperty('sh-shadow-raster', 'raster-opacity', alpha); } catch (e) {}
    m.triggerRepaint();
    // 给 GPU 和地图重绘留出稳定上传窗口；连续拖动会持续重置该计时器。
    this._shadowCanvasPauseTimer = setTimeout(() => {
      try {
        m.triggerRepaint();
        if (source.pause) source.pause();
      } catch (e) {}
    }, 520);
  }

  applyShadow() {
    const m = this.map;
    // 地标材质或模型尚未就绪时不能阻断普通建筑投影的更新。
    if (!m || !m.getLayer('sh-shadow-raster')) return;
    // 旧的半透明面和描边全部停用，避免颜色叠加以及只模糊轮廓的假柔化。
    for (const id of ['sh-shadow', 'sh-shadow-edge']) {
      if (!m.getLayer(id)) continue;
      try { m.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {}
      try { m.setPaintProperty(id, id === 'sh-shadow' ? 'fill-opacity' : 'line-opacity', 0); } catch (e) {}
    }
    for (let i = 1; i <= 8; i++) {
      const id = `sh-shadow-soft-${i}`;
      if (!m.getLayer(id)) continue;
      try { m.setPaintProperty(id, 'fill-opacity', 0); } catch (e) {}
      try { m.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {}
    }
    // Z15 起只要建筑可见就同步显示投影；2D 近景同样保留建筑接地关系。
    if (!this.state.shadow || m.getZoom() < 15) {
      try { m.setPaintProperty('sh-shadow-raster', 'raster-opacity', 0); } catch (e) {}
      try { m.setLayoutProperty('sh-shadow-raster', 'visibility', 'none'); } catch (e) {}
      const source = m.getSource('sh-shadow-raster');
      try { if (source && source.pause) source.pause(); } catch (e) {}
      return;
    }
    try { m.setLayoutProperty('sh-shadow-raster', 'visibility', 'visible'); } catch (e) {}
    // 拖动参数时先维持上一张投影并即时更新浓度，新的柔化画面随后无缝替换。
    try { m.setPaintProperty('sh-shadow-raster', 'raster-opacity', this.shadowRasterOpacity()); } catch (e) {}
    const source = m.getSource('sh-shadow-raster');
    try { if (source && source.play) source.play(); } catch (e) {}
    this.scheduleBuildingShadows();
    this.scheduleShadowRaster();
  }

  applyDistricts() {
    const m = this.map;
    if (!m || !m.getLayer('sh-districts')) return;
    try { m.setLayoutProperty('sh-districts', 'visibility', this.state.districts ? 'visible' : 'none'); } catch (e) {}
  }

  // 标注文字：按类别分别着色——行政（地名）、主干道、次干道；描边（光晕）色统一

  applyLabelColors() {
    const m = this.map;
    if (!m) return;
    const { placeColor, roadMajorColor, roadMinorColor, labelHalo } = this.state;
    // 道路名图层内按 class 区分主/次干道（数据驱动表达式，逐要素着色）
    const roadExpr = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary'], roadMajorColor, roadMinorColor];
    for (const L of (m.getStyle().layers || [])) {
      if (L.type !== 'symbol') continue;
      const id = L.id, sl = L['source-layer'] || '';
      const isRoad = sl === 'transportation_name' || id.includes('highway-name') || id.includes('-name-') || id.includes('shield');
      try { m.setPaintProperty(id, 'text-color', isRoad ? roadExpr : placeColor); } catch (e) {}
      try { m.setPaintProperty(id, 'text-halo-color', labelHalo); } catch (e) {}
    }
  }

  // 把缩放系数分配进表达式：text-size 多为 zoom 插值，zoom 只能位于顶层 interpolate/step，
  // 因此不能整体乘以系数，而要把系数乘进各个输出档位。

  scaleSize(v, scale) {
    if (typeof v === 'number') return v * scale;
    if (Array.isArray(v)) {
      const op = v[0];
      if (op === 'interpolate' || op === 'interpolate-hcl' || op === 'interpolate-lab') {
        const out = v.slice();
        for (let i = 4; i < out.length; i += 2) out[i] = this.scaleSize(out[i], scale);
        return out;
      }
      if (op === 'step') {
        const out = v.slice();
        for (let i = 2; i < out.length; i += 2) out[i] = this.scaleSize(out[i], scale);
        return out;
      }
      return ['*', v, scale]; // 非 zoom 顶层表达式（如要素驱动）可安全包裹
    }
    return v;
  }

  // 文字字号：在每个符号图层原始 text-size 基础上乘以缩放系数（首次捕获原值，避免叠加）

  applyLabelSize() {
    const m = this.map;
    if (!m) return;
    if (!this._origTextSize) this._origTextSize = {};
    const scale = this.state.labelSize;
    for (const L of (m.getStyle().layers || [])) {
      if (L.type !== 'symbol') continue;
      const id = L.id;
      if (!(id in this._origTextSize)) {
        let ts;
        try { ts = m.getLayoutProperty(id, 'text-size'); } catch (e) {}
        this._origTextSize[id] = (ts === undefined || ts === null) ? 16 : ts;
      }
      try { m.setLayoutProperty(id, 'text-size', this.scaleSize(this._origTextSize[id], scale)); } catch (e) {}
    }
  }

  // 道路文字数量：通过沿线标注间距控制密度，0% 时完全隐藏。

  applyRoadLabelDensity() {
    const m = this.map;
    if (!m) return;
    const density = Math.max(0, Math.min(1, this.state.roadLabelDensity));
    const spacing = Math.round(1800 - density * 1620); // 低密度间距大，高密度间距小
    for (const L of (m.getStyle().layers || [])) {
      if (L.type !== 'symbol') continue;
      const id = L.id, sl = L['source-layer'] || '';
      const isRoad = sl === 'transportation_name' || id.includes('highway-name') || id.includes('-name-') || id.includes('shield');
      if (!isRoad) continue;
      try { m.setLayoutProperty(id, 'visibility', density <= 0.01 ? 'none' : 'visible'); } catch (e) {}
      if (density <= 0.01) continue;
      try { m.setLayoutProperty(id, 'symbol-placement', 'line'); } catch (e) {}
      try { m.setLayoutProperty(id, 'symbol-spacing', spacing); } catch (e) {}
      try { m.setLayoutProperty(id, 'text-allow-overlap', false); } catch (e) {}
      try { m.setLayoutProperty(id, 'text-ignore-placement', false); } catch (e) {}
      try { m.setLayoutProperty(id, 'symbol-avoid-edges', true); } catch (e) {}
    }
  }

  themeValues(mode) {
    const shared = {
      roadOutlineWidth: 0,
      road3DDarken: 0.05,
      greenParkOpacity: 0.5,
      greenWoodOpacity: 0.49,
      greenGrassOpacity: 0.28,
      greenOtherOpacity: 0.42,
      districts: false,
      roadLabelDensity: 0.05,
      labelSize: 0.65,
      lightColor: '#ffffff',
      intensity: 0,
      azimuth: 164,
      altitude: 45,
      shadow: true,
      shadowStrength: 0.04,
      shadowRange: 3.35,
      shadowSoftness: 0,
    };
    if (mode === 'dark') {
      return {
        ...shared,
        themeMode: 'dark',
        ground: '#2b2b2b',
        road: '#34383c',
        roadOutline: '#34383c',
        water: '#384657',
        green: '#689556',
        placeColor: '#a6a6a6',
        roadMajorColor: '#8f8f8f',
        roadMinorColor: '#5c5c5c',
        labelHalo: '#4f4f4f',
        skyColor: '#396184',
        building: '#2b2d31',
        buildingGlow: 0.5,
        buildingShadeStrength: 0.71,
        buildingGradient: 0.28,
        buildingTopLight: 0.9,
        buildingBottomLight: 0.85,
        buildingFillLight: 0.65,
        buildingEdgeShadow: 0.5,
        shadowColor: '#3c3f44',
      };
    }
    return {
      ...shared,
      themeMode: 'light',
      ground: '#eff2f6',
      road: '#eaedf1',
      roadOutline: '#eff2f6',
      water: '#cee3fd',
      green: '#86ea61',
      placeColor: '#c2c2c2',
      roadMajorColor: '#9e9e9e',
      roadMinorColor: '#999999',
      labelHalo: '#ffffff',
      skyColor: '#c2e3ff',
      building: '#ffffff',
      buildingGlow: 1,
      buildingShadeStrength: 0.2,
      buildingGradient: 0.35,
      buildingTopLight: 1,
      buildingBottomLight: 1,
      buildingFillLight: 1,
      buildingEdgeShadow: 1,
      shadowColor: '#777a7e',
    };
  }

  applyThemeMode(mode) {
    this.setState(this.themeValues(mode), () => {
      this.applyColors();
      this.applySky();
      this.applyLabelColors();
      this.applyLabelSize();
      this.applyRoadLabelDensity();
      this.applyBuildingMaterial();
      this.applyLight();
      this.applyShadow();
      this.applyDistricts();
      this.save();
    });
  }

  applyChinese() {
    const m = this.map;
    for (const L of (m.getStyle().layers || [])) {
      if (L.type !== 'symbol') continue;
      const tf = L.layout && L.layout['text-field'];
      if (tf === undefined || tf === null) continue;
      try { m.setLayoutProperty(L.id, 'text-field', ['coalesce', ['get', 'name:zh'], ['get', 'name:zh-Hans'], ['get', 'name']]); } catch (e) {}
    }
  }

  // Z4 世界视角只保留国家名称。其他文字图层从 Z5 起恢复，避免城市、
  // 省州、水域等名称与国家名称争夺视觉层级。

  limitWorldLabelsAtZ4(layer) {
    const m = this.map;
    if (!m || !layer || layer.type !== 'symbol') return;
    const textField = layer.layout && layer.layout['text-field'];
    if (textField === undefined || textField === null) return;
    const id = String(layer.id || '').toLowerCase();
    const sl = String(layer['source-layer'] || '').toLowerCase();
    const filterText = JSON.stringify(layer.filter || []).toLowerCase();
    const isCountry = /country/.test(id) || (sl === 'place' && /"country"/.test(filterText));
    if (isCountry) return;
    if (!this._worldLabelZoomRanges) this._worldLabelZoomRanges = {};
    if (!this._worldLabelZoomRanges[layer.id]) {
      this._worldLabelZoomRanges[layer.id] = {
        min: Number.isFinite(layer.minzoom) ? layer.minzoom : 0,
        max: Number.isFinite(layer.maxzoom) ? layer.maxzoom : 24,
      };
    }
    const range = this._worldLabelZoomRanges[layer.id];
    try {
      if (range.max <= 5) m.setLayoutProperty(layer.id, 'visibility', 'none');
      else m.setLayerZoomRange(layer.id, Math.max(range.min, 5), range.max);
    } catch (e) {}
  }

  tuneLabels() {
    const m = this.map;
    for (const L of (m.getStyle().layers || [])) {
      if (L.type !== 'symbol') continue;
      this.limitWorldLabelsAtZ4(L);
      const id = L.id, sl = L['source-layer'] || '';
      const isPoi = sl === 'poi' || /^poi/.test(id) || id.includes('poi') || id.includes('aerodrome');
      const isHouse = sl === 'housenumber' || id.includes('housenumber');
      const isRoad = sl === 'transportation_name' || id.includes('highway-name') || id.includes('-name-') || id.includes('shield');
      const isPlace = sl === 'place' || id.includes('place');
      try {
        // 只保留道路与地名/区域文字，隐藏 POI 与门牌
        if (isPoi || isHouse) { m.setLayoutProperty(id, 'visibility', 'none'); continue; }
        if (isRoad) {
          this.soft(id, '#3f3f3b', 1);
          // 沿道路排布并参与碰撞检测，避免 point 模式在每个分段或瓦片上重复生成同一道路名称。
          try { m.setLayoutProperty(id, 'symbol-placement', 'line'); } catch (e) {}
          try { m.setLayoutProperty(id, 'text-pitch-alignment', 'viewport'); } catch (e) {}
          try { m.setLayoutProperty(id, 'text-rotation-alignment', 'map'); } catch (e) {}
          try { m.setLayoutProperty(id, 'text-anchor', 'center'); } catch (e) {}
          try { m.setLayoutProperty(id, 'text-allow-overlap', false); } catch (e) {}
          try { m.setLayoutProperty(id, 'text-ignore-placement', false); } catch (e) {}
          try { m.setLayoutProperty(id, 'symbol-avoid-edges', true); } catch (e) {}
          // 去掉高速/道路文字下的白色框（描边底框与盾牌图标）
          try { m.setPaintProperty(id, 'text-halo-width', 0); } catch (e) {}
          try { m.setPaintProperty(id, 'icon-opacity', 0); } catch (e) {}
          // Z11 总览只显市/区名；道路名 Z13 起才出现
          try { m.setLayerZoomRange(id, 13, 24); } catch (e) {}
          // 降噪：仅保留主干道名称（小路/支路名称隐藏，便于叠加信息）；Z16+ 放出次干道
          try {
            const base = m.getFilter(id);
            const f = ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false];
            m.setFilter(id, base ? ['all', base, f] : f);
          } catch (e) {}
          continue;
        }
        if (isPlace) {
          this.soft(id, '#5f5f5b', 0.95);
          // Liberty 的 city/town/village 地名在低缩放层级使用 circle_11_black 图标。
          // Z10 以下只保留地域名称文字，隐藏文字下方的小黑点；Z10 以上原样式本就不显示该圆点。
          const iconImage = L.layout && L.layout['icon-image'];
          if (/circle[^"']*black/i.test(JSON.stringify(iconImage || ''))) {
            try { m.setPaintProperty(id, 'icon-opacity', ['step', ['zoom'], 0, 10, 1]); } catch (e) {}
          }
          // 街道/街道办等子级地名（suburb/neighbourhood/quarter/village）推到 Z13 起；Z11-12 仅留市/区名
          const sub = /(suburb|neighbou?rhood|quarter|village|hamlet|islet|locality)/.test(id);
          // 兜底：按名称过滤掉以「街道/镇/乡/村」结尾的要素（这些是子级行政名）
          try {
            const base = m.getFilter(id);
            const nm = ['coalesce', ['get', 'name:zh'], ['get', 'name'], ''];
            const noStreet = ['!', ['in', '街道', nm]];
            // 去掉社区/小区名称：按 class 剔除社区级地名，并用中文名兜底
            const notCommunityClass = ['!', ['in', ['get', 'class'], ['literal', ['suburb', 'neighbourhood', 'neighborhood', 'quarter', 'hamlet', 'isolated_dwelling']]]];
            const noCommunityName = ['all', ['!', ['in', '社区', nm]], ['!', ['in', '小区', nm]], ['!', ['in', '新村', nm]], ['!', ['in', '苑', nm]], ['!', ['in', '家园', nm]]];
            const lowZoomFilter = ['any', ['>=', ['zoom'], 13], ['all', noStreet, ['!', ['in', '镇', nm]]]];
            const f = ['all', notCommunityClass, noCommunityName, lowZoomFilter];
            m.setFilter(id, base ? ['all', base, f] : f);
          } catch (e) {}
          if (sub) { try { m.setLayerZoomRange(id, 13, 24); } catch (e) {} }
          continue;
        }
        this.soft(id, '#7a7a76', 0.9);
      } catch (e) {}
    }
  }
  // 移除道路方向箭头与单行线箭头，保留道路名称与普通地名标注。

  hideRoadArrows() {
    const m = this.map;
    if (!m) return;
    for (const L of (m.getStyle().layers || [])) {
      const id = String(L.id || '');
      const sl = String(L['source-layer'] || '');
      const icon = L.layout && L.layout['icon-image'];
      const iconText = icon === undefined ? '' : JSON.stringify(icon);
      const arrowNamed = /(oneway|one-way|arrow|direction)/i.test(id);
      const arrowIcon = L.type === 'symbol' && /(oneway|one-way|arrow|direction)/i.test(iconText)
        && (sl === 'transportation' || sl === 'transportation_name' || /road|highway|bridge|tunnel/i.test(id));
      if (!arrowNamed && !arrowIcon) continue;
      try { m.setLayoutProperty(id, 'visibility', 'none'); } catch (e) {
        try { m.setPaintProperty(id, 'icon-opacity', 0); } catch (_) {}
      }
    }
  }

  soft(id, color, opacity) {
    const m = this.map;
    try { m.setPaintProperty(id, 'text-color', color); } catch (e) {}
    try { m.setPaintProperty(id, 'text-halo-color', 'rgba(255,255,255,0.9)'); } catch (e) {}
    try { m.setPaintProperty(id, 'text-halo-width', 1); } catch (e) {}
    try { m.setPaintProperty(id, 'text-opacity', opacity); } catch (e) {}
  }

  applyViewModeStyles() {
    this.applyColors();
    this.applySky();
    this.applyBuildingMaterial();
    this.applyShadow();
  }

  switchViewMode(mode) {
    if (mode !== '2d' && mode !== '3d') return;
    const m = this.map;
    // 切换维度只改变俯仰角，精确沿用切换瞬间的缩放等级和中心点。
    const currentZoom = m ? m.getZoom() : this.state.zoom;
    const token = this._viewToken = (this._viewToken || 0) + 1;
    if (m) m.stop();
    if (mode === '3d') {
      this.setState({ viewMode: '3d' }, () => {
        this.applyViewModeStyles();
        if (m) {
          this._flying = true;
          m.easeTo({ zoom: currentZoom, pitch: this.state.pitch,
            bearing: this.state.bearing, duration: 1000, essential: true });
        }
        this.save();
      });
      return;
    }
    this.setState({ viewMode: '2d' }, () => {
      if (!m) { this.applyViewModeStyles(); this.save(); return; }
      const finish = () => {
        if (token !== this._viewToken || this.state.viewMode !== '2d') return;
        this.applyViewModeStyles();
        this.save();
      };
      if (Math.abs(m.getPitch()) < 0.2) {
        finish();
      } else {
        this._flying = true;
        m.once('moveend', finish);
        m.easeTo({ zoom: currentZoom, pitch: 0, bearing: this.state.bearing, duration: 850, essential: true });
      }
    });
  }
}

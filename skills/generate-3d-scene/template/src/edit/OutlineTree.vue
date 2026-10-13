<script setup lang="ts">

/**
 * edit/OutlineTree.vue — 场景树（左悬浮面板，Spline 风格）
 *
 * 结构：分组 key 为可折叠根（chevron + 类型图标 + 分组名 + 计数）；组内按 parentId 嵌套；
 *   跨分组父子「子随父分区显示」（分区 = 顶层祖先所属分组）；孤儿节点（parentId 悬空）挂根级并 warn。
 * 行内操作：显隐（eye → __visuals.visible）、锁定（lock → __visuals.locked；视口点选/Gizmo 跳过，树中仍可点选看属性）。
 * 搜索：id 子串不区分大小写；命中 + 祖先链自动展开；清空恢复全树；无结果空态。
 */
import { computed, onMounted, ref } from 'vue';
import type { Bridge } from './Bridge';
import type { VisualOverride } from '@/scene-core';
import { RESERVED_KEYS, type SceneNode, type MeshSpecEntry } from '@/scene-core/types';

const props = defineProps<{ bridge: Bridge }>();

/** 分区森林节点（含顶层祖先所属分组 type 与自身 parentId） */
interface FNode {
  id: string;
  type: string;
  parentId: string;
  children: FNode[];
}

/** 分区（分组根）：key + 分区内节点数 + 顶层森林 */
interface GroupView {
  key: string;
  count: number;
  roots: FNode[];
}

/** 渲染行（单接口避免模板判别联合收窄问题；group 行只读 key/count/collapsed；mesh 行只读 id/slotKey/name） */
interface Row {
  kind: 'group' | 'node' | 'mesh';
  key: string;
  id: string;
  type: string;
  parentId: string;
  depth: number;
  count: number;
  hasChildren: boolean;
  collapsed: boolean;
  inheritedHidden: boolean;

  /** mesh 行（GLB 子网格）：所属节点 id + 槽位 key + 显示名 */
  slotKey: string;
  slotName: string;
  slotVisible: boolean;
  meshExpanded: boolean;
}

const query = ref('');
const selected = ref<string[]>([]);

/** 折叠集：分组根用 `g:<key>`，节点用 `<id>` */
const collapsed = ref<Set<string>>(new Set());
const rawGroups = ref<Array<{ key: string; nodes: SceneNode[] }>>([]);
const visuals = ref<Record<string, VisualOverride>>({});

const refresh = (): void => {
  const data = props.bridge.handle.serialize();
  const groups: Array<{ key: string; nodes: SceneNode[] }> = [];
  for (const [key, val] of Object.entries(data)) {
    if (RESERVED_KEYS.has(key) || !Array.isArray(val)) {
      continue;
    }
    groups.push({ key, nodes: val as SceneNode[] });
  }
  rawGroups.value = groups;
  visuals.value = (data.__visuals ?? {}) as Record<string, VisualOverride>;
  meshCache = new Map();
};

onMounted(() => {
  refresh();
  props.bridge.onState((s) => {
    selected.value = s.selection;
    refresh();
  });
});

/** 分区森林：按 parentId 组树，顶层节点归属顶层祖先所属分组（子随父分区） */
const forest = computed<GroupView[]>(() => {
  const byId = new Map<string, { node: SceneNode; type: string }>();
  const order: string[] = [];
  for (const g of rawGroups.value) {
    for (const n of g.nodes) {
      if (n && typeof n === 'object' && n.id) {
        byId.set(n.id, { node: n, type: g.key });
        order.push(n.id);
      }
    }
  }
  const childrenOf = new Map<string, string[]>();
  const rootIds: string[] = [];
  for (const id of order) {
    const entry = byId.get(id);
    if (!entry) {
      continue;
    }
    const parentId = entry.node.parentId ?? null;
    if (parentId && byId.has(parentId)) {
      const arr = childrenOf.get(parentId) ?? [];
      arr.push(id);
      childrenOf.set(parentId, arr);
    } else {
      if (parentId) {
        console.warn(`[OutlineTree] 孤儿节点 ${id}：父 ${parentId} 不存在，挂到根级`);
      }
      rootIds.push(id);
    }
  }
  const seen = new Set<string>();
  const build = (id: string): FNode | null => {
    if (seen.has(id)) {
      return null;
    }
    seen.add(id);
    const entry = byId.get(id);
    if (!entry) {
      return null;
    }
    const kids = (childrenOf.get(id) ?? []).map((c) => build(c)).filter((x): x is FNode => x !== null);
    return {
      id,
      type: entry.type,
      parentId: entry.node.parentId ?? '',
      children: kids,
    };
  };
  const countOf = (n: FNode): number => 1 + n.children.reduce((sum, c) => sum + countOf(c), 0);
  const byPartition = new Map<string, FNode[]>();
  for (const rid of rootIds) {
    const rootEntry = byId.get(rid);
    if (!rootEntry) {
      continue;
    }
    const arr = byPartition.get(rootEntry.type) ?? [];
    const node = build(rid);
    if (node) {
      arr.push(node);
    }
    byPartition.set(rootEntry.type, arr);
  }
  const out: GroupView[] = [];
  for (const g of rawGroups.value) {
    const roots = byPartition.get(g.key) ?? [];
    if (roots.length > 0) {
      out.push({ key: g.key, count: roots.reduce((sum, r) => sum + countOf(r), 0), roots });
    }
  }
  return out;
});

const searching = computed(() => query.value.trim().length > 0);

/** 渲染行（应用搜索过滤 + 折叠；搜索态强制展开并只留命中 + 祖先链） */
const rows = computed<Row[]>(() => {
  const q = query.value.trim().toLowerCase();
  const isSearch = q.length > 0;
  const matched = new Set<string>();
  if (isSearch) {
    for (const g of rawGroups.value) {
      for (const n of g.nodes) {
        if (n && n.id && n.id.toLowerCase().includes(q)) {
          matched.add(n.id);
        }
      }
    }
  }
  const filterTree = (n: FNode): FNode | null => {
    const kids = n.children.map((c) => filterTree(c)).filter((x): x is FNode => x !== null);
    return matched.has(n.id) || kids.length > 0 ? { ...n, children: kids } : null;
  };
  const out: Row[] = [];
  for (const g of forest.value) {
    const roots = isSearch
      ? g.roots.map((r) => filterTree(r)).filter((x): x is FNode => x !== null)
      : g.roots;
    if (roots.length === 0) {
      continue;
    }
    const groupKey = `g:${g.key}`;
    const groupCollapsed = !isSearch && collapsed.value.has(groupKey);
    out.push({
      kind: 'group',
      key: g.key,
      id: '',
      type: '',
      parentId: '',
      depth: -1,
      count: g.count,
      hasChildren: false,
      collapsed: groupCollapsed,
      inheritedHidden: false,
      slotKey: '',
      slotName: '',
      slotVisible: true,
      meshExpanded: false,
    });
    if (groupCollapsed) {
      continue;
    }
    const walk = (n: FNode, depth: number, inheritedHidden: boolean): void => {
      const selfHidden = visuals.value[n.id]?.visible === false;
      const hasChildren = n.children.length > 0;
      const nodeCollapsed = !isSearch && collapsed.value.has(n.id);
      out.push({
        kind: 'node',
        key: '',
        id: n.id,
        type: n.type,
        parentId: n.parentId,
        depth,
        count: 0,
        hasChildren,
        collapsed: nodeCollapsed,
        inheritedHidden,
        slotKey: '',
        slotName: '',
        slotVisible: true,
        meshExpanded: false,
      });
      // GLB 子网格层：节点展开时列出内部 mesh（只读展示 + eye；搜索态不展开）。
      // 有多级容器时按首段容器分组（组头行 + mesh 行再缩进一级）；无容器直接平铺
      const subMeshes = !isSearch && !nodeCollapsed ? subMeshesOf(n.id) : [];
      const meshExpanded = !isSearch && expandedMesh.value.has(n.id);
      if (subMeshes.length > 0 && meshExpanded) {
        const slotVisuals = visuals.value[n.id]?.slots ?? {};
        let lastContainer = null;
        for (const m of subMeshes) {
          const sep = m.key.lastIndexOf('/');
          const container = sep > 0 ? m.key.slice(0, sep) : '';
          if (container && container !== lastContainer) {
            lastContainer = container;
            out.push({
              kind: 'mesh',
              key: '',
              id: n.id,
              type: n.type,
              parentId: n.id,
              depth: depth + 1,
              count: 0,
              hasChildren: false,
              collapsed: false,
              inheritedHidden: inheritedHidden || selfHidden,
              slotKey: '',
              slotName: container.split('/').pop() ?? container,
              slotVisible: true,
              meshExpanded: false,
            });
          }
          out.push({
            kind: 'mesh',
            key: '',
            id: n.id,
            type: n.type,
            parentId: n.id,
            depth: depth + (container ? 2 : 1),
            count: 0,
            hasChildren: false,
            collapsed: false,
            inheritedHidden: inheritedHidden || selfHidden,
            slotKey: m.key,
            slotName: m.name,
            slotVisible: slotVisuals[m.key]?.visible !== false,
            meshExpanded: false,
          });
        }
      }
      if (hasChildren && !nodeCollapsed) {
        for (const c of n.children) {
          walk(c, depth + 1, inheritedHidden || selfHidden);
        }
      }
    };
    for (const r of roots) {
      walk(r, 0, false);
    }
  }
  return out;
});

const empty = computed(() => searching.value && rows.value.length === 0);

const toggleGroup = (key: string): void => {
  const next = new Set(collapsed.value);
  const k = `g:${key}`;
  if (next.has(k)) {
    next.delete(k);
  } else {
    next.add(k);
  }
  collapsed.value = next;
};

const toggleNode = (id: string): void => {
  const next = new Set(collapsed.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  collapsed.value = next;
};

const isVisible = (id: string): boolean => visuals.value[id]?.visible ?? true;

const isLocked = (id: string): boolean => visuals.value[id]?.locked === true;

/** 显隐按钮提示：祖先隐藏态优先（子呈继承态） */
const eyeTitle = (id: string, inherited: boolean): string => {
  if (inherited) {
    return '父节点已隐藏';
  }
  return isVisible(id) ? '隐藏' : '显示';
};

/** 子网格展开集（GLB 节点 id）；子网格清单缓存（refresh 时清） */
const expandedMesh = ref<Set<string>>(new Set());
let meshCache = new Map<string, MeshSpecEntry[]>();

/**
 * 节点的 GLB 子网格清单。**空结果不缓存**——GLB 异步加载完成前 listSubMeshes
 * 返回 []，若缓存空清单则加载完成后永不出现展开钮（加载完成不发 bridge state，
 * refresh 不会清缓存）；不缓存让下次查询自然重试（查表是 O(1) Map 读，代价可忽略）。
 */
const subMeshesOf = (id: string): MeshSpecEntry[] => {
  const cached = meshCache.get(id);
  if (cached) {
    return cached;
  }
  const list = props.bridge.handle.internals.sceneEngine.listSubMeshes(id);
  if (list.length > 0) {
    meshCache.set(id, list);
  }
  return list;
};

/** 节点是否含子网格（控制展开钮显示；不入 meshCache——只查空态可缓存） */
const hasSubMeshes = (id: string): boolean => subMeshesOf(id).length > 0;

const toggleMeshExpand = (id: string): void => {
  const next = new Set(expandedMesh.value);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  expandedMesh.value = next;
};

/** 子网格 eye：写 slots[key].visible（merge 物体级其余槽位；undo/serialize 现成） */
const toggleSlotVisible = (nodeId: string, slotKey: string): void => {
  const se = props.bridge.handle.internals.sceneEngine;
  const slotCur = se.getVisual(nodeId)?.slots?.[slotKey] ?? {};
  props.bridge.commit('子网格显隐', () => {
    // applyVisual 单物体合并语义——update({__visuals}) 是整表替换（会清其他物体的视觉层）
    se.applyVisual(nodeId, { slots: { [slotKey]: { visible: !(slotCur.visible !== false) } } });
  });
};

/** 树点子网格：选中父物体 + 记录槽位态（属性面板显示该 mesh 信息）；window 事件留给 MaterialSection 聚焦滚动 */
const onSelectSlot = (nodeId: string, slotKey: string): void => {
  props.bridge.selectSlot(nodeId, slotKey);
  window.dispatchEvent(new CustomEvent('gts3d-select-slot', { detail: { nodeId, slotKey } }));
};

/** mesh 行选中态：bridge.selectedSlot 匹配该槽位 */
const isSlotActive = (slotKey: string): boolean => {
  const s = props.bridge.selectedSlot;
  return !!s && s.slotKey === slotKey;
};

const onSelect = (id: string, ev: MouseEvent): void => {
  props.bridge.select(id, ev.shiftKey);
};

const onDblClick = (id: string): void => {
  props.bridge.handle.frameObject(id);
};

const toggleVisible = (id: string): void => {
  const next = !isVisible(id);
  props.bridge.commit('显隐', () => {
    props.bridge.handle.internals.sceneEngine.applyVisual(id, { visible: next });
  });
};

const toggleLocked = (id: string): void => {
  const next = !isLocked(id);
  props.bridge.commit('锁定', () => {
    props.bridge.handle.internals.sceneEngine.applyVisual(id, { locked: next });
  });
};

/** 分组 key → 图标路径（内建图标集，未知名回退立方体） */
const ICONS: Record<string, string> = {
  box: 'M8 2l5 3v6l-5 3-5-3V5l5-3zM3 5l5 3 5-3M8 8v6',
  sphere: 'M13.5 8a5.5 5.5 0 1 1-11 0a5.5 5.5 0 1 1 11 0',
  cylinder: 'M3.5 4.5a4.5 1.6 0 1 0 9 0a4.5 1.6 0 1 0-9 0M3.5 4.5v7a4.5 1.6 0 0 0 9 0v-7',
  cone: 'M8 2.5l4.3 9.9H3.7zM3.9 12.2a4.1 1.3 0 0 0 8.2 0',
  torus: 'M13.5 8a5.5 3.4 0 1 1-11 0a5.5 3.4 0 1 1 11 0M10 8a2 .9 0 1 1-4 0a2 .9 0 1 1 4 0',
  plane: 'M2 11l6-6 6 6',
  tree: 'M8 2.4l3.2 4.6H9.3l2.3 3.6H4.4l2.3-3.6H4.8zM8 10.6V14',
  car: 'M3 10l1.2-3.2a1.2 1.2 0 0 1 1.1-.8h5.4a1.2 1.2 0 0 1 1.1.8L13 10v3h-1.6v-1.4H4.6V13H3zM5.2 10.6h.01M10.8 10.6h.01',
  asset: 'M8 2l6 3-6 3-6-3zM2 8l6 3 6-3M2 11l6 3 6-3',
  spark: 'M8 2l1.4 4.6L14 8l-4.6 1.4L8 14l-1.4-4.6L2 8l4.6-1.4z',
};
const DEFAULT_ICON = 'M8 2l5 3v6l-5 3-5-3V5l5-3zM3 5l5 3 5-3M8 8v6';
const GROUP_ICON: Record<string, string> = {
  Box: 'box',
  Sphere: 'sphere',
  Cylinder: 'cylinder',
  Cone: 'cone',
  Torus: 'torus',
  Plane: 'plane',
  trees: 'tree',
  cars: 'car',
  examples: 'spark',
  asset: 'asset',
};
const iconOf = (key: string): string => ICONS[GROUP_ICON[key] ?? 'box'] ?? DEFAULT_ICON;

/** 行内按钮图标路径（长路径置此，模板行保持短） */
const EYE_ON = 'M1.5 8s2.4-4 6.5-4 6.5 4 6.5 4-2.4 4-6.5 4S1.5 8 1.5 8z';
const EYE_OFF = 'M3 3l10 10M6.6 6.8A3 3 0 0 0 8 11c1.2 0 2.3-.6 3-1.5M2 8s2.4-4 6.5-4c1 0 1.9.3 2.7.7M13.6 6.3C14.1 7 14.5 8 14.5 8s-2.4 4-6.5 4c-.5 0-1-.1-1.4-.2';
const LOCK_ON = 'M5 7V5.5a3 3 0 0 1 6 0V7M3.5 7h9a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5z';
const LOCK_OFF = 'M5 7V5.5a3 3 0 0 1 5.8-.9M3.5 7h9a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-9a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5z';
</script>

<template>
  <div class="outline">
    <div class="outline__head">
      <input
        v-model="query"
        data-tree-search
        class="outline__search"
        type="text"
        placeholder="搜索 id…"
      >
    </div>

    <div
      v-if="empty"
      data-tree-empty
      class="outline__empty"
    >
      无匹配物体
    </div>

    <ul
      v-else
      class="outline__list"
    >
      <template
        v-for="row in rows"
        :key="row.kind === 'group' ? `g:${row.key}` : row.id"
      >
        <li
          v-if="row.kind === 'group'"
          :data-tree-group="row.key"
          class="outline__group"
          @click="toggleGroup(row.key)"
        >
          <span
            class="outline__chev"
            :class="{ 'outline__chev--closed': row.collapsed }"
          >
            <svg viewBox="0 0 16 16"><path
              d="M6 4l4 4-4 4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg>
          </span>
          <svg
            class="outline__icon"
            viewBox="0 0 16 16"
          ><path
            :d="iconOf(row.key)"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
            stroke-linejoin="round"
          /></svg>
          <span class="outline__gname">{{ row.key }}</span>
          <span class="outline__count">{{ row.count }}</span>
        </li>

        <li
          v-else-if="row.kind === 'node'"
          :data-tree-node="row.id"
          :data-tree-parent="row.parentId"
          :data-tree-depth="row.depth"
          :class="{ 'outline__item--active': selected.includes(row.id) }"
          :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
          class="outline__item"
          @click.stop="onSelect(row.id, $event)"
          @dblclick.stop="onDblClick(row.id)"
        >
          <span
            v-if="row.hasChildren || hasSubMeshes(row.id)"
            class="outline__chev"
            :class="{ 'outline__chev--closed': row.collapsed }"
            @click.stop="hasSubMeshes(row.id) && !row.hasChildren ? toggleMeshExpand(row.id) : toggleNode(row.id)"
          >
            <svg viewBox="0 0 16 16"><path
              d="M6 4l4 4-4 4"
              fill="none"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg>
          </span>
          <span
            v-else
            class="outline__chev outline__chev--empty"
          />
          <svg
            class="outline__icon"
            viewBox="0 0 16 16"
          ><path
            :d="iconOf(row.type)"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
            stroke-linejoin="round"
          /></svg>
          <span class="outline__id">{{ row.id }}</span>

          <button
            :data-tree-eye="row.id"
            :class="{
              'outline__act--off': !isVisible(row.id),
              'outline__act--inherit': row.inheritedHidden && isVisible(row.id),
            }"
            class="outline__act"
            :title="eyeTitle(row.id, row.inheritedHidden)"
            type="button"
            @click.stop="toggleVisible(row.id)"
          >
            <svg
              v-if="isVisible(row.id)"
              viewBox="0 0 16 16"
            ><path
              :d="EYE_ON"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
            /><circle
              cx="8"
              cy="8"
              r="1.8"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
            /></svg>
            <svg
              v-else
              viewBox="0 0 16 16"
            ><path
              :d="EYE_OFF"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
              stroke-linecap="round"
            /></svg>
          </button>

          <button
            :data-tree-lock="row.id"
            :class="{ 'outline__act--on': isLocked(row.id) }"
            class="outline__act"
            :title="isLocked(row.id) ? '解锁' : '锁定'"
            type="button"
            @click.stop="toggleLocked(row.id)"
          >
            <svg
              v-if="isLocked(row.id)"
              viewBox="0 0 16 16"
            ><path
              :d="LOCK_ON"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
              stroke-linejoin="round"
            /></svg>
            <svg
              v-else
              viewBox="0 0 16 16"
            ><path
              :d="LOCK_OFF"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
              stroke-linejoin="round"
            /></svg>
          </button>
        </li>

        <!-- GLB 子网格行（浅色只读 + eye 单独隐藏 + 点选联动；不上 Gizmo/不可删） -->
        <!-- GLB 子网格行：slotKey 空 = 容器组头（只读不可点编辑）；非空 = mesh（eye + 点选联动） -->
        <li
          v-if="row.kind === 'mesh'"
          :data-tree-mesh="row.slotKey"
          :data-tree-mesh-node="row.id"
          :style="{ paddingLeft: `${8 + row.depth * 14}px` }"
          class="outline__item outline__item--mesh"
          :class="{ 'outline__item--meshgroup': !row.slotKey, 'outline__item--active': row.slotKey && isSlotActive(row.slotKey) }"
          :title="row.slotKey ? `模型内部节点 · ${row.slotKey}` : '模型内部容器'"
          @click.stop="row.slotKey && onSelectSlot(row.id, row.slotKey)"
        >
          <span class="outline__chev outline__chev--empty" />
          <svg
            class="outline__icon"
            viewBox="0 0 16 16"
          ><path
            d="M4 3l8 5-8 5V3z"
            fill="none"
            stroke="currentColor"
            stroke-width="1.1"
            stroke-linejoin="round"
          /></svg>
          <span class="outline__id">{{ row.slotName }}</span>
          <button
            v-if="row.slotKey"
            :data-tree-slot-eye="row.slotKey"
            :class="{ 'outline__act--off': !row.slotVisible }"
            class="outline__act"
            :title="row.slotVisible ? '隐藏子网格' : '显示子网格'"
            type="button"
            @click.stop="toggleSlotVisible(row.id, row.slotKey)"
          >
            <svg
              v-if="row.slotVisible"
              viewBox="0 0 16 16"
            ><path
              :d="EYE_ON"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
            /></svg>
            <svg
              v-else
              viewBox="0 0 16 16"
            ><path
              :d="EYE_OFF"
              fill="none"
              stroke="currentColor"
              stroke-width="1.1"
              stroke-linecap="round"
            /></svg>
          </button>
        </li>
      </template>
    </ul>
  </div>
</template>

<style scoped>
.outline {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--ed-text);
  font-size: 12px;
  box-sizing: border-box;
  overflow: hidden;
}

.outline__head {
  padding: 10px 8px 6px;
}

.outline__search {
  width: 100%;
  box-sizing: border-box;
  background: var(--ed-input);
  border: 1px solid transparent;
  border-radius: var(--ed-radius-s);
  color: var(--ed-text);
  padding: 4px 8px;
  font-size: 12px;
  outline: none;
}

.outline__search:focus {
  border-color: var(--ed-accent);
}

.outline__empty {
  padding: 16px 12px;
  color: var(--ed-dim);
  font-size: 11px;
  text-align: center;
}

.outline__list {
  list-style: none;
  margin: 0;
  padding: 0 6px 8px;
  overflow-y: auto;
  flex: 1;
}

.outline__group {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 4px;
  margin-top: 4px;
  cursor: pointer;
  color: var(--ed-dim);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.03em;
  user-select: none;
}

.outline__group:hover {
  color: var(--ed-text);
}

.outline__gname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline__count {
  color: var(--ed-dim);
  font-weight: 400;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  padding: 0 6px;
}

.outline__item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px 4px 0;
  border-radius: var(--ed-radius-s);
  cursor: pointer;
}

.outline__item:hover {
  background: rgba(0, 0, 0, 0.045);
}

.outline__item--active {
  background: var(--ed-accent-soft);
}

/* GLB 子网格行：浅色只读（模型内部节点，不可删/不可拖出） */
.outline__item--mesh .outline__id {
  color: var(--ed-dim);
  font-size: 11px;
}

.outline__item--mesh .outline__icon {
  color: var(--ed-dim);
}

/* 容器组头（Armature 等）：更弱化，不可点编辑 */
.outline__item--meshgroup {
  cursor: default;
}

.outline__item--meshgroup .outline__id {
  font-weight: 600;
  color: var(--ed-dim);
}

.outline__item--active .outline__id {
  color: var(--ed-accent);
}

.outline__chev {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  color: var(--ed-dim);
  transition: transform 0.12s;
}

.outline__chev svg {
  width: 12px;
  height: 12px;
}

.outline__chev--closed {
  transform: rotate(-90deg);
}

.outline__chev--empty {
  visibility: hidden;
}

.outline__icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  color: var(--ed-dim);
}

.outline__item--active .outline__icon {
  color: var(--ed-accent);
}

.outline__id {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.outline__act {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  padding: 0;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--ed-dim);
  cursor: pointer;
  /* 默认不占视觉（占位防布局跳动）；hover 行才显——仅隐藏/锁定态常显（--off/--on/--inherit） */
  opacity: 0;
}

.outline__item:hover .outline__act {
  opacity: 1;
}

.outline__act svg {
  width: 13px;
  height: 13px;
}

.outline__act:hover {
  background: rgba(0, 0, 0, 0.07);
  color: var(--ed-text);
}

.outline__act--on {
  opacity: 1;
  color: var(--ed-accent);
}

.outline__act--off {
  opacity: 1;
  color: var(--ed-dim);
}

.outline__act--inherit {
  opacity: 0.35;
}
</style>

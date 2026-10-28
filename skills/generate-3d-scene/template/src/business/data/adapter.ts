import type { SceneHandle } from '../../scene3d';
import type { ApplyResult, DataAdapter, DeviceUpdate, IdMapping } from './types';

/** 省略 mappings 时业务 ID 等于节点 ID；提供映射后只接受表中 ID。 */
export function createDataAdapter(
  handle: Pick<SceneHandle, 'getNodeData' | 'patchNodeParams' | 'batchUpdates' | 'onDispose'>,
  mappings?: readonly IdMapping[],
): DataAdapter {
  let disposed = false;
  const ids = new Map<string, string>();
  const duplicate = new Set<string>();
  const owners = new Map<string, string>();
  for (const { businessId, nodeId } of mappings ?? []) {
    if (ids.has(businessId)) duplicate.add(businessId);
    const owner = owners.get(nodeId);
    if (owner !== undefined) {
      duplicate.add(owner);
      duplicate.add(businessId);
    }
    ids.set(businessId, nodeId);
    owners.set(nodeId, businessId);
  }
  let unsubscribe = () => {};
  const dispose = (): void => {
    disposed = true;
    unsubscribe();
  };
  unsubscribe = handle.onDispose(dispose);
  return {
    dispose,
    apply(records): ApplyResult {
      const result: ApplyResult = { updated: [], unchanged: [], issues: [] };
      if (!Array.isArray(records)) {
        result.issues.push({ index: -1, code: 'invalid-record', message: '更新数据必须是数组。' });
        return result;
      }
      const applyRecords = () =>
        records.forEach((input, index) => {
          const raw =
            input && typeof input === 'object' && !Array.isArray(input)
              ? (input as Record<string, unknown>)
              : {};
          const id = typeof raw.id === 'string' ? raw.id : undefined;
          const issue = (code: ApplyResult['issues'][number]['code'], message: string): void => {
            result.issues.push({ index, id, code, message });
          };
          if (disposed) {
            issue('disposed', '场景或数据适配器已销毁。');
            return;
          }
          if (
            !id ||
            Object.keys(raw).some((key) => !['id', 'status', 'spin', 'speed'].includes(key))
          ) {
            issue('invalid-record', '需要非空 id；仅允许 status、spin、speed 业务字段。');
            return;
          }
          if (
            (raw.status !== undefined &&
              !['normal', 'alarm', 'maintenance'].includes(raw.status as string)) ||
            (raw.spin !== undefined && typeof raw.spin !== 'boolean') ||
            (raw.speed !== undefined &&
              (typeof raw.speed !== 'number' || !Number.isFinite(raw.speed) || raw.speed < 0))
          ) {
            issue(
              'invalid-record',
              'status 必须是 normal/alarm/maintenance；spin 为布尔值；speed 为非负有限数。',
            );
            return;
          }
          if (duplicate.has(id)) {
            issue('duplicate-mapping', '业务 ID 或目标节点存在重复映射。');
            return;
          }
          const nodeId = mappings ? ids.get(id) : id;
          const current = nodeId ? handle.getNodeData(nodeId) : null;
          if (!current) {
            issue('unknown-id', '找不到当前场景节点，请检查 ID 映射。');
            return;
          }
          const patch: Partial<Omit<DeviceUpdate, 'id'>> = {};
          for (const key of ['status', 'spin', 'speed'] as const) {
            if (raw[key] !== undefined) Object.assign(patch, { [key]: raw[key] });
          }
          if (Object.entries(patch).every(([key, value]) => current.node.params?.[key] === value)) {
            result.unchanged.push(id);
            return;
          }
          try {
            handle.patchNodeParams(current.node.id, patch);
            result.updated.push(id);
          } catch (error) {
            issue('apply-failed', error instanceof Error ? error.message : String(error));
          }
        });
      if (disposed) applyRecords();
      else handle.batchUpdates(applyRecords);
      return result;
    },
  };
}

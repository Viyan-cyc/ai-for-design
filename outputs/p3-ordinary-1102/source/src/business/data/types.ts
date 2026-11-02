/** 当前示例的业务字段。新增业务字段时同步 adapter 校验与 handler.update。 */
export interface DeviceUpdate {
  id: string;
  status?: 'normal' | 'alarm' | 'maintenance';
  spin?: boolean;
  speed?: number;
}
export interface DataIssue {
  index: number;
  id?: string;
  code: 'unknown-id' | 'duplicate-mapping' | 'invalid-record' | 'disposed' | 'apply-failed';
  message: string;
}
export interface ApplyResult {
  updated: string[];
  unchanged: string[];
  issues: DataIssue[];
}
export interface DataAdapter {
  /** 接收外部输入并校验；批次未出现的设备不会被删除。 */
  apply(records: readonly unknown[]): ApplyResult;
  dispose(): void;
}
export interface IdMapping {
  businessId: string;
  nodeId: string;
}

import type { DataAdapter } from './types';

/** 默认静态场景，不启动网络或模拟计时器。接入接口时在这里订阅并返回释放函数。 */
export function connectData(_adapter: DataAdapter): () => void {
  return () => {};
}

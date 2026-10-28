/** 每 handle 独立追踪：唯一 attempt token；begin/remove 淘汰旧状态；累计计数不影响 ready。 */
import type { AssetEngine } from './engine/AssetEngine';

/** 单次加载追踪记录 */
interface LoadRecord {
  nodeId: string;
  assetId: string;

  /** 本次 attempt 的唯一 token */
  token: number;
}

/** 终态集合（V04：failed ≠ succeeded；删除中的异步加载 = cancelled） */
export type LoadOutcome = 'succeeded' | 'failed' | 'cancelled';

/** 场景诊断快照（SceneHandle.getDiagnostics 的返回形态） */
export interface SceneDiagnostics {

  /** 世代（节点 remove/recreate 递增；诊断用，不再用于取消判定） */
  epoch: number;

  /** 在途加载数 */
  pending: number;

  /** 成功加载数（累计，含已取消节点的历史成功） */
  succeeded: number;

  /** 失败加载数（累计） */
  failed: number;

  /** 取消数（节点在加载完成前被删除/重建） */
  cancelled: number;

  /** 当前失败中的资产（同节点同资产后继成功会移出——快照反映"现在还有谁坏"） */
  failedAssets: Array<{ nodeId: string; assetId: string; error: string }>;

  // 本 handle 安装后的页面错误（window.onerror + unhandledrejection；
  //  安装前的错误由验证脚本的 CDP 全监听覆盖，两窗口互补）
  pageErrors: string[];

  /** 场景是否已出首帧（renderLoop 首帧回调置位） */
  firstFrame: boolean;
}

/** 每 AssetEngine 的 tracker（WeakMap 隔离：多处 createScene 不串） */
export interface LoadTracker {

  /** 发起一次加载（建占位节点时调用）。返回 token 供 settle 对账。 */
  begin(nodeId: string, assetId: string): number;

  /**
   * 结算一次加载。token 不匹配（旧 attempt 迟到/已结算）时静默丢弃
   * （R2：不误删新 attempt，不重复计数）。
   */
  settle(token: number, outcome: LoadOutcome, error?: string): void;

  /** 定向取消一个节点的全部在途加载（remove/recreate 时；R3：不动其他节点） */
  cancelNode(nodeId: string): void;

  /** 世代递增（诊断计数；不做取消判定） */
  bumpEpoch(): void;

  /** 徽标读数（N/M 语义不变：M=总发起，N=已结算） */
  counts(): { loaded: number; total: number };

  /** 首帧置位（renderLoop 首帧回调） */
  markFirstFrame(): void;

  /** 快照 */
  snapshot(): SceneDiagnostics;
}

const trackers = new WeakMap<AssetEngine, LoadTracker>();

/** 页面错误安装（每 handle 一次；diagnostics 的 pageErrors 数据源） */
const pageErrorSinks = new WeakMap<AssetEngine, { errors: string[]; detach: () => void }>();

const installPageErrorSink = (assetEngine: AssetEngine): { errors: string[]; detach: () => void } => {
  const errors: string[] = [];
  const onError = (ev: ErrorEvent): void => {
    errors.push(`error: ${ev.message}`);
  };
  const onRejection = (ev: PromiseRejectionEvent): void => {
    errors.push(`rejection: ${String(ev.reason?.message ?? ev.reason)}`);
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  const sink = {
    errors,
    detach: () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    },
  };
  pageErrorSinks.set(assetEngine, sink);
  return sink;
};

/**
 * 安装（或取已有）diagnostics tracker。createScene 装配时调用；
 * verify 层与徽标共用同一实例。
 */
export const installDiagnostics = (assetEngine: AssetEngine): LoadTracker => {
  const existing = trackers.get(assetEngine);
  if (existing) {
    return existing;
  }

  let epoch = 0;
  let nextToken = 1;
  let succeeded = 0;
  let failed = 0;
  let cancelled = 0;
  let firstFrame = false;

  /** token → record（每个 node 只保留最新 attempt，旧 token 的迟到回调无效） */
  const inFlight = new Map<number, LoadRecord>();

  /** "当前失败"清单：key = `${nodeId}::${assetId}`（当前态语义，R3） */
  const failedNow = new Map<string, { nodeId: string; assetId: string; error: string }>();

  const tracker: LoadTracker = {
    begin(nodeId, assetId) {
      tracker.cancelNode(nodeId);
      const token = nextToken;
      nextToken += 1;
      inFlight.set(token, { nodeId, assetId, token });
      return token;
    },
    settle(token, outcome, error) {
      const record = inFlight.get(token);
      if (!record) {
        // R2：旧 attempt 迟到（token 已被覆盖语义淘汰或已结算）——静默丢弃
        return;
      }
      inFlight.delete(token);
      const key = `${record.nodeId}::${record.assetId}`;
      if (outcome === 'succeeded') {
        succeeded += 1;
        // R3 当前态：同节点同资产后继成功，旧失败不再是"当前失败"
        failedNow.delete(key);
      } else if (outcome === 'failed') {
        failed += 1;
        failedNow.set(key, { nodeId: record.nodeId, assetId: record.assetId, error: error ?? 'unknown' });
      } else {
        cancelled += 1;
      }
    },
    cancelNode(nodeId) {
      for (const [key, failure] of failedNow) {
        if (failure.nodeId === nodeId) {
          failedNow.delete(key);
        }
      }
      for (const [token, record] of inFlight.entries()) {
        if (record.nodeId === nodeId) {
          inFlight.delete(token);
          cancelled += 1;
        }
      }
    },
    bumpEpoch() {
      epoch += 1;
    },
    counts() {
      const settled = succeeded + failed + cancelled;
      return { loaded: settled, total: settled + inFlight.size };
    },
    markFirstFrame() {
      firstFrame = true;
    },
    snapshot() {
      const sink = pageErrorSinks.get(assetEngine);
      return {
        epoch,
        pending: inFlight.size,
        succeeded,
        failed,
        cancelled,
        failedAssets: [...failedNow.values()],
        pageErrors: sink ? [...sink.errors] : [],
        firstFrame,
      };
    },
  };

  trackers.set(assetEngine, tracker);
  return tracker;
};

/** 已安装的 tracker（未安装返回 null——旧调用路径不强制） */
export const getDiagnosticsTracker = (assetEngine: AssetEngine): LoadTracker | null =>
  trackers.get(assetEngine) ?? null;

/** 等待当前加载状态；累计失败计数只用于诊断，不阻塞重试后的 ready。 */
export const waitForReady = (
  tracker: LoadTracker,
  options: { timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<SceneDiagnostics> => {
  const { timeoutMs = 15000, signal } = options;
  return new Promise((resolve, reject) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = Date.now() + timeoutMs;
    const cleanup = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const fail = (message: string): void => {
      cleanup();
      reject(new Error(message));
    };
    const onAbort = (): void => fail('whenReady 已中止（signal）');
    const poll = (): void => {
      const d = tracker.snapshot();
      if (signal?.aborted) {
        onAbort();
      } else if (d.pageErrors.length) {
        fail(`页面异常: ${d.pageErrors.join('; ')}`);
      } else if (d.failedAssets.length) {
        fail(`场景加载失败: ${d.failedAssets.map((f) => `${f.assetId}@${f.nodeId}（${f.error}）`).join('; ')}`);
      } else if (d.pending === 0) {
        cleanup();
        resolve(d);
      } else if (Date.now() >= deadline) {
        fail(`whenReady 超时（${timeoutMs}ms）：pending=${d.pending}`);
      } else {
        timer = setTimeout(poll, Math.min(50, Math.max(1, deadline - Date.now())));
      }
    };
    signal?.addEventListener('abort', onAbort, { once: true });
    poll();
  });
};

/** 页面错误 sink（installDiagnostics 之外独立安装：boot 最早时刻接线） */
export const getPageErrorSink = (assetEngine: AssetEngine): { errors: string[]; detach: () => void } =>
  pageErrorSinks.get(assetEngine) ?? installPageErrorSink(assetEngine);

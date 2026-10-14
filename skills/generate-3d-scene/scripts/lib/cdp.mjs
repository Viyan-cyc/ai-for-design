/** Shared CDP transport: listeners precede navigation; owned resources have bounded cleanup. */
import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';

export class CdpEnvironmentError extends Error {
  constructor(message) {
    super(message); this.name = 'CdpEnvironmentError';
  }
}
export class PageEvalError extends Error {
  constructor(message) {
    super(message); this.name = 'PageEvalError';
  }
}
export const findEdge = () => [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => {
  try {
    return statSync(p).isFile();
  } catch {
    return false;
  }
});

export const positionalArg = (argv, valueFlags = [
  '--out', '--expect', '--url', '--duration', '--max-calls', '--max-triangles', '--max-materials',
]) => {
  for (let i = 0; i < argv.length; i += 1) {
    if (valueFlags.includes(argv[i])) {
      i += 1;
    } else if (!argv[i].startsWith('-')) {
      return argv[i];
    }
  }
  return null;
};

/** Public seam: tests exercise the same RPC implementation used by Edge. */
export const createCdpConnection = (ws, { rpcTimeoutMs = 40000 } = {}) => {
  let seq = 0;
  let closed = false;
  let closing;
  const pending = new Map();
  const pageErrors = []; const rawPageErrors = []; const netMisses = [];
  const requests = new Map();
  const rejectAll = () => {
    for (const entry of pending.values()) {
      entry.reject(new CdpEnvironmentError('CDP connection closed'));
    }
  };
  const onClose = () => {
    closed = true; rejectAll();
  };
  const onMessage = (event) => {
    let msg;
    try {
      msg = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (msg.id !== undefined) {
      const entry = pending.get(msg.id);
      if (msg.error) {
        entry?.reject(new Error(`CDP: ${ msg.error.message}`));
      } else {
        entry?.resolve(msg);
      }
      return;
    }
    const p = msg.params ?? {};
    let error;
    if (msg.method === 'Runtime.exceptionThrown') {
      error = `exception: ${ p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`;
    } else if (msg.method === 'Runtime.consoleAPICalled' && p.type === 'error') {
      error = `console.error: ${ (p.args ?? []).map((a) => a.description ?? a.value ?? '').join(' ')}`;
    } else if (msg.method === 'Log.entryAdded' && p.entry?.level === 'error') {
      error = `log.error: ${ p.entry.text}`;
    }
    if (error) {
      rawPageErrors.push(error);
      // Only browser network noise is exempt; ordinary console.error is never suppressed.
      if (!(msg.method === 'Log.entryAdded' && p.entry?.source === 'network'
        && (/\/favicon\.ico(?:[?#]|$)/i.test(p.entry.url ?? '')
          || /^Failed to load resource: the server responded with a status of 404/.test(p.entry.text)))) {
        pageErrors.push(error);
      }
    }
    if (msg.method === 'Network.requestWillBeSent') {
      requests.set(p.requestId, p.request?.url);
    }
    if (msg.method === 'Network.responseReceived' && p.response?.status >= 400) {
      netMisses.push(`${p.response.status }: ${ p.response.url}`);
    }
    if (msg.method === 'Network.loadingFailed') {
      netMisses.push(`loadingFailed: ${ requests.get(p.requestId) ?? '' } ${ p.errorText ?? ''}`);
    }
    if (msg.method === 'Network.loadingFailed' || msg.method === 'Network.loadingFinished') {
      requests.delete(p.requestId);
    }
  };
  ws.addEventListener('message', onMessage);
  ws.addEventListener('close', onClose);
  const rpc = (method, params = {}, timeoutMs = rpcTimeoutMs) => new Promise((resolve, reject) => {
    if (closed) {
      reject(new CdpEnvironmentError(`CDP closed: ${ method}`)); return;
    }
    const id = ++seq;
    const finish = (fn) => (value) => {
      clearTimeout(timer); pending.delete(id); fn(value);
    };
    const timer = setTimeout(() => pending.get(id)?.reject(new Error(`RPC timeout: ${ method}`)), timeoutMs);
    pending.set(id, { resolve: finish(resolve), reject: finish(reject) });
    try {
      ws.send(JSON.stringify({ id, method, params }));
    } catch (error) {
      pending.get(id)?.reject(error);
    }
  });
  return {
    ws,
    rpc,
    pageErrors,
    rawPageErrors,
    netMisses,
    get closed() {
      return closed;
    },
    get pendingCount() {
      return pending.size;
    },
    async evaluate(expression) {
      const r = await rpc('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) {
        throw new PageEvalError(r.result.exceptionDetails.exception?.description ?? r.result.exceptionDetails.text);
      }
      return r.result?.result?.value;
    },
    async navigateTo(url, timeoutMs) {
      const r = await rpc('Page.navigate', { url }, timeoutMs);
      if (r.result?.errorText) {
        throw new PageEvalError(`Navigation failed: ${ r.result.errorText}`);
      }
    },
    close() {
      if (closing) {
        return closing;
      }
      closed = true;
      rejectAll();
      closing = new Promise((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          ws.removeEventListener('close', finish);
          ws.removeEventListener('close', onClose);
          ws.removeEventListener('message', onMessage);
          requests.clear();
          resolve();
        };
        const timer = setTimeout(finish, 1000);
        ws.addEventListener('close', finish, { once: true });
        if (ws.readyState === 3) {
          finish(); return;
        }
        try {
          ws.close();
        } catch {
          finish();
        }
      });
      return closing;
    },
  };
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const connect = async (url, timeoutMs, Socket) => {
  const ws = new Socket(url);
  try {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        ws.removeEventListener('open', opened);
        ws.removeEventListener('error', failed);
        ws.removeEventListener('close', failed);
      };
      const opened = () => {
        cleanup(); resolve();
      };
      const failed = () => {
        cleanup(); reject(new CdpEnvironmentError('CDP handshake failed or timed out'));
      };
      const timer = setTimeout(failed, Math.max(1, timeoutMs));
      ws.addEventListener('open', opened);
      ws.addEventListener('error', failed);
      ws.addEventListener('close', failed);
    });
    return ws;
  } catch (error) {
    try {
      ws.close();
    } catch { /* handshake never opened */ } throw error;
  }
};

/** One browser owner; newPage creates isolated targets. Adapters allow failure-path testing. */
export const openBrowserSession = async (options = {}, adapters = {}) => {
  const {
    url, port = 9270, gpu = false, deadlineMs = 5000, rpcTimeoutMs = 40000,
    windowSize = '1280,800', userDataDir = `${process.env.TEMP }/gts-cdp-${ port }-${ Date.now()}`,
    onEvents = [],
  } = options;
  const fetcher = adapters.fetch ?? fetch;
  const Socket = adapters.WebSocket ?? WebSocket;
  const args = ['--headless=new', '--no-first-run', `--remote-debugging-port=${ port}`,
    `--user-data-dir=${ userDataDir}`, `--window-size=${ windowSize}`, 'about:blank'];
  if (!gpu) {
    args.unshift('--disable-gpu', '--use-angle=swiftshader', '--enable-unsafe-swiftshader');
  }
  const proc = (adapters.spawn ?? spawn)(findEdge() ?? 'msedge', args, { stdio: 'ignore' });
  let spawnError;
  proc.on('error', (error) => {
    spawnError = error;
  });
  const pages = new Set();
  let ownerClosing;
  const close = () => {
    ownerClosing ??= (async () => {
      await Promise.allSettled([...pages].map((page) => page.close()));
      if (proc.exitCode === null && proc.signalCode === null) {
        await new Promise((resolve) => {
          const done = () => {
            clearTimeout(timer); proc.removeListener('exit', done); resolve();
          };
          const timer = setTimeout(done, 1000);
          proc.once('exit', done);
          try {
            proc.kill();
          } catch {
            done();
          }
        });
      }
    })();
    return ownerClosing;
  };
  const makePage = async (targetId, targetUrl, wires = []) => {
    if (ownerClosing) {
      throw new CdpEnvironmentError('Browser already closed');
    }
    const deadline = Date.now() + deadlineMs;
    const remaining = () => Math.max(1, deadline - Date.now());
    let target;
    while (Date.now() < deadline) {
      if (spawnError) {
        throw new CdpEnvironmentError(spawnError.message);
      }
      try {
        const response = await fetcher(`http://127.0.0.1:${ port }/json/list`, { signal: AbortSignal.timeout(Math.min(1000, remaining())) });
        const targets = await response.json();
        target = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl && (!targetId || t.id === targetId));
      } catch { /* bounded probe retry */ }
      if (target) {
        break;
      }
      await sleep(Math.min(100, remaining()));
    }
    if (!target) {
      throw new CdpEnvironmentError(`CDP unavailable within ${ deadlineMs }ms, port=${ port}`);
    }
    const page = createCdpConnection(await connect(target.webSocketDebuggerUrl, remaining(), Socket), { rpcTimeoutMs });
    pages.add(page);
    // Collectors exist before any enable or navigate RPC can emit events.
    for (const domain of ['Runtime', 'Log', 'Network', 'Page']) {
      await page.rpc(`${domain }.enable`, {}, remaining());
    }
    for (const wire of wires) {
      await wire(page);
    }
    if (targetUrl) {
      await page.navigateTo(targetUrl);
    }
    page.targetId = target.id;
    return page;
  };
  try {
    const root = await makePage(null, url, onEvents);
    return {
      ...root,
      proc,
      get closed() {
        return root.closed;
      },
      close,
      async newPage(pageOptions = {}) {
        try {
          const result = await root.rpc('Target.createTarget', { url: 'about:blank' });
          const page = await makePage(result.result.targetId, pageOptions.url, pageOptions.onEvents);
          let pageClosing;
          return {
            ...page,
            get closed() {
              return page.closed;
            },
            close() {
              pageClosing ??= (async () => {
                try {
                  await root.rpc('Target.closeTarget', { targetId: page.targetId }, 1000);
                } finally {
                  await page.close(); pages.delete(page);
                }
              })();
              return pageClosing;
            },
          };
        } catch (error) {
          await close(); throw error;
        }
      },
    };
  } catch (error) {
    await close(); throw error;
  }
};

/** Arrays are installed before navigation; late callers still receive startup errors. */
export const collectPageErrors = (session, { favicon404Exempt = true } = {}) =>
  favicon404Exempt ? session.pageErrors : session.rawPageErrors;
export const collectNetwork404s = (session) => session.netMisses;

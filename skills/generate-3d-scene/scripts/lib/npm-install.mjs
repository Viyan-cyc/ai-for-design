import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const config = JSON.parse(readFileSync(new URL('../../references/env-config.json', import.meta.url), 'utf8'));
export const registries = Object.freeze(config.npmRegistries);
const prefixes = [...registries, 'https://mirrors.tools.huawei.com/npm', 'https://repo.huaweicloud.com/repository/npm'];
export function retargetLock(lock, registry) {
  const copy = structuredClone(lock);
  delete copy['x-scene3d-registry'];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (typeof value.resolved === 'string') {
      const prefix = prefixes.find(p => value.resolved.startsWith(p + '/'));
      if (prefix) value.resolved = registry + value.resolved.slice(prefix.length);
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(copy); return copy;
}
export function retryable(result) {
  const text = String(result.stderr || '') + '\n' + String(result.stdout || '');
  // Fatal install errors take precedence over incidental network messages.
  if (/npm (?:error|ERR!) (?:code (?:EPERM|EACCES|EUSAGE|EINTEGRITY)\b|command failed)/i.test(text)) return false;
  if (result.error) return false;
  // npm can report ERESOLVE after a failed metadata fetch (Found: pkg@undefined).
  // A resolved version plus npm's explicit peer-conflict report is different:
  // an unrelated earlier fetch failure must not make that conflict retryable.
  const resolveError = /npm (?:error|ERR!) code ERESOLVE\b/i.test(text);
  const resolvedVersion = /npm (?:error|ERR!) Found: \S+@\d+\.\d+\.\d+\b/i.test(text);
  const peerConflict = /npm (?:error|ERR!) (?:Conflicting peer dependency:|Could not resolve dependency:)[\s\S]*?npm (?:error|ERR!) peer(?:Optional)?\s/i.test(text);
  if (resolveError && resolvedVersion && peerConflict) return false;
  const networkFailure = /npm http fetch .*failed with (?:ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ESOCKETTIMEDOUT)\b/i.test(text);
  // A failed fetch may end with a generic npm error rather than a network error code.
  return networkFailure || /npm (?:error|ERR!) code (?:ENOTFOUND|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ESOCKETTIMEDOUT|E404|ETARGET|E502|E503|E504)\b/i.test(text);
}
export function installDependencies({ node, npm, cwd, args = ['ci'], run = spawnSync, now = Date.now, stateFile, beforeRetry }) {
  const lockPath = join(cwd, 'package-lock.json');
  const original = existsSync(lockPath) ? readFileSync(lockPath, 'utf8') : null;
  const deadline = now() + 300000;
  let ordered = [...registries];
  if (stateFile) try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (now() >= state.time && now() - state.time < 3600000 && ordered.includes(state.registry)) ordered = [state.registry, ...ordered.filter(r => r !== state.registry)];
  } catch { /* Optional local health hint. */ }
  try {
    for (const [index, registry] of ordered.entries()) {
      if (index > 0) beforeRetry?.();
      const remaining = deadline - now();
      if (remaining <= 0) throw new Error('依赖安装超过总时限（5 分钟）');
      // One install budget, not a short quota per mirror. Successful downloads
      // and unpacking must not be interrupted just to reserve time for another source.
      if (existsSync(lockPath)) writeFileSync(lockPath, JSON.stringify(retargetLock(JSON.parse(readFileSync(lockPath, 'utf8')), registry), null, 2));
      console.log('[npm] ' + args.join(' ') + ' registry=' + registry);
      const result = run(node, [npm, ...args, '--prefer-offline', '--no-audit', '--no-fund', '--loglevel=http', '--registry', registry, '--fetch-retries=0', '--fetch-timeout=10000'], {
        cwd, env: { ...process.env, npm_config_registry: registry, NPM_CONFIG_REGISTRY: registry },
        encoding: 'utf8', timeout: remaining, maxBuffer: 16 * 1024 * 1024,
      });
      if (result.stdout) process.stdout.write(String(result.stdout));
      if (result.stderr) process.stderr.write(String(result.stderr));
      if (result.error?.code === 'ETIMEDOUT') throw new Error(`依赖安装超时（总时限5分钟，当前源 ${registry}）；安装尚未完成，不代表源不可用。保留npm日志与下载缓存。`);
      if (!result.error && result.status === 0) {
        if (stateFile) try { writeFileSync(stateFile, JSON.stringify({ registry, time: now() })); } catch { /* Read-only hint must not fail a successful install. */ }
        return registry;
      }
      if (!retryable(result)) throw new Error('依赖安装失败：' + (result.error?.message || '请查看上方 npm 错误'));
      if (index < registries.length - 1) console.log('[npm] 当前源请求失败或缺少版本，尝试下一源');
    }
    throw new Error('所有配置源均返回可重试的请求或版本错误；详见上方npm日志');
  } catch (error) {
    if (original !== null) writeFileSync(lockPath, original);
    else rmSync(lockPath, { force: true });
    throw error;
  }
}

/** Read-only check; installation follows the EP setup/install flow. */
import { checkEnvironment } from './lib/environment.mjs';
const debugSignals = {
  nodeOptionsPresent: !!process.env.NODE_OPTIONS,
  inspectFlag: /(?:^|\s)--inspect/.test(process.env.NODE_OPTIONS ?? '') || process.execArgv.some((a) => a.startsWith('--inspect')),
  ideInjection: /bootloader/i.test(process.env.NODE_OPTIONS ?? '') || !!process.env.VSCODE_INSPECTOR_OPTIONS,
};
if (process.argv.includes('--diagnose') && !process.argv.includes('--json')) console.log(`DEBUG_SIGNALS: ${JSON.stringify(debugSignals)}`);
try {
  const override = process.argv.slice(2).find((a) => a.startsWith('--env-dir='))?.slice(10);
  const env = checkEnvironment(override);
  const result = { ok: true, node: env.node, nodeVersion: env.version, three: env.three, envDir: env.dir, ...(process.argv.includes('--diagnose') ? { debugSignals } : {}) };
  if (process.argv.includes('--json')) console.log(JSON.stringify(result));
  else console.log(`RESULT: OK\nNODE: ${env.node}\nNODE_VERSION: ${env.version}\nTHREE_VERSION: ${env.three}\nENV_DIR: ${env.dir}`);
} catch (e) {
  if (process.argv.includes('--json')) console.log(JSON.stringify({ ok: false, code: e.code || 'ENV_CONFIG_BROKEN', error: e.message, hint: e.hint }));
  else console.log(`RESULT: FAIL | ${e.code || 'ENV_CONFIG_BROKEN'}: ${e.message}\nHINT: ${e.hint || 'Check references/env-config.json'}`);
  process.exitCode = 1;
}

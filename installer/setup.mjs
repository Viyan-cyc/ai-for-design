#!/usr/bin/env node
/**
 * 傻瓜式安装向导：双击/一条命令完成安装。
 *  - 自动探测常见 AI 工具的 skills 目录（存在即列为候选）
 *  - 都没有时用默认目录（~/.ai-skills）并在结束后打印"如何让 AI 工具看到它"
 *  - 已安装同版本则自动 --rebind；旧版本则提示先移除（不越权删除用户文件）
 * 用法：node installer/setup.mjs [目标目录]（不给目标目录则交互式选择）
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(fs.readFileSync(path.join(PACKAGE, 'skill-catalog.json'), 'utf8'));

function detectCandidates() {
  const home = os.homedir();
  const candidates = [
    // Claude Code 常见位置
    path.join(home, '.claude', 'skills'),
    path.join(home, '.config', 'claude', 'skills'),
    // Cursor / 通用 agents 目录
    path.join(home, '.cursor', 'skills'),
    path.join(home, '.ai-skills'),
  ];
  // VSCode / JetBrains 扩展形态因用户配置差异大，不猜测，交由用户输入。
  return candidates;
}

function isInstalled(dest) {
  const sid = catalog.skills[0].id;
  const bindingPath = path.join(dest, sid, 'agents', 'package-location.json');
  try {
    const b = JSON.parse(fs.readFileSync(bindingPath, 'utf8'));
    return { binding: b, sameVersion: b.packageVersion === catalog.packageVersion };
  } catch {
    return null;
  }
}

function install(dest, rebind) {
  const r = spawnNode(path.join(PACKAGE, 'installer', 'install_skills.mjs'), rebind ? [dest, '--rebind'] : [dest]);
  if (r.status !== 0) {
    console.error(`\n安装失败：\n${r.stderr || r.stdout}`);
    process.exit(1);
  }
}

function spawnNode(script, args) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8' });
}

function rel(p) {
  return path.relative(PACKAGE, p) || p;
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a.trim()); }));
}

async function main() {
  console.log(`\nG Design Skills 安装向导（包版本 ${catalog.packageVersion}）`);
  console.log('共 4 个 skill：需求提取 / 体验分析 / 原型生成 / 资产维护\n');
  const argDest = process.argv[2] ? path.resolve(process.argv[2].replace(/^~/, os.homedir())) : null;
  let dest = argDest;
  if (!dest) {
    const candidates = detectCandidates().filter((c, i, arr) => arr.indexOf(c) === i);
    console.log('检测到可选的安装位置：');
    candidates.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    console.log(`  ${candidates.length + 1}. 其他位置（手动输入路径）`);
    const answer = await ask(`选择安装位置 [1-${candidates.length + 1}]：`);
    const idx = Number(answer) - 1;
    if (idx >= 0 && idx < candidates.length) dest = candidates[idx];
    else dest = path.resolve((await ask('输入安装目标目录：')).replace(/^~/, os.homedir()));
  }
  const prev = isInstalled(dest);
  if (prev?.sameVersion) {
    console.log('\n检测到已安装同版本，重新绑定资产包路径…');
    install(dest, true);
  } else if (prev) {
    console.error(`\n目标目录已有旧版本（${prev.binding.packageVersion}）。请先把它移出该目录再运行本向导（避免误删你的自定义内容）。`);
    process.exit(1);
  } else {
    install(dest, false);
  }
  console.log('\n✅ 安装完成，四个 Skill 已就位。接下来：');
  console.log(`  1. 把这个目录添加为你 agent 的自定义技能库：${dest}`);
  console.log('     （在 agent 的技能/扩展设置里把该目录注册为技能来源）');
  console.log('  2. 新开一个 AI 会话，直接说需求即可，例如："把这张截图转成页面"');
  console.log('     也可用 $skill-name 显式调用。');
  console.log('  3. 重要：原包文件夹不要删除或改名（skill 依赖它读取设计资产）。');
  console.log(`     当前包位置：${PACKAGE}`);
  console.log('     如果以后移动了包，重跑本向导（会自动重新绑定）。');
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) main();

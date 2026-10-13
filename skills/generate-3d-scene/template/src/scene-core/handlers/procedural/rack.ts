/**
 * handlers/procedural/rack — 精致代码机柜（框架结构 + 网孔门 + 分层服务器 + 状态灯）
 *
 * 核心手法：
 * - 柜体：薄壁盒组合（侧板/顶/底/背板分件，非实心方块）+ 框架立柱
 * - 网孔门：PlaneGeometry 打孔观感 = 半透明深色 + 高粗糙（低面数伪装网孔；真开孔要 Boolean，成本高）
 * - 服务器层：每层独立薄盒 + 前面板细节条 + 自发光状态灯（绿/红闪烁可业务驱动）
 * - 散热格栅：前面板斜纹凹槽用细长盒阵列
 */
import * as THREE from 'three';
import type { SceneEngine } from '../../engine/SceneEngine';
import type { SceneNode } from '../../types';
import { handlerUtils } from '../registry';

/** 标准机柜尺寸（42U 近似：2.0m 高 × 0.6 宽 × 0.8 深） */
const RACK = { w: 0.6, h: 2.0, d: 0.8, t: 0.03 }; // t=板厚

const SERVER_ROWS = 6;
const LAMP_COLORS = { green: '#2dff5e', red: '#ff3040' };

export const registerRackHandler = (sceneEngine: SceneEngine): void => {
  sceneEngine.registerFactory('coderacks', (node: SceneNode) => {
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    const params = node.params ?? {};
    const bodyColor = typeof params.bodyColor === 'string' ? params.bodyColor : '#3a3f46';

    const shell = new THREE.MeshStandardMaterial({ color: bodyColor, metalness: 0.6, roughness: 0.45 });
    const frame = new THREE.MeshStandardMaterial({ color: '#20242a', metalness: 0.55, roughness: 0.5 });
    const doorMesh = new THREE.MeshStandardMaterial({
      color: '#14161a', metalness: 0.35, roughness: 0.7,
      transparent: true, opacity: 0.88,
    });
    const panel = new THREE.MeshStandardMaterial({ color: '#565c66', metalness: 0.3, roughness: 0.55 });

    const { w, h, d, t } = RACK;
    const hw = w / 2;
    const hd = d / 2;

    // ── 柜体壳（侧×2 + 顶 + 底 + 背：五面薄板，留正面开口）
    const panels: Array<[THREE.BufferGeometry, [number, number, number], string]> = [
      [new THREE.BoxGeometry(t, h, d), [-hw + t / 2, h / 2, 0], 'panel_side_l'],
      [new THREE.BoxGeometry(t, h, d), [hw - t / 2, h / 2, 0], 'panel_side_r'],
      [new THREE.BoxGeometry(w, t, d), [0, h - t / 2, 0], 'panel_top'],
      [new THREE.BoxGeometry(w, t, d), [0, t / 2, 0], 'panel_bottom'],
      [new THREE.BoxGeometry(w - t * 2, h - t * 2, t), [0, h / 2, hd - t / 2], 'panel_back'],
    ];
    for (const [geo, pos, name] of panels) {
      const m = new THREE.Mesh(geo, shell);
      m.name = name;
      m.position.set(...pos);
      group.add(m);
    }

    // ── 正面框架立柱 ×2（带安装孔观感的凹槽立柱）
    for (const x of [-hw + 0.035, hw - 0.035]) {
      const lr = x < 0 ? 'l' : 'r';
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.03, h - 0.08, 0.05), frame);
      post.name = `post_${lr}`;
      post.position.set(x, h / 2, -hd + 0.045);
      group.add(post);
      // 立柱孔位（每 0.1m 一个小凹块，视觉近似 42U 孔位）
      let holeN = 0;
      for (let y = 0.12; y < h - 0.1; y += 0.095) {
        const hole = new THREE.Mesh(
          new THREE.BoxGeometry(0.012, 0.012, 0.012),
          new THREE.MeshStandardMaterial({ color: '#0c0e11', roughness: 0.9 }),
        );
        hole.name = `post_${lr}_hole${holeN++}`;
        hole.position.set(x, y, -hd + 0.072);
        group.add(hole);
      }
    }

    // ── 网孔门（前面板，微内凹，半透明深色 = 网孔观感）
    const door = new THREE.Mesh(new THREE.BoxGeometry(w - 0.1, h - 0.1, 0.015), doorMesh);
    door.name = 'door';
    door.position.set(0, h / 2, -hd + 0.02);
    group.add(door);
    // 门把手（竖条）
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.24, 0.025), panel);
    handle.name = 'door_handle';
    handle.position.set(hw - 0.07, h / 2, -hd + 0.045);
    group.add(handle);

    // ── 服务器层（可透视：网孔门内可见的仓段）
    const bayH = (h - 0.3) / SERVER_ROWS;
    for (let i = 0; i < SERVER_ROWS; i++) {
      const y = 0.18 + i * bayH;
      const server = new THREE.Mesh(new THREE.BoxGeometry(w - 0.13, bayH - 0.025, d - 0.28), panel);
      server.name = `server_${i + 1}`;
      server.position.set(0, y + bayH / 2 - 0.05, -0.02);
      group.add(server);
      // 前面板细节：左把手条 + 右通风槽
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.015, bayH - 0.06, 0.015), frame);
      ear.name = `server_${i + 1}_ear`;
      ear.position.set(-hw + 0.09, y + bayH / 2 - 0.05, -hd + 0.10);
      group.add(ear);
      const vent = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, bayH - 0.08, 0.008),
        new THREE.MeshStandardMaterial({ color: '#26292f', roughness: 0.8 }),
      );
      vent.name = `server_${i + 1}_vent`;
      vent.position.set(hw - 0.16, y + bayH / 2 - 0.05, -hd + 0.10);
      group.add(vent);
      // 状态灯：绿常亮 + 红一颗（顶部服务器 = 告警位）
      const isAlarm = i === SERVER_ROWS - 1;
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(0.011, 8, 6),
        new THREE.MeshStandardMaterial({
          color: isAlarm ? LAMP_COLORS.red : LAMP_COLORS.green,
          emissive: isAlarm ? LAMP_COLORS.red : LAMP_COLORS.green,
          emissiveIntensity: isAlarm ? 2.2 : 1.4,
        }),
      );
      lamp.name = `server_${i + 1}_lamp`;
      lamp.position.set(-hw + 0.13, y + bayH / 2 - 0.02, -hd + 0.10);
      group.add(lamp);
    }

    // ── 底脚 ×4
    for (const [x, z, name] of [
      [-hw + 0.06, -hd + 0.06, 'fl'], [hw - 0.06, -hd + 0.06, 'fr'],
      [-hw + 0.06, hd - 0.06, 'bl'], [hw - 0.06, hd - 0.06, 'br'],
    ] as const) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.032, 0.05, 10), frame);
      foot.name = `foot_${name}`;
      foot.position.set(x, 0.025, z);
      group.add(foot);
    }

    return group;
  });
};

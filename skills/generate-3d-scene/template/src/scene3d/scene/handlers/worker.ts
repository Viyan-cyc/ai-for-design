/**
 * handlers/procedural/worker — 精致代码工人（曲线放样躯干 + Lathe 安全帽 + 关节化四肢）
 *
 * 核心手法：
 * - 躯干/四肢：LatheGeometry 或锥度圆柱（有肌肉锥度，非等粗直筒）
 * - 头：SphereGeometry 半球比例精调
 * - 安全帽：SphereGeometry 上半 + Lathe 车削帽檐（弧形前沿）
 * - 反光条：躯干环绕薄环，高金属低粗糙
 * - 姿态：四肢带微角度（A-pose 放松态），非机械垂直
 */
import * as THREE from 'three';
import type { SceneEngine } from '../../scene-core/index';
import type { SceneNode } from '../../scene-core/types';
import { handlerUtils } from '../../scene-core/handlers/registry';

/** 比例基准（身高 ~1.78m 站姿） */
const H = {
  head: 0.115, neck: 0.05, shoulderY: 1.44, chestTop: 1.42, waistY: 1.06,
  hipY: 0.94, armTop: 1.40, armLen: 0.58, legTop: 0.92, legLen: 0.88, footY: 0.045,
};

const suitMat = (color: string): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0.02 });

/** 锥度圆柱（ limbs 用：上粗下细的肌肉线条） */
const tapered = (rTop: number, rBot: number, len: number, seg = 10): THREE.CylinderGeometry =>
  new THREE.CylinderGeometry(rTop, rBot, len, seg);

export const registerWorkerHandler = (sceneEngine: SceneEngine): void => {
  sceneEngine.registerFactory('codeworkers', (node: SceneNode) => {
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    const params = node.params ?? {};
    const suitColor = typeof params.suitColor === 'string' ? params.suitColor : '#e07020';

    const suit = suitMat(suitColor);
    const pants = suitMat('#2a3550');
    const skin = new THREE.MeshStandardMaterial({ color: '#c98e6b', roughness: 0.6 });
    const helmet = new THREE.MeshStandardMaterial({ color: '#f5c518', roughness: 0.35, metalness: 0.15 });
    const dark = new THREE.MeshStandardMaterial({ color: '#181a1e', roughness: 0.8 });
    const reflect = new THREE.MeshStandardMaterial({
      color: '#c8ccd2', roughness: 0.15, metalness: 0.7, emissive: '#30343a', emissiveIntensity: 0.25,
    });

    // ── 腿（锥度 + 膝盖微前倾姿态）
    for (const side of [-1, 1]) {
      const x = side * 0.095;
      const lr = side < 0 ? 'l' : 'r';
      const thigh = new THREE.Mesh(tapered(0.085, 0.07, H.legTop - 0.46), pants);
      thigh.name = `thigh_${lr}`;
      thigh.position.set(x, H.legTop - 0.23, 0);
      const calf = new THREE.Mesh(tapered(0.065, 0.05, 0.42), pants);
      calf.name = `calf_${lr}`;
      calf.position.set(x, 0.44, 0.012);
      group.add(thigh, calf);
      // 鞋（前伸）
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.07, 0.26), dark);
      shoe.name = `shoe_${lr}`;
      shoe.position.set(x, 0.045, 0.06);
      group.add(shoe);
    }

    // ── 躯干（胸肩宽腰窄：上下两段锥度圆柱 + 骨盆）
    const chest = new THREE.Mesh(tapered(0.21, 0.155, 0.38, 14), suit);
    chest.name = 'chest';
    chest.scale.z = 0.72;
    chest.position.y = (H.waistY + H.chestTop) / 2;
    const pelvis = new THREE.Mesh(tapered(0.16, 0.14, 0.16, 12), pants);
    pelvis.name = 'pelvis';
    pelvis.scale.z = 0.75;
    pelvis.position.y = H.hipY - 0.06;
    group.add(chest, pelvis);
    // 腰带
    const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.165, 0.165, 0.045, 14), dark);
    belt.name = 'belt';
    belt.scale.z = 0.76;
    belt.position.y = H.waistY + 0.01;
    group.add(belt);
    // 胸口反光条（环绕薄环）×2
    for (const [i, y] of [1.30, 1.38].entries()) {
      const strip = new THREE.Mesh(new THREE.CylinderGeometry(0.212, 0.208, 0.035, 14), reflect);
      strip.name = `reflect_strip_${i + 1}`;
      strip.scale.z = 0.73;
      strip.position.y = y;
      group.add(strip);
    }

    // ── 头 + 脖子
    const neck = new THREE.Mesh(tapered(0.045, 0.055, 0.09), skin);
    neck.name = 'neck';
    neck.position.y = 1.50;
    group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(H.head, 18, 14), skin);
    head.name = 'head';
    head.scale.set(0.94, 1.05, 1.0);
    head.position.y = 1.635;
    group.add(head);
    // ── 安全帽（上半球 + Lathe 弧形帽檐 + 顶脊）
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(H.head + 0.022, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      helmet,
    );
    dome.name = 'helmet_dome';
    dome.position.y = 1.665;
    group.add(dome);
    const brimProfile: THREE.Vector2[] = [];
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      brimProfile.push(new THREE.Vector2(H.head + 0.005 + t * 0.045, -t * 0.018));
    }
    const brim = new THREE.Mesh(new THREE.LatheGeometry(brimProfile, 20), helmet);
    brim.name = 'helmet_brim';
    brim.position.y = 1.70;
    group.add(brim);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.03, 0.20), helmet);
    ridge.name = 'helmet_ridge';
    ridge.position.y = 1.795;
    group.add(ridge);

    // ── 手臂（肩→肘锥度 + 前臂 + 手；A-pose 微张）
    for (const side of [-1, 1]) {
      const lr = side < 0 ? 'l' : 'r';
      const shoulderX = side * 0.235;
      // 肩球
      const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.072, 12, 10), suit);
      shoulder.name = `shoulder_${lr}`;
      shoulder.position.set(shoulderX, H.armTop, 0);
      group.add(shoulder);
      // 上臂（微外张约 8°）
      const upper = new THREE.Mesh(tapered(0.062, 0.052, 0.32), suit);
      upper.name = `upper_arm_${lr}`;
      const upperGroup = new THREE.Group();
      upperGroup.position.set(shoulderX, H.armTop - 0.03, 0);
      upperGroup.rotation.z = side * -0.14;
      upper.position.y = -0.16;
      upperGroup.add(upper);
      group.add(upperGroup);
      // 前臂 + 手（接上臂末端，微前摆）
      const elbowWorld = new THREE.Vector3(
        shoulderX + Math.sin(0.14) * 0.32 * side, H.armTop - 0.03 - Math.cos(0.14) * 0.32, 0,
      );
      const foreGroup = new THREE.Group();
      foreGroup.position.copy(elbowWorld);
      foreGroup.rotation.z = side * -0.24;
      foreGroup.rotation.x = 0.10;
      const fore = new THREE.Mesh(tapered(0.05, 0.04, 0.30), suit);
      fore.name = `forearm_${lr}`;
      fore.position.y = -0.15;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
      hand.name = `hand_${lr}`;
      hand.scale.set(0.85, 1.15, 0.55);
      hand.position.y = -0.33;
      foreGroup.add(fore, hand);
      group.add(foreGroup);
    }

    return group;
  });
};

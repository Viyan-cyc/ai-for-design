/**
 * handlers/procedural/car — 精致代码轿车（Shape 轮廓挤出车身，非方块拼装）
 *
 * 核心手法：
 * - 车身：侧视 2D 轮廓（发动机盖斜线 + A/C 柱倾角 + 尾箱折线）ExtrudeGeometry 挤出 + bevel 倒角
 * - 座舱玻璃：内缩轮廓单独挤出，半透明深色
 * - 车轮：LatheGeometry 车削（胎侧弧面）+ 圆柱轮毂 + 环面胎唇
 * - 灯具：小幅挤出嵌入车身前后，自发光
 * - 材质：金属漆（高金属低粗糙）/ 玻璃（低粗糙半透明）/ 塑料保险杠（低金属高粗糙）
 */
import * as THREE from 'three';
import type { SceneEngine } from '../../engine/SceneEngine';
import type { SceneNode } from '../../types';
import { handlerUtils } from '../registry';

/** 车身侧视轮廓（x=车长方向，y=高度；单位米）。手调：前悬短后悬长，机盖下压，溜背收尾 */
const BODY_OUTLINE: Array<[number, number]> = [
  // 车头→机盖
  [-2.05, 0.32], [-1.95, 0.55], [-1.30, 0.62], [-0.85, 0.60],
  // A 柱→车顶→C 柱
  [-0.72, 1.06], [0.42, 1.10], [0.95, 1.02],
  // 溜背→尾箱
  [1.55, 0.72], [1.98, 0.68], [2.05, 0.45], [2.05, 0.32],
  // 后保险杠内凹
  [1.85, 0.18], [1.60, 0.22],
  // 底边（侧裙留缺）
  [1.20, 0.22], [-1.20, 0.22],
  // 前保险杠内凹
  [-1.60, 0.22], [-1.95, 0.18],
];

/** 座舱玻璃轮廓（ windshield→roof→rear window，比车身缩进） */
const GLASS_OUTLINE: Array<[number, number]> = [
  [-0.68, 0.64], [-0.58, 1.02], [0.38, 1.06], [0.88, 0.70], [0.5, 0.66], [-0.3, 0.66],
];

const WIDTH = 1.78;
const WHEEL = { radius: 0.34, width: 0.24, hubRadius: 0.20, x: 1.28, y: 0.34 };

/** 2D 轮廓 → 挤出网格（居中于 z 轴，bevel 给边缘光影） */
const extrudeOutline = (
  points: Array<[number, number]>,
  depth: number,
  bevel: number,
): THREE.BufferGeometry => {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 6,
  });
  geo.translate(0, 0, -(depth - bevel * 2) / 2 - bevel);
  geo.computeVertexNormals();
  return geo;
};

/** 轮胎（Lathe 车削胎侧弧面 + 两道胎唇环） */
const buildTire = (): THREE.Group => {
  const g = new THREE.Group();
  g.name = 'tire';
  const rubber = new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.95, metalness: 0.05 });
  // 胎侧弧面：从轮辋半径到胎面半径的弧线车削
  const profile: THREE.Vector2[] = [];
  const steps = 6;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const r = WHEEL.hubRadius + (WHEEL.radius - WHEEL.hubRadius) * t;
    const bulge = Math.sin(t * Math.PI) * 0.045; // 胎侧鼓包
    profile.push(new THREE.Vector2(r, -WHEEL.width / 2 + bulge));
  }
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const r = WHEEL.hubRadius + (WHEEL.radius - WHEEL.hubRadius) * t;
    const bulge = Math.sin(t * Math.PI) * 0.045;
    profile.push(new THREE.Vector2(r, WHEEL.width / 2 - bulge));
  }
  const tire = new THREE.Mesh(new THREE.LatheGeometry(profile, 24), rubber);
  tire.name = 'sidewall';
  tire.rotation.x = Math.PI / 2;
  // 胎面
  const tread = new THREE.Mesh(
    new THREE.CylinderGeometry(WHEEL.radius + 0.008, WHEEL.radius + 0.008, WHEEL.width * 0.82, 24),
    rubber,
  );
  tread.name = 'tread';
  tread.rotation.x = Math.PI / 2;
  g.add(tire, tread);
  // 轮毂：盘面 + 五辐条
  const alloy = new THREE.MeshStandardMaterial({ color: '#b8bcc4', metalness: 0.9, roughness: 0.25 });
  for (const side of [-1, 1]) {
    const s = side < 0 ? 'inner' : 'outer';
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(WHEEL.hubRadius, WHEEL.hubRadius, 0.02, 24),
      alloy,
    );
    disc.name = `hub_disc_${s}`;
    disc.rotation.x = Math.PI / 2;
    disc.position.z = (side * WHEEL.width) / 2 - side * 0.01;
    g.add(disc);
    for (let i = 0; i < 5; i++) {
      const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.045, WHEEL.hubRadius * 1.7, 0.03), alloy);
      spoke.name = `hub_spoke_${s}${i}`;
      spoke.rotation.z = (i / 5) * Math.PI * 2;
      spoke.position.z = side * (WHEEL.width / 2 + 0.008);
      g.add(spoke);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 12), alloy);
    hub.name = `hub_cap_${s}`;
    hub.rotation.x = Math.PI / 2;
    hub.position.z = side * (WHEEL.width / 2 + 0.01);
    g.add(hub);
  }
  return g;
};

export const registerCarHandler = (sceneEngine: SceneEngine): void => {
  sceneEngine.registerFactory('codecars', (node: SceneNode) => {
    const group = new THREE.Group();
    handlerUtils.applyTransform(group, node);
    const params = node.params ?? {};
    const paintColor = typeof params.paintColor === 'string' ? params.paintColor : '#2c5f9e';

    // 轮廓沿 X 设计（车头 -X）；统一资产正面为 +Z（model-spec.md），在构造阶段整体转 90°
    // （绕 +Y 旋转 +90°：局部 -X 车头指向世界 +Z），不在摆放时加特殊旋转补偿。
    const build = new THREE.Group();
    build.name = 'car_body';
    build.rotation.y = Math.PI / 2;
    group.add(build);
    const host = build;

    // ── 车身（轮廓挤出 + 倒角）
    const paint = new THREE.MeshStandardMaterial({
      color: paintColor, metalness: 0.75, roughness: 0.28,
    });
    const body = new THREE.Mesh(extrudeOutline(BODY_OUTLINE, WIDTH, 0.06), paint);
    body.name = 'body';
    host.add(body);

    // ── 座舱玻璃（独立轮廓，缩进+抬高避免 z-fighting）
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#182028', metalness: 0.1, roughness: 0.06,
      transparent: true, opacity: 0.82,
    });
    const cabin = new THREE.Mesh(extrudeOutline(GLASS_OUTLINE, WIDTH - 0.14, 0.03), glass);
    cabin.name = 'cabin_glass';
    host.add(cabin);

    // ── 前后保险杠（哑光塑料，贴齐车身端面）
    const bumperMat = new THREE.MeshStandardMaterial({ color: '#1d1f24', metalness: 0.15, roughness: 0.75 });
    for (const [bx, flip, end] of [[-2.02, 1, 'front'], [2.02, -1, 'rear']] as const) {
      const bumper = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.30, WIDTH - 0.10),
        bumperMat,
      );
      bumper.name = `bumper_${end}`;
      bumper.position.set(bx, 0.27, 0);
      host.add(bumper);
      // 通风口格栅
      const grille = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.10, WIDTH - 0.5),
        new THREE.MeshStandardMaterial({ color: '#0c0d10', roughness: 0.6 }),
      );
      grille.name = `grille_${end}`;
      grille.position.set(bx - flip * 0.075, 0.34, 0);
      host.add(grille);
    }

    // ── 车灯（嵌入端面，自发光）
    const headMat = new THREE.MeshStandardMaterial({
      color: '#e8f0ff', emissive: '#cfe0ff', emissiveIntensity: 1.6, roughness: 0.2,
    });
    const tailMat = new THREE.MeshStandardMaterial({
      color: '#7a0e0e', emissive: '#ff2020', emissiveIntensity: 1.2, roughness: 0.3,
    });
    for (const side of [-1, 1]) {
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.10, 0.34), headMat);
      head.name = `headlight_${side < 0 ? 'l' : 'r'}`;
      head.position.set(-2.06, 0.52, side * (WIDTH / 2 - 0.28));
      host.add(head);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.09, 0.30), tailMat);
      tail.name = `taillight_${side < 0 ? 'l' : 'r'}`;
      tail.position.set(2.06, 0.60, side * (WIDTH / 2 - 0.26));
      host.add(tail);
    }

    // ── 后视镜
    const mirrorMat = new THREE.MeshStandardMaterial({ color: '#1d1f24', metalness: 0.3, roughness: 0.5 });
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.12), mirrorMat);
      arm.name = `mirror_arm_${side < 0 ? 'l' : 'r'}`;
      arm.position.set(-0.62, 0.96, side * (WIDTH / 2 + 0.02));
      host.add(arm);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.08, 0.05), paint);
      cap.name = `mirror_cap_${side < 0 ? 'l' : 'r'}`;
      cap.position.set(-0.62, 0.96, side * (WIDTH / 2 + 0.09));
      host.add(cap);
    }

    // ── 车轮（四个，前轮略内束视觉可忽略）
    for (const wheelPos of [
      [-WHEEL.x, WIDTH / 2 - WHEEL.width / 2 + 0.02], [WHEEL.x, WIDTH / 2 - WHEEL.width / 2 + 0.02],
      [-WHEEL.x, -(WIDTH / 2 - WHEEL.width / 2 + 0.02)], [WHEEL.x, -(WIDTH / 2 - WHEEL.width / 2 + 0.02)],
    ] as Array<[number, number]>) {
      const x = wheelPos[0];
      const z = wheelPos[1];
      const pos = x < 0 ? 'front' : 'rear';
      const side = z > 0 ? 'l' : 'r';
      const wheel = buildTire();
      wheel.name = `wheel_${pos}_${side}`;
      wheel.position.set(x, WHEEL.y, z);
      host.add(wheel);
      // 轮眉（拱形薄壳，半球柱裁一半）
      const fender = new THREE.Mesh(
        new THREE.CylinderGeometry(WHEEL.radius + 0.07, WHEEL.radius + 0.07, WHEEL.width + 0.06, 18, 1, false, 0, Math.PI),
        paint,
      );
      fender.name = `fender_${pos}_${side}`;
      fender.rotation.z = Math.PI / 2;
      fender.rotation.y = z > 0 ? -Math.PI / 2 : Math.PI / 2;
      fender.position.set(x, WHEEL.y, z);
      host.add(fender);
    }

    // ── 车顶天线（小细节）
    const antenna = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.28, 6),
      new THREE.MeshStandardMaterial({ color: '#111', roughness: 0.5 }),
    );
    antenna.name = 'antenna';
    antenna.position.set(1.15, 1.16, -0.3);
    antenna.rotation.z = -0.15;
    host.add(antenna);

    return group;
  });
};

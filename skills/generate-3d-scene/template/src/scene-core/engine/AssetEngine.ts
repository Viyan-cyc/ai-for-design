/**
 * AssetEngine — GLB/GLTF 资产加载（缓存 + 规格预检）
 *
 * 资产从模板 assetsLibrary 目录取（vite ?url 或 public 路径），同一 assetId 只加载一次，
 * 后续实例用 clone()（共享几何与材质，内存友好）。
 * 加载后跑一次规格统计（面数/节点/贴图/bbox），超限在 console 报警（入库门禁在
 * validate-model.mjs，此处是运行时兜底提示）。
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ModelSpecReport, Vec3 } from '../types';

/** 资产规格默认上限（与 skill 的 model-spec.md 对齐） */
export const MODEL_SPEC_LIMITS = {
  maxTriangles: 10000,
  maxNodes: 64,
  maxTextureSize: 1024,
  originTolerance: 0.01,
};

interface CacheEntry {

  /** 原始加载结果（clone 源） */
  root: THREE.Object3D;
  report: ModelSpecReport;
  promise: Promise<void>;
}

const countStats = (root: THREE.Object3D): { triangles: number; nodeCount: number } => {
  let triangles = 0;
  let nodeCount = 0;
  root.traverse((child) => {
    nodeCount += 1;
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh && mesh.geometry) {
      const geo = mesh.geometry;
      if (geo.index) {
        triangles += geo.index.count / 3;
      } else if (geo.attributes.position) {
        triangles += geo.attributes.position.count / 3;
      }
    }
  });
  return { triangles: Math.round(triangles), nodeCount };
};

const collectTextures = (root: THREE.Object3D): { count: number; maxSize: number } => {
  const seen = new Set<THREE.Texture>();
  let maxSize = 0;
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) {
      return;
    }
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      for (const tex of [std.map, std.normalMap, std.roughnessMap, std.metalnessMap, std.emissiveMap]) {
        if (tex && !seen.has(tex)) {
          seen.add(tex);
          const img = tex.image as { width?: number; height?: number } | undefined;
          if (img?.width) {
            maxSize = Math.max(maxSize, img.width, img.height ?? 0);
          }
        }
      }
    }
  });
  return { count: seen.size, maxSize };
};

const checkNaming = (root: THREE.Object3D): string[] => {
  const violations: string[] = [];
  root.traverse((child) => {
    if (child.name && !/^[a-z][a-z0-9_]*$/.test(child.name)) {
      violations.push(child.name);
    }
  });
  return violations;
};

export class AssetEngine {
  private cache = new Map<string, CacheEntry>();

  private loader = new GLTFLoader();

  /**
   * 获取资产实例（命中缓存即 clone，未命中先加载）。
   * @param assetId 资产 id（报告与日志用）
   * @param url 模型文件 URL
   */
  async getInstance(assetId: string, url: string): Promise<THREE.Object3D> {
    let entry = this.cache.get(assetId);
    if (!entry) {
      const gltf = await this.loader.loadAsync(url);
      const root = gltf.scene;
      entry = {
        root,
        report: this.buildReport(assetId, root),
        promise: Promise.resolve(),
      };
      this.cache.set(assetId, entry);
      this.warnIfOversized(entry.report);
    }
    return entry.root.clone(true);
  }

  /** 已缓存资产的规格报告（无需重新解析） */
  getReport(assetId: string): ModelSpecReport | null {
    return this.cache.get(assetId)?.report ?? null;
  }

  private buildReport(assetId: string, root: THREE.Object3D): ModelSpecReport {
    const { triangles, nodeCount } = countStats(root);
    const { count, maxSize } = collectTextures(root);
    const bbox = new THREE.Box3().setFromObject(root);
    const min: Vec3 = [bbox.min.x, bbox.min.y, bbox.min.z];
    const max: Vec3 = [bbox.max.x, bbox.max.y, bbox.max.z];
    const namingViolations = checkNaming(root);
    const violations: string[] = [];
    if (triangles > MODEL_SPEC_LIMITS.maxTriangles) {
      violations.push(`面数超限: ${triangles} > ${MODEL_SPEC_LIMITS.maxTriangles}`);
    }
    if (nodeCount > MODEL_SPEC_LIMITS.maxNodes) {
      violations.push(`节点数超限: ${nodeCount} > ${MODEL_SPEC_LIMITS.maxNodes}`);
    }
    if (maxSize > MODEL_SPEC_LIMITS.maxTextureSize) {
      violations.push(`贴图超限: ${maxSize} > ${MODEL_SPEC_LIMITS.maxTextureSize}`);
    }
    const originOk = Math.abs(bbox.min.y) <= MODEL_SPEC_LIMITS.originTolerance;
    if (!originOk) {
      violations.push(`原点不符: bbox.min.y=${bbox.min.y.toFixed(4)}（应为 0）`);
    }
    const namingOk = namingViolations.length === 0;
    if (!namingOk) {
      violations.push(`命名违规: ${namingViolations.join(', ')}`);
    }
    return {
      assetId,
      triangles,
      nodeCount,
      textureCount: count,
      maxTextureSize: maxSize,
      bbox: { min, max, height: bbox.max.y - bbox.min.y },
      originOk,
      namingOk,
      namingViolations,
      passed: violations.length === 0,
      violations,
    };
  }

  /** 超限告警（不阻断运行——门禁职责在入库脚本，这里是运行时提醒） */
  private warnIfOversized(report: ModelSpecReport): void {
    if (!report.passed) {
      console.warn(`[AssetEngine] 资产 ${report.assetId} 规格违规:\n  ${report.violations.join('\n  ')}`);
    }
  }

  /** 释放全部缓存（geometry/material 由 GPU 侧释放） */
  dispose(): void {
    this.cache.forEach((entry) => {
      entry.root.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m?.dispose());
        }
      });
    });
    this.cache.clear();
  }
}

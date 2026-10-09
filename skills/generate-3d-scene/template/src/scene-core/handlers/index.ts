/**
 * handlers/index — handler 统一出口
 *
 * 内建工厂（图元/asset）在 registry 中注册；业务 handler（example）在此逐个启用。
 * 二开者新增 handler：写文件 → 在此 import + registerXxx → scene-data.json 用对应分组 key。
 */
export { registerBuiltinFactories, handlerUtils } from './registry';
export { registerExampleHandler } from './example/example';
export { registerTreeHandler } from './procedural/tree';

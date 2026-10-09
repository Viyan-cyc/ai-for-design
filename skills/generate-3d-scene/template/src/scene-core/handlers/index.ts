/**
 * handlers/index — handler 统一出口
 *
 * 内建工厂在 registry 中注册；业务 handler（如 example）在此逐个启用。
 * 二开者新增 handler：写文件 → 在此 import + registerXxx → scene-data.json 用对应 type。
 */
export { registerBuiltinFactories, handlerUtils } from './registry';
export { registerExampleHandler } from './example/windTurbine';

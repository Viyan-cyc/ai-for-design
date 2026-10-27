# generate-3d-scene 开发维护

skills/generate-3d-scene 仅保留生产内容。维护入口（仓库根目录执行）：

- 打包：`node tools/generate-3d-scene/pack-skill.mjs dist/generate-3d-scene.zip`
- 基准：`node benchmarks/generate-3d-scene/benchmark.mjs --project <工程>`
- 测试位于 tests/generate-3d-scene。历史测试中的相对命令仍以 skill 为工作目录，建议先 `cd skills/generate-3d-scene`，再 `node ../../tests/generate-3d-scene/<测试名>.mjs`。
- 测试资产：tests/fixtures/generate-3d-scene。
- spec 和 dist 演示产物保持在仓库外层，不进入 skill。
- 生产 build.mjs、composite-check.mjs 等构建检查仍保留在 skill；它们不是维护测试。

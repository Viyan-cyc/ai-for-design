# verify/compiler —— 依赖树未安装（哨兵）

本目录只保留 `package.json`（依赖声明真源）。依赖实体（node_modules，~19MB）
不住 skill 包——在用户机器的共享池里，由 `scripts/setup-compiler.mjs` 安装生成。

**本文件存在 = 该机器尚未安装依赖。** 安装成功后 setup 脚本会删除本文件。

修复：`node scripts/setup-compiler.mjs`（内网 npm 源，约 10-30s）

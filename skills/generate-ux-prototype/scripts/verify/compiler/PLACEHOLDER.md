# verify/compiler —— 编译器依赖声明目录（纯文档，常驻）

本目录只保留 `package.json`（依赖声明）+ `package-lock.json`（版本锁定真源）。
依赖实体（node_modules，~19MB）不住 skill 包——在用户机器的共享池里，由
`scripts/setup-compiler.mjs` 安装生成（fastui 式：npm install 现场生长）。

- 共享池落点：Windows `%LOCALAPPDATA%\OctoAgent\ux-prototype\`；macOS
  `~/Library/Application Support/OctoAgent/ux-prototype/`；Linux `$XDG_DATA_HOME`。
- 本机装没装由共享池 `env.lock.json` 判定（ensure-compiler.mjs / init / build 自动校验），
  本文件是机制说明，常驻不删——维护 skill 时**不要**手动创建或删除它。
- 依赖树升级：改 `package.json` 后在本目录跑 `npm install --package-lock-only`
  重新生成 lockfile，提交两者；各机器下次跑 setup 时按 lockfileHash 漂移检测自动提示重装。

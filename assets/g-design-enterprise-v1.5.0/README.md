# G Design Enterprise V1.5

三个维护区域：**design** 管数值与规则，**components** 管组件/模板规范，**frontend/element-plus** 管实现。

## 最常用入口

- [设计数值](design/tokens.json)、[使用规则](design/rules.md)、[生成数值表](design/tokens.md)
- [组件索引](components/index.json)、[模板索引](components/templates.json)、[交互结果](components/interactions.json)
- [前端接入](frontend/element-plus/README.md)

## 修改后怎么同步

```sh
python3 -B scripts/build_tokens.py
python3 -B scripts/build_indexes.py
python3 -B scripts/validate_library.py --skip-lock
python3 -B scripts/refresh_release.py
python3 -B scripts/validate_library.py
```

前三步生成和检查；refresh_release 只在确认源资产变更后更新锁，不用它掩盖来源异常。前端变更还需在 frontend/element-plus 运行构建和适当交互检查。

修改数值只编辑 design/tokens.json；修改设计规则按通用、颜色、毛玻璃专题分别编辑 design/rules.md、design/color-rules.md、design/frosted-glass.md；修改资产用途/路径编辑 components/specs 或 components/templates；修改实现编辑 frontend/element-plus/src。新增变量同时添加 bindings 声明，生成与检查会发现断开的引用。

可以运行 `python3 scripts/query_assets.py tokens --search frost` 查询分组；查询命令只返回必要内容，避免模型全量读取。

发布新包时，用包根目录 scripts/build_release.py --version X.Y.Z 统一更新版本、生成物、索引和来源锁。生成原型读取 manifest 的实际版本，不从文件夹名字推断。

色彩入口：[颜色使用规范](design/color-rules.md)、[颜色 Token 与用途表](design/color-tokens.md)。后者由 tokens.json 自动生成，无需加载原始附件。

局部毛玻璃材质见 [frosted-glass.md](design/frosted-glass.md)，参数查询 `python3 scripts/query_assets.py tokens --search frost`。

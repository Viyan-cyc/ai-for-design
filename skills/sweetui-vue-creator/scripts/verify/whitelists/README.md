# sweetui-icons.json — 内网提取指引

当前为空数组占位。**真实内容由内网生成**：

```bash
# 从 SweetUI 包 theme-chalk 字体图标类名提取（720 个）：
grep -oE '\.sweetui-icon-[a-z0-9-]+' <解包路径>/@hw-seq/sweet-ui-base/theme-chalk/*.css \
  | sed 's/.*://' | sort -u | sed 's/^\.//' > icons-raw.txt

# 转成 JSON 数组（去掉 -l / -f 后缀前的语义名，或保留全类名——与 build.mjs 检查口径一致即可）：
node -e "const l=require('fs').readFileSync('icons-raw.txt','utf8').split('\n').filter(Boolean).sort(); \
  require('fs').writeFileSync('sweetui-icons.json', JSON.stringify(l,null,2)+'\n')"
```

口径约定（与 `build.mjs` 图标检查一致）：
- 存**语义名**（去 `-l`/`-f` 后缀），例如 `search`、`add`；`<icon-plus name="search">` 派生类名 `sweetui-icon-search-l` 命中即通过。
- 提取后跑一遍 `node scripts/gen-whitelists.mjs` 校验，或直接替换本文件。
- icon+ 命中的语义（fetch-icons 已下载 SVG 到 `src/assets/icons/`）不进本文件——build 检查时与 SVG 文件名求并集。

# H Design 颜色 Token 表（自动生成）

唯一维护源为 [tokens.json](tokens.json)，颜色用法见 [color-rules.md](color-rules.md)。value/usage/codeMapping 变更后运行 scripts/build_tokens.mjs；不要手改此表。

包含基础与辅助色、UI 明暗语义、图表方案、代码浅深色及其用途。深色 UI 为项目兼容方案；代码明暗值来自 H Design 语义明细表。

## foundation

:root

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--rose-05` | `#FEE5F2` | `#FEE5F2` | 公司数字色板；--rose 色相 05 级，用于建立语义映射与图表序列 |
| `--rose-10` | `#FCC3E0` | `#FCC3E0` | 公司数字色板；--rose 色相 10 级，用于建立语义映射与图表序列 |
| `--rose-20` | `#F99AC7` | `#F99AC7` | 公司数字色板；--rose 色相 20 级，用于建立语义映射与图表序列 |
| `--rose-30` | `#F470AB` | `#F470AB` | 公司数字色板；--rose 色相 30 级，用于建立语义映射与图表序列 |
| `--rose-40` | `#ED448A` | `#ED448A` | 公司数字色板；--rose 色相 40 级，用于建立语义映射与图表序列 |
| `--rose-50` | `#E61866` | `#E61866` | 公司数字色板；--rose 色相 50 级，用于建立语义映射与图表序列 |
| `--rose-60` | `#C40054` | `#C40054` | 公司数字色板；--rose 色相 60 级，用于建立语义映射与图表序列 |
| `--rose-70` | `#811439` | `#811439` | 公司数字色板；--rose 色相 70 级，用于建立语义映射与图表序列 |
| `--rose-80` | `#540D24` | `#540D24` | 公司数字色板；--rose 色相 80 级，用于建立语义映射与图表序列 |
| `--rose-90` | `#330614` | `#330614` | 公司数字色板；--rose 色相 90 级，用于建立语义映射与图表序列 |
| `--red-05` | `#FEE7E8` | `#FEE7E8` | 公司数字色板；--red 色相 05 级，用于建立语义映射与图表序列 |
| `--red-10` | `#FABDC1` | `#FABDC1` | 公司数字色板；--red 色相 10 级，用于建立语义映射与图表序列 |
| `--red-20` | `#F59297` | `#F59297` | 公司数字色板；--red 色相 20 级，用于建立语义映射与图表序列 |
| `--red-30` | `#EE696F` | `#EE696F` | 公司数字色板；--red 色相 30 级，用于建立语义映射与图表序列 |
| `--red-40` | `#E7434A` | `#E7434A` | 公司数字色板；--red 色相 40 级，用于建立语义映射与图表序列 |
| `--red-50` | `#E02128` | `#E02128` | 公司数字色板；--red 色相 50 级，用于建立语义映射与图表序列 |
| `--red-60` | `#C7000B` | `#C7000B` | 公司数字色板；--red 色相 60 级，用于建立语义映射与图表序列 |
| `--red-70` | `#850F12` | `#850F12` | 公司数字色板；--red 色相 70 级，用于建立语义映射与图表序列 |
| `--red-80` | `#59080A` | `#59080A` | 公司数字色板；--red 色相 80 级，用于建立语义映射与图表序列 |
| `--red-90` | `#350305` | `#350305` | 公司数字色板；--red 色相 90 级，用于建立语义映射与图表序列 |
| `--orange-05` | `#FEF5E8` | `#FEF5E8` | 公司数字色板；--orange 色相 05 级，用于建立语义映射与图表序列 |
| `--orange-10` | `#FDE2BD` | `#FDE2BD` | 公司数字色板；--orange 色相 10 级，用于建立语义映射与图表序列 |
| `--orange-20` | `#FCCE92` | `#FCCE92` | 公司数字色板；--orange 色相 20 级，用于建立语义映射与图表序列 |
| `--orange-30` | `#F9B766` | `#F9B766` | 公司数字色板；--orange 色相 30 级，用于建立语义映射与图表序列 |
| `--orange-40` | `#F69E39` | `#F69E39` | 公司数字色板；--orange 色相 40 级，用于建立语义映射与图表序列 |
| `--orange-50` | `#F4840C` | `#F4840C` | 公司数字色板；--orange 色相 50 级，用于建立语义映射与图表序列 |
| `--orange-60` | `#C76207` | `#C76207` | 公司数字色板；--orange 色相 60 级，用于建立语义映射与图表序列 |
| `--orange-70` | `#954304` | `#954304` | 公司数字色板；--orange 色相 70 级，用于建立语义映射与图表序列 |
| `--orange-80` | `#642802` | `#642802` | 公司数字色板；--orange 色相 80 级，用于建立语义映射与图表序列 |
| `--orange-90` | `#3D1601` | `#3D1601` | 公司数字色板；--orange 色相 90 级，用于建立语义映射与图表序列 |
| `--yellow-05` | `#FEFCE0` | `#FEFCE0` | 公司数字色板；--yellow 色相 05 级，用于建立语义映射与图表序列 |
| `--yellow-10` | `#FEF8B8` | `#FEF8B8` | 公司数字色板；--yellow 色相 10 级，用于建立语义映射与图表序列 |
| `--yellow-20` | `#FEF08A` | `#FEF08A` | 公司数字色板；--yellow 色相 20 级，用于建立语义映射与图表序列 |
| `--yellow-30` | `#FDE55C` | `#FDE55C` | 公司数字色板；--yellow 色相 30 级，用于建立语义映射与图表序列 |
| `--yellow-40` | `#FCD72E` | `#FCD72E` | 公司数字色板；--yellow 色相 40 级，用于建立语义映射与图表序列 |
| `--yellow-50` | `#FCC800` | `#FCC800` | 公司数字色板；--yellow 色相 50 级，用于建立语义映射与图表序列 |
| `--yellow-60` | `#D19F00` | `#D19F00` | 公司数字色板；--yellow 色相 60 级，用于建立语义映射与图表序列 |
| `--yellow-70` | `#9E7400` | `#9E7400` | 公司数字色板；--yellow 色相 70 级，用于建立语义映射与图表序列 |
| `--yellow-80` | `#614500` | `#614500` | 公司数字色板；--yellow 色相 80 级，用于建立语义映射与图表序列 |
| `--yellow-90` | `#2E1F00` | `#2E1F00` | 公司数字色板；--yellow 色相 90 级，用于建立语义映射与图表序列 |
| `--green-05` | `#F2FBE9` | `#F2FBE9` | 公司数字色板；--green 色相 05 级，用于建立语义映射与图表序列 |
| `--green-10` | `#DFF4CC` | `#DFF4CC` | 公司数字色板；--green 色相 10 级，用于建立语义映射与图表序列 |
| `--green-20` | `#C6E9A8` | `#C6E9A8` | 公司数字色板；--green 色相 20 级，用于建立语义映射与图表序列 |
| `--green-30` | `#A8DB81` | `#A8DB81` | 公司数字色板；--green 色相 30 级，用于建立语义映射与图表序列 |
| `--green-40` | `#87C859` | `#87C859` | 公司数字色板；--green 色相 40 级，用于建立语义映射与图表序列 |
| `--green-50` | `#62B42E` | `#62B42E` | 公司数字色板；--green 色相 50 级，用于建立语义映射与图表序列 |
| `--green-60` | `#488E20` | `#488E20` | 公司数字色板；--green 色相 60 级，用于建立语义映射与图表序列 |
| `--green-70` | `#316614` | `#316614` | 公司数字色板；--green 色相 70 级，用于建立语义映射与图表序列 |
| `--green-80` | `#1B3E0A` | `#1B3E0A` | 公司数字色板；--green 色相 80 级，用于建立语义映射与图表序列 |
| `--green-90` | `#0C2004` | `#0C2004` | 公司数字色板；--green 色相 90 级，用于建立语义映射与图表序列 |
| `--mint-05` | `#E7FBF2` | `#E7FBF2` | 公司数字色板；--mint 色相 05 级，用于建立语义映射与图表序列 |
| `--mint-10` | `#BCF2DB` | `#BCF2DB` | 公司数字色板；--mint 色相 10 级，用于建立语义映射与图表序列 |
| `--mint-20` | `#8FE5C2` | `#8FE5C2` | 公司数字色板；--mint 色相 20 级，用于建立语义映射与图表序列 |
| `--mint-30` | `#63D5A8` | `#63D5A8` | 公司数字色板；--mint 色相 30 级，用于建立语义映射与图表序列 |
| `--mint-40` | `#36C18D` | `#36C18D` | 公司数字色板；--mint 色相 40 级，用于建立语义映射与图表序列 |
| `--mint-50` | `#09AA71` | `#09AA71` | 公司数字色板；--mint 色相 50 级，用于建立语义映射与图表序列 |
| `--mint-60` | `#058358` | `#058358` | 公司数字色板；--mint 色相 60 级，用于建立语义映射与图表序列 |
| `--mint-70` | `#036142` | `#036142` | 公司数字色板；--mint 色相 70 级，用于建立语义映射与图表序列 |
| `--mint-80` | `#02422E` | `#02422E` | 公司数字色板；--mint 色相 80 级，用于建立语义映射与图表序列 |
| `--mint-90` | `#00291D` | `#00291D` | 公司数字色板；--mint 色相 90 级，用于建立语义映射与图表序列 |
| `--cyan-05` | `#E8FCFD` | `#E8FCFD` | 公司数字色板；--cyan 色相 05 级，用于建立语义映射与图表序列 |
| `--cyan-10` | `#C9F6F9` | `#C9F6F9` | 公司数字色板；--cyan 色相 10 级，用于建立语义映射与图表序列 |
| `--cyan-20` | `#A4ECF1` | `#A4ECF1` | 公司数字色板；--cyan 色相 20 级，用于建立语义映射与图表序列 |
| `--cyan-30` | `#7DDFE7` | `#7DDFE7` | 公司数字色板；--cyan 色相 30 级，用于建立语义映射与图表序列 |
| `--cyan-40` | `#55CCD9` | `#55CCD9` | 公司数字色板；--cyan 色相 40 级，用于建立语义映射与图表序列 |
| `--cyan-50` | `#2CB8C9` | `#2CB8C9` | 公司数字色板；--cyan 色相 50 级，用于建立语义映射与图表序列 |
| `--cyan-60` | `#1C94A4` | `#1C94A4` | 公司数字色板；--cyan 色相 60 级，用于建立语义映射与图表序列 |
| `--cyan-70` | `#127180` | `#127180` | 公司数字色板；--cyan 色相 70 级，用于建立语义映射与图表序列 |
| `--cyan-80` | `#094C57` | `#094C57` | 公司数字色板；--cyan 色相 80 级，用于建立语义映射与图表序列 |
| `--cyan-90` | `#04282F` | `#04282F` | 公司数字色板；--cyan 色相 90 级，用于建立语义映射与图表序列 |
| `--blue-05` | `#EEF3FE` | `#EEF3FE` | 公司数字色板；--blue 色相 05 级，用于建立语义映射与图表序列 |
| `--blue-10` | `#D0D8FD` | `#D0D8FD` | 公司数字色板；--blue 色相 10 级，用于建立语义映射与图表序列 |
| `--blue-20` | `#B0BFFD` | `#B0BFFD` | 公司数字色板；--blue 色相 20 级，用于建立语义映射与图表序列 |
| `--blue-30` | `#8CA3FA` | `#8CA3FA` | 公司数字色板；--blue 色相 30 级，用于建立语义映射与图表序列 |
| `--blue-40` | `#668CF7` | `#668CF7` | 公司数字色板；--blue 色相 40 级，用于建立语义映射与图表序列 |
| `--blue-50` | `#2070F3` | `#2070F3` | 公司数字色板；--blue 色相 50 级，用于建立语义映射与图表序列 |
| `--blue-60` | `#1F55B5` | `#1F55B5` | 公司数字色板；--blue 色相 60 级，用于建立语义映射与图表序列 |
| `--blue-70` | `#1B3F86` | `#1B3F86` | 公司数字色板；--blue 色相 70 级，用于建立语义映射与图表序列 |
| `--blue-80` | `#112857` | `#112857` | 公司数字色板；--blue 色相 80 级，用于建立语义映射与图表序列 |
| `--blue-90` | `#081635` | `#081635` | 公司数字色板；--blue 色相 90 级，用于建立语义映射与图表序列 |
| `--indigo-05` | `#EEEEFE` | `#EEEEFE` | 公司数字色板；--indigo 色相 05 级，用于建立语义映射与图表序列 |
| `--indigo-10` | `#D5D3FD` | `#D5D3FD` | 公司数字色板；--indigo 色相 10 级，用于建立语义映射与图表序列 |
| `--indigo-20` | `#BFB9FA` | `#BFB9FA` | 公司数字色板；--indigo 色相 20 级，用于建立语义映射与图表序列 |
| `--indigo-30` | `#A89FF9` | `#A89FF9` | 公司数字色板；--indigo 色相 30 级，用于建立语义映射与图表序列 |
| `--indigo-40` | `#8E81F4` | `#8E81F4` | 公司数字色板；--indigo 色相 40 级，用于建立语义映射与图表序列 |
| `--indigo-50` | `#715AFB` | `#715AFB` | 公司数字色板；--indigo 色相 50 级，用于建立语义映射与图表序列 |
| `--indigo-60` | `#5531EB` | `#5531EB` | 公司数字色板；--indigo 色相 60 级，用于建立语义映射与图表序列 |
| `--indigo-70` | `#3F21B5` | `#3F21B5` | 公司数字色板；--indigo 色相 70 级，用于建立语义映射与图表序列 |
| `--indigo-80` | `#281675` | `#281675` | 公司数字色板；--indigo 色相 80 级，用于建立语义映射与图表序列 |
| `--indigo-90` | `#160B48` | `#160B48` | 公司数字色板；--indigo 色相 90 级，用于建立语义映射与图表序列 |
| `--purple-05` | `#F7EDFE` | `#F7EDFE` | 公司数字色板；--purple 色相 05 级，用于建立语义映射与图表序列 |
| `--purple-10` | `#E8CFFE` | `#E8CFFE` | 公司数字色板；--purple 色相 10 级，用于建立语义映射与图表序列 |
| `--purple-20` | `#D9B1FD` | `#D9B1FD` | 公司数字色板；--purple 色相 20 级，用于建立语义映射与图表序列 |
| `--purple-30` | `#CB8EFB` | `#CB8EFB` | 公司数字色板；--purple 色相 30 级，用于建立语义映射与图表序列 |
| `--purple-40` | `#BF68FA` | `#BF68FA` | 公司数字色板；--purple 色相 40 级，用于建立语义映射与图表序列 |
| `--purple-50` | `#B62BF7` | `#B62BF7` | 公司数字色板；--purple 色相 50 级，用于建立语义映射与图表序列 |
| `--purple-60` | `#8A21BC` | `#8A21BC` | 公司数字色板；--purple 色相 60 级，用于建立语义映射与图表序列 |
| `--purple-70` | `#651B8B` | `#651B8B` | 公司数字色板；--purple 色相 70 级，用于建立语义映射与图表序列 |
| `--purple-80` | `#41125A` | `#41125A` | 公司数字色板；--purple 色相 80 级，用于建立语义映射与图表序列 |
| `--purple-90` | `#260937` | `#260937` | 公司数字色板；--purple 色相 90 级，用于建立语义映射与图表序列 |
| `--pink-05` | `#FDE6FC` | `#FDE6FC` | 公司数字色板；--pink 色相 05 级，用于建立语义映射与图表序列 |
| `--pink-10` | `#F9C5F6` | `#F9C5F6` | 公司数字色板；--pink 色相 10 级，用于建立语义映射与图表序列 |
| `--pink-20` | `#F39DEC` | `#F39DEC` | 公司数字色板；--pink 色相 20 级，用于建立语义映射与图表序列 |
| `--pink-30` | `#EB74DF` | `#EB74DF` | 公司数字色板；--pink 色相 30 级，用于建立语义映射与图表序列 |
| `--pink-40` | `#E049CE` | `#E049CE` | 公司数字色板；--pink 色相 40 级，用于建立语义映射与图表序列 |
| `--pink-50` | `#D41DBC` | `#D41DBC` | 公司数字色板；--pink 色相 50 级，用于建立语义映射与图表序列 |
| `--pink-60` | `#9F1C8D` | `#9F1C8D` | 公司数字色板；--pink 色相 60 级，用于建立语义映射与图表序列 |
| `--pink-70` | `#751868` | `#751868` | 公司数字色板；--pink 色相 70 级，用于建立语义映射与图表序列 |
| `--pink-80` | `#4C0F43` | `#4C0F43` | 公司数字色板；--pink 色相 80 级，用于建立语义映射与图表序列 |
| `--pink-90` | `#2E0728` | `#2E0728` | 公司数字色板；--pink 色相 90 级，用于建立语义映射与图表序列 |
| `--brand-05` | `#E6F2FD` | `#E6F2FD` | 公司数字色板；--brand 色相 05 级，用于建立语义映射与图表序列 |
| `--brand-10` | `#B8D9F9` | `#B8D9F9` | 公司数字色板；--brand 色相 10 级，用于建立语义映射与图表序列 |
| `--brand-20` | `#8ABEF3` | `#8ABEF3` | 公司数字色板；--brand 色相 20 级，用于建立语义映射与图表序列 |
| `--brand-30` | `#5CA2E9` | `#5CA2E9` | 公司数字色板；--brand 色相 30 级，用于建立语义映射与图表序列 |
| `--brand-40` | `#2E86DE` | `#2E86DE` | 公司数字色板；--brand 色相 40 级，用于建立语义映射与图表序列 |
| `--brand-50` | `#0067D1` | `#0067D1` | 公司数字色板；--brand 色相 50 级，用于建立语义映射与图表序列 |
| `--brand-60` | `#004EA8` | `#004EA8` | 公司数字色板；--brand 色相 60 级，用于建立语义映射与图表序列 |
| `--brand-70` | `#003D83` | `#003D83` | 公司数字色板；--brand 色相 70 级，用于建立语义映射与图表序列 |
| `--brand-80` | `#002E6A` | `#002E6A` | 公司数字色板；--brand 色相 80 级，用于建立语义映射与图表序列 |
| `--brand-90` | `#00214B` | `#00214B` | 公司数字色板；--brand 色相 90 级，用于建立语义映射与图表序列 |
| `--gray-0White` | `#FFFFFF` | `#FFFFFF` | 公司数字色板；灰阶端点，用于建立语义映射与图表序列 |
| `--gray-05` | `#F3F3F3` | `#F3F3F3` | 公司数字色板；--gray 色相 05 级，用于建立语义映射与图表序列 |
| `--gray-10` | `#DFDFDF` | `#DFDFDF` | 公司数字色板；--gray 色相 10 级，用于建立语义映射与图表序列 |
| `--gray-20` | `#C9C9C9` | `#C9C9C9` | 公司数字色板；--gray 色相 20 级，用于建立语义映射与图表序列 |
| `--gray-30` | `#AEAEAE` | `#AEAEAE` | 公司数字色板；--gray 色相 30 级，用于建立语义映射与图表序列 |
| `--gray-40` | `#939393` | `#939393` | 公司数字色板；--gray 色相 40 级，用于建立语义映射与图表序列 |
| `--gray-50` | `#777777` | `#777777` | 公司数字色板；--gray 色相 50 级，用于建立语义映射与图表序列 |
| `--gray-60` | `#595959` | `#595959` | 公司数字色板；--gray 色相 60 级，用于建立语义映射与图表序列 |
| `--gray-70` | `#393939` | `#393939` | 公司数字色板；--gray 色相 70 级，用于建立语义映射与图表序列 |
| `--gray-80` | `#2A2A2A` | `#2A2A2A` | 公司数字色板；--gray 色相 80 级，用于建立语义映射与图表序列 |
| `--gray-90` | `#191919` | `#191919` | 公司数字色板；--gray 色相 90 级，用于建立语义映射与图表序列 |
| `--gray-100Black` | `#000000` | `#000000` | 公司数字色板；灰阶端点，用于建立语义映射与图表序列 |
| `--gray-0` | `var(--gray-0White)` | `#FFFFFF` | 灰阶端点兼容别名，保留原名称对应色值 |
| `--gray-100` | `var(--gray-100Black)` | `#000000` | 灰阶端点兼容别名，保留原名称对应色值 |
| `--color-corporate-black` | `#000000` | `#000000` | 灰色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-dark-gray` | `#393939` | `#393939` | 灰色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-gray` | `#777777` | `#777777` | 灰色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-light-gray` | `#C9C9C9` | `#C9C9C9` | 灰色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-white` | `#FFFFFF` | `#FFFFFF` | 灰色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-rose` | `#E61866` | `#E61866` | 彩色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-orange` | `#F36900` | `#F36900` | 彩色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-yellow` | `#FDC000` | `#FDC000` | 彩色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-green` | `#4FA700` | `#4FA700` | 彩色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-cyan` | `#54BCCE` | `#54BCCE` | 彩色系公司辅助色；独立于数字色板同名色阶 |
| `--color-corporate-pink` | `#D41DBC` | `#D41DBC` | 色相延展，仅第三优先级使用；独立于数字色板同名色阶 |
| `--color-corporate-purple` | `#B62BF7` | `#B62BF7` | 色相延展，仅第三优先级使用；独立于数字色板同名色阶 |
| `--color-corporate-indigo` | `#5531EB` | `#5531EB` | 色相延展，仅第三优先级使用；独立于数字色板同名色阶 |
| `--color-corporate-blue` | `#2070F3` | `#2070F3` | 色相延展，仅第三优先级使用；独立于数字色板同名色阶 |
| `--color-corporate-mint` | `#00A874` | `#00A874` | 色相延展，仅第三优先级使用；独立于数字色板同名色阶 |
| `--g-white` | `var(--gray-0)` | `#FFFFFF` | V1.3 tokens/primitive.css |
| `--g-black` | `var(--gray-100)` | `#000000` | V1.3 tokens/primitive.css |

## semantic-light

:root,
[data-theme="light"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-brand` | `var(--brand-50)` | `#0067D1` | 软件产品组件高亮色，默认态 |
| `--color-brand-hover` | `var(--brand-40)` | `#2E86DE` | 强调色悬浮态 |
| `--color-brand-focus` | `var(--brand-50)` | `#0067D1` | 强调色选中态及焦点态 |
| `--color-brand-active` | `var(--brand-60)` | `#004EA8` | 强调色按下态 |
| `--color-brand-disabled` | `var(--brand-20)` | `#8ABEF3` | 强调色禁用态 |
| `--color-text-primary` | `var(--gray-90)` | `#191919` | 主要文本 |
| `--color-text-secondary` | `var(--gray-50)` | `#777777` | 次要文本 |
| `--color-text-placeholder` | `var(--gray-30)` | `#AEAEAE` | 占位文本 |
| `--color-text-disabled` | `var(--gray-20)` | `#C9C9C9` | 禁用文本 |
| `--color-text-inverse` | `var(--gray-0)` | `#FFFFFF` | 反白文本 |
| `--color-icon-primary` | `var(--gray-90)` | `#191919` | 主要图标；整体层级与文本匹配 |
| `--color-icon-secondary` | `var(--gray-50)` | `#777777` | 次要图标 |
| `--color-icon-tertiary` | `var(--gray-40)` | `#939393` | 三级图标 |
| `--color-icon-placeholder` | `var(--gray-30)` | `#AEAEAE` | 占位图标 |
| `--color-icon-disabled` | `var(--gray-20)` | `#C9C9C9` | 禁用图标 |
| `--color-icon-inverse` | `var(--gray-0)` | `#FFFFFF` | 反白图标 |
| `--color-icon-hover` | `var(--brand-40)` | `#2E86DE` | 图标悬浮态 |
| `--color-icon-focus` | `var(--brand-50)` | `#0067D1` | 图标选中态 |
| `--color-icon-active` | `var(--brand-60)` | `#004EA8` | 图标按下态 |
| `--color-border` | `var(--gray-20)` | `#C9C9C9` | 默认边框 |
| `--color-border-hover` | `var(--gray-90)` | `#191919` | 悬浮边框 |
| `--color-border-focus` | `var(--brand-50)` | `#0067D1` | 选中或焦点边框 |
| `--color-border-disabled` | `var(--gray-20)` | `#C9C9C9` | 禁用边框 |
| `--color-border-separator` | `var(--gray-10)` | `#DFDFDF` | 分割线 |
| `--color-border-separator-subtle` | `var(--gray-05)` | `#F3F3F3` | 浅版分割线 |
| `--color-bg-1` | `var(--gray-05)` | `#F3F3F3` | 页面背景 |
| `--color-bg-2` | `var(--gray-0)` | `#FFFFFF` | 侧边导航或侧滑面板 |
| `--color-bg-3` | `var(--gray-0)` | `#FFFFFF` | 侧滑面板 |
| `--color-bg-4` | `var(--gray-0)` | `#FFFFFF` | 下拉面板及弹窗 |
| `--color-bg-5` | `var(--gray-0)` | `#FFFFFF` | 白色卡片 |
| `--color-bg-6` | `rgba(201, 201, 201, 0.20)` | `rgba(201, 201, 201, 0.20)` | 带背景色卡片；按图中的 gray-20 20% 解释，旁注 #FFFFFF 冲突另存 |
| `--color-bg-mask` | `rgba(25, 25, 25, 0.30)` | `rgba(25, 25, 25, 0.30)` | 遮罩：gray-90 30% |
| `--color-hover` | `rgba(25, 25, 25, 0.05)` | `rgba(25, 25, 25, 0.05)` | 通用悬浮态；gray-90 5% |
| `--color-table-header` | `rgba(25, 25, 25, 0.05)` | `rgba(25, 25, 25, 0.05)` | 表头背景；gray-90 5% |
| `--color-fill` | `rgba(25, 25, 25, 0.05)` | `rgba(25, 25, 25, 0.05)` | 步骤条未开始、单选块未选、图片与文件上传默认填充；gray-90 5% |
| `--color-fill-disabled-subtle` | `rgba(25, 25, 25, 0.05)` | `rgba(25, 25, 25, 0.05)` | 含描边的标准按钮、输入框、搜索框、选择器禁用填充；gray-90 5% |
| `--color-table-zebra` | `rgba(147, 147, 147, 0.05)` | `rgba(147, 147, 147, 0.05)` | 表格斑马纹背景；gray-40 5% |
| `--color-select` | `var(--brand-05)` | `#E6F2FD` | 通用选中填充 |
| `--color-fill-subtle` | `var(--gray-0)` | `#FFFFFF` | 输入框等浅色模式有背景、深色模式无背景的填充 |
| `--color-fill-disabled` | `var(--gray-10)` | `#DFDFDF` | 不含描边的单选块、页签、滚动条及默认标签禁用填充 |
| `--color-error` | `var(--red-50)` | `#E02128` | 高关注度：错误 |
| `--color-alert` | `var(--orange-50)` | `#F4840C` | 高关注度：告警，搭配文字 |
| `--color-warning` | `var(--yellow-50)` | `#FCC800` | 高关注度：提醒，搭配文字 |
| `--color-success` | `var(--mint-50)` | `#09AA71` | 中关注度：成功 |
| `--color-info` | `var(--blue-50)` | `#2070F3` | 中关注度：信息 |
| `--color-none` | `var(--gray-30)` | `#AEAEAE` | 中关注度：失效 |
| `--color-error-subtle` | `var(--red-05)` | `#FEE7E8` | 低关注度：错误弱背景 |
| `--color-alert-subtle` | `var(--orange-05)` | `#FEF5E8` | 低关注度：告警弱背景 |
| `--color-warning-subtle` | `var(--yellow-05)` | `#FEFCE0` | 低关注度：提醒弱背景 |
| `--color-success-subtle` | `var(--mint-05)` | `#E7FBF2` | 低关注度：成功弱背景 |
| `--color-info-subtle` | `var(--brand-05)` | `#E6F2FD` | 低关注度：信息弱背景；规范指定 brand-05 |
| `--color-none-subtle` | `var(--gray-05)` | `#F3F3F3` | 低关注度：失效弱背景 |
| `--color-portal-highlight` | `var(--gray-90)` | `#191919` | 门户官网组件高亮色；不替代软件产品的蓝色高亮 |
| `--g-shadow` | `0 4px 12px rgba(0,0,0,.10)` | `0 4px 12px rgba(0,0,0,.10)` | 组件层级兼容投影；随主题调整透明度 |

## semantic-dark

[data-theme="dark"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-brand` | `var(--brand-40)` | `#2E86DE` | 软件产品组件高亮色，默认态；深色 UI 为项目兼容映射 |
| `--color-brand-hover` | `var(--brand-30)` | `#5CA2E9` | 强调色悬浮态；深色 UI 为项目兼容映射 |
| `--color-brand-focus` | `var(--brand-40)` | `#2E86DE` | 强调色选中态及焦点态；深色 UI 为项目兼容映射 |
| `--color-brand-active` | `var(--brand-50)` | `#0067D1` | 强调色按下态；深色 UI 为项目兼容映射 |
| `--color-brand-disabled` | `var(--brand-80)` | `#002E6A` | 强调色禁用态；深色 UI 为项目兼容映射 |
| `--color-text-primary` | `var(--gray-05)` | `#F3F3F3` | 主要文本；深色 UI 为项目兼容映射 |
| `--color-text-secondary` | `var(--gray-30)` | `#AEAEAE` | 次要文本；深色 UI 为项目兼容映射 |
| `--color-text-placeholder` | `var(--gray-40)` | `#939393` | 占位文本；深色 UI 为项目兼容映射 |
| `--color-text-disabled` | `var(--gray-60)` | `#595959` | 禁用文本；深色 UI 为项目兼容映射 |
| `--color-text-inverse` | `var(--gray-0)` | `#FFFFFF` | 反白文本；深色 UI 为项目兼容映射 |
| `--color-icon-primary` | `var(--gray-05)` | `#F3F3F3` | 主要图标；整体层级与文本匹配；深色 UI 为项目兼容映射 |
| `--color-icon-secondary` | `var(--gray-30)` | `#AEAEAE` | 次要图标；深色 UI 为项目兼容映射 |
| `--color-icon-tertiary` | `var(--gray-40)` | `#939393` | 三级图标；深色 UI 为项目兼容映射 |
| `--color-icon-placeholder` | `var(--gray-40)` | `#939393` | 占位图标；深色 UI 为项目兼容映射 |
| `--color-icon-disabled` | `var(--gray-60)` | `#595959` | 禁用图标；深色 UI 为项目兼容映射 |
| `--color-icon-inverse` | `var(--gray-0)` | `#FFFFFF` | 反白图标；深色 UI 为项目兼容映射 |
| `--color-icon-hover` | `var(--brand-30)` | `#5CA2E9` | 图标悬浮态；深色 UI 为项目兼容映射 |
| `--color-icon-focus` | `var(--brand-40)` | `#2E86DE` | 图标选中态；深色 UI 为项目兼容映射 |
| `--color-icon-active` | `var(--brand-50)` | `#0067D1` | 图标按下态；深色 UI 为项目兼容映射 |
| `--color-border` | `var(--gray-60)` | `#595959` | 默认边框；深色 UI 为项目兼容映射 |
| `--color-border-hover` | `var(--gray-30)` | `#AEAEAE` | 悬浮边框；深色 UI 为项目兼容映射 |
| `--color-border-focus` | `var(--brand-40)` | `#2E86DE` | 选中或焦点边框；深色 UI 为项目兼容映射 |
| `--color-border-disabled` | `var(--gray-70)` | `#393939` | 禁用边框；深色 UI 为项目兼容映射 |
| `--color-border-separator` | `var(--gray-70)` | `#393939` | 分割线；深色 UI 为项目兼容映射 |
| `--color-border-separator-subtle` | `var(--gray-80)` | `#2A2A2A` | 浅版分割线；深色 UI 为项目兼容映射 |
| `--color-bg-1` | `var(--gray-100)` | `#000000` | 页面背景；深色 UI 为项目兼容映射 |
| `--color-bg-2` | `var(--gray-90)` | `#191919` | 侧边导航或侧滑面板；深色 UI 为项目兼容映射 |
| `--color-bg-3` | `var(--gray-90)` | `#191919` | 侧滑面板；深色 UI 为项目兼容映射 |
| `--color-bg-4` | `var(--gray-90)` | `#191919` | 下拉面板及弹窗；深色 UI 为项目兼容映射 |
| `--color-bg-5` | `var(--gray-90)` | `#191919` | 白色卡片；深色 UI 为项目兼容映射 |
| `--color-bg-6` | `rgba(201, 201, 201, 0.20)` | `rgba(201, 201, 201, 0.20)` | 带背景色卡片；按图中的 gray-20 20% 解释，旁注 #FFFFFF 冲突另存；深色 UI 为项目兼容映射 |
| `--color-bg-mask` | `rgba(0, 0, 0, 0.70)` | `rgba(0, 0, 0, 0.70)` | 遮罩：gray-90 30%；深色 UI 为项目兼容映射 |
| `--color-hover` | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.05)` | 通用悬浮态；gray-90 5%；深色 UI 为项目兼容映射 |
| `--color-table-header` | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.05)` | 表头背景；gray-90 5%；深色 UI 为项目兼容映射 |
| `--color-fill` | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.05)` | 步骤条未开始、单选块未选、图片与文件上传默认填充；gray-90 5%；深色 UI 为项目兼容映射 |
| `--color-fill-disabled-subtle` | `rgba(255, 255, 255, 0.05)` | `rgba(255, 255, 255, 0.05)` | 含描边的标准按钮、输入框、搜索框、选择器禁用填充；gray-90 5%；深色 UI 为项目兼容映射 |
| `--color-table-zebra` | `rgba(147, 147, 147, 0.05)` | `rgba(147, 147, 147, 0.05)` | 表格斑马纹背景；gray-40 5%；深色 UI 为项目兼容映射 |
| `--color-select` | `var(--brand-90)` | `#00214B` | 通用选中填充；深色 UI 为项目兼容映射 |
| `--color-fill-subtle` | `transparent` | `transparent` | 输入框等浅色模式有背景、深色模式无背景的填充；深色 UI 为项目兼容映射 |
| `--color-fill-disabled` | `var(--gray-70)` | `#393939` | 不含描边的单选块、页签、滚动条及默认标签禁用填充；深色 UI 为项目兼容映射 |
| `--color-error` | `var(--red-50)` | `#E02128` | 高关注度：错误；深色 UI 为项目兼容映射 |
| `--color-alert` | `var(--orange-50)` | `#F4840C` | 高关注度：告警，搭配文字；深色 UI 为项目兼容映射 |
| `--color-warning` | `var(--yellow-50)` | `#FCC800` | 高关注度：提醒，搭配文字；深色 UI 为项目兼容映射 |
| `--color-success` | `var(--mint-50)` | `#09AA71` | 中关注度：成功；深色 UI 为项目兼容映射 |
| `--color-info` | `var(--blue-50)` | `#2070F3` | 中关注度：信息；深色 UI 为项目兼容映射 |
| `--color-none` | `var(--gray-30)` | `#AEAEAE` | 中关注度：失效；深色 UI 为项目兼容映射 |
| `--color-error-subtle` | `var(--red-90)` | `#350305` | 低关注度：错误弱背景；深色 UI 为项目兼容映射 |
| `--color-alert-subtle` | `var(--orange-90)` | `#3D1601` | 低关注度：告警弱背景；深色 UI 为项目兼容映射 |
| `--color-warning-subtle` | `var(--yellow-90)` | `#2E1F00` | 低关注度：提醒弱背景；深色 UI 为项目兼容映射 |
| `--color-success-subtle` | `var(--mint-90)` | `#00291D` | 低关注度：成功弱背景；深色 UI 为项目兼容映射 |
| `--color-info-subtle` | `var(--brand-90)` | `#00214B` | 低关注度：信息弱背景；规范指定 brand-05；深色 UI 为项目兼容映射 |
| `--color-none-subtle` | `var(--gray-80)` | `#2A2A2A` | 低关注度：失效弱背景；深色 UI 为项目兼容映射 |
| `--color-portal-highlight` | `var(--gray-90)` | `#191919` | 门户官网组件高亮色；不替代软件产品的蓝色高亮 |
| `--g-shadow` | `0 4px 12px rgba(0,0,0,.35)` | `0 4px 12px rgba(0,0,0,.35)` | 组件层级兼容投影；随主题调整透明度 |

## charts-default

:root,
[data-chart-palette="default"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-chart-1` | `var(--blue-50)` | `#2070F3` | 图表 default 方案，按序号取色 |
| `--color-chart-2` | `var(--green-50)` | `#62B42E` | 图表 default 方案，按序号取色 |
| `--color-chart-3` | `var(--indigo-50)` | `#715AFB` | 图表 default 方案，按序号取色 |
| `--color-chart-4` | `var(--cyan-50)` | `#2CB8C9` | 图表 default 方案，按序号取色 |
| `--color-chart-5` | `var(--orange-40)` | `#F69E39` | 图表 default 方案，按序号取色 |
| `--color-chart-6` | `var(--brand-30)` | `#5CA2E9` | 图表 default 方案，按序号取色 |
| `--color-chart-tail` | `var(--blue-70)` | `#1B3F86` | 超过六类的环形图或堆叠柱状图可用尾部色替换最后一色 |
| `--color-chart-accessible-1` | `var(--blue-60)` | `#1F55B5` | 图表 default 方案，按序号取色 |
| `--color-chart-accessible-2` | `var(--green-60)` | `#488E20` | 图表 default 方案，按序号取色 |
| `--color-chart-accessible-3` | `var(--indigo-60)` | `#5531EB` | 图表 default 方案，按序号取色 |
| `--color-chart-accessible-4` | `var(--cyan-60)` | `#1C94A4` | 图表 default 方案，按序号取色 |
| `--color-chart-accessible-5` | `var(--orange-60)` | `#C76207` | 图表 default 方案，按序号取色 |
| `--color-chart-accessible-6` | `var(--brand-40)` | `#2E86DE` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-1-1` | `var(--mint-50)` | `#09AA71` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-1-2` | `var(--indigo-40)` | `#8E81F4` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-1-3` | `var(--cyan-50)` | `#2CB8C9` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-1-4` | `var(--purple-40)` | `#BF68FA` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-2-1` | `var(--indigo-50)` | `#715AFB` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-2-2` | `var(--yellow-40)` | `#FCD72E` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-2-3` | `var(--blue-50)` | `#2070F3` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-2-4` | `var(--green-40)` | `#87C859` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-3-1` | `var(--purple-50)` | `#B62BF7` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-3-2` | `var(--green-40)` | `#87C859` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-3-3` | `var(--cyan-50)` | `#2CB8C9` | 图表 default 方案，按序号取色 |
| `--color-chart-extension-3-4` | `var(--orange-40)` | `#F69E39` | 图表 default 方案，按序号取色 |

## charts-accessible

[data-chart-palette="accessible"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-chart-1` | `var(--blue-60)` | `#1F55B5` | 图表 accessible 方案，按序号取色 |
| `--color-chart-2` | `var(--green-60)` | `#488E20` | 图表 accessible 方案，按序号取色 |
| `--color-chart-3` | `var(--indigo-60)` | `#5531EB` | 图表 accessible 方案，按序号取色 |
| `--color-chart-4` | `var(--cyan-60)` | `#1C94A4` | 图表 accessible 方案，按序号取色 |
| `--color-chart-5` | `var(--orange-60)` | `#C76207` | 图表 accessible 方案，按序号取色 |
| `--color-chart-6` | `var(--brand-40)` | `#2E86DE` | 图表 accessible 方案，按序号取色 |

## charts-extension-1

[data-chart-palette="extension-1"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-chart-1` | `var(--mint-50)` | `#09AA71` | 图表 extension-1 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-2` | `var(--indigo-40)` | `#8E81F4` | 图表 extension-1 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-3` | `var(--cyan-50)` | `#2CB8C9` | 图表 extension-1 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-4` | `var(--purple-40)` | `#BF68FA` | 图表 extension-1 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-5` | `initial` | `initial` | 图表 extension-1 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-6` | `initial` | `initial` | 图表 extension-1 方案，按序号取色；仅四色，5/6 号禁用 |

## charts-extension-2

[data-chart-palette="extension-2"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-chart-1` | `var(--indigo-50)` | `#715AFB` | 图表 extension-2 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-2` | `var(--yellow-40)` | `#FCD72E` | 图表 extension-2 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-3` | `var(--blue-50)` | `#2070F3` | 图表 extension-2 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-4` | `var(--green-40)` | `#87C859` | 图表 extension-2 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-5` | `initial` | `initial` | 图表 extension-2 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-6` | `initial` | `initial` | 图表 extension-2 方案，按序号取色；仅四色，5/6 号禁用 |

## charts-extension-3

[data-chart-palette="extension-3"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-chart-1` | `var(--purple-50)` | `#B62BF7` | 图表 extension-3 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-2` | `var(--green-40)` | `#87C859` | 图表 extension-3 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-3` | `var(--cyan-50)` | `#2CB8C9` | 图表 extension-3 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-4` | `var(--orange-40)` | `#F69E39` | 图表 extension-3 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-5` | `initial` | `initial` | 图表 extension-3 方案，按序号取色；仅四色，5/6 号禁用 |
| `--color-chart-6` | `initial` | `initial` | 图表 extension-3 方案，按序号取色；仅四色，5/6 号禁用 |

## code-light

:root,
[data-theme="light"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-code-background` | `#FAFAFA` | `#FAFAFA` | 基础与容器 / 代码块基础：定义代码块背景；与非代码背景建立层级 |
| `--color-code-foreground` | `#393939` | `#393939` | 基础与容器 / 默认文本：定义代码块基础文本，不与容器背景混淆 |
| `--color-code-comment` | `#939393` | `#939393` | 注释内容 / 普通注释：注释保持可读，并弱化于主要语法 |
| `--color-code-quote` | `#939393` | `#939393` | 注释内容 / 引用/指导：注释保持可读，并弱化于主要语法 |
| `--color-code-bullet` | `#939393` | `#939393` | 注释内容 / 项目符号：注释保持可读，并弱化于主要语法 |
| `--color-code-javadoc` | `#939393` | `#939393` | 注释内容 / 文档注释界定符：注释保持可读，并弱化于主要语法 |
| `--color-code-doctag` | `#939393` | `#939393` | 注释内容 / 文档标签：注释保持可读，并弱化于主要语法 |
| `--color-code-link` | `#2E86DE` | `#2E86DE` | 注释内容 / 链接：文档注释中的链接，需要与普通注释区分 |
| `--color-code-keyword` | `#C98208` | `#C98208` | 程序结构 / 关键字：以高亮区分结构与控制逻辑，帮助识别 import、if、for 等代码组织关系 |
| `--color-code-punctuation` | `#393939` | `#393939` | 程序结构 / 标点符号：基础符号使用默认文本色，减少高亮干扰 |
| `--color-code-operator` | `#393939` | `#393939` | 程序结构 / 操作符：基础符号使用默认文本色，减少高亮干扰 |
| `--color-code-section` | `#939393` | `#939393` | 程序结构 / 章节/区块：特殊标记使用弱化的灰色 |
| `--color-code-meta` | `#C76207` | `#C76207` | 修饰器与元指令 / 修饰器：区分装饰器与元指令，使影响声明行为的标记易于识别 |
| `--color-code-type` | `#5531EB` | `#5531EB` | 类型系统 / 类型注解：突出类型注解，区别于普通变量及文本 |
| `--color-code-title` | `#058358` | `#058358` | 类型系统 / 类/结构体名：区分类或组件名称，便于识别类型和结构定义 |
| `--color-code-class` | `#0067D1` | `#0067D1` | 类型系统 / 类/结构体名：突出类或结构体声明的名称 |
| `--color-code-name` | `#0067D1` | `#0067D1` | 函数与调用 / 函数名：突出函数调用，便于识别执行入口与调用关系 |
| `--color-code-function` | `#0067D1` | `#0067D1` | 函数与调用 / 函数定义：突出函数定义，便于区分声明与普通文本 |
| `--color-code-params` | `#393939` | `#393939` | 函数与调用 / 函数参数：函数名称突出；参数使用默认文本；内置项另行区分 |
| `--color-code-built-in` | `#127180` | `#127180` | 函数与调用 / 内置函数：函数名称突出；参数使用默认文本；内置项另行区分 |
| `--color-code-attr` | `#5531EB` | `#5531EB` | 属性和变量 / 属性名：突出属性键或对象键，与属性值及普通变量区分 |
| `--color-code-value` | `#D41DBC` | `#D41DBC` | 属性和变量 / 属性值：单独区分属性值，避免与属性键混淆 |
| `--color-code-property` | `#0067D1` | `#0067D1` | 属性和变量 / 对象属性访问：突出对象属性访问，帮助理解成员关系 |
| `--color-code-variable` | `#393939` | `#393939` | 属性和变量 / 变量：属性名称、属性值和对象访问分层；普通变量保持默认文本 |
| `--color-code-string` | `#393939` | `#393939` | 数据与字面量 / 字符串：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-literal` | `#393939` | `#393939` | 数据与字面量 / 字面量：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-number` | `#393939` | `#393939` | 数据与字面量 / 数值：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-regexp` | `#393939` | `#393939` | 数据与字面量 / 正则表达式：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-boolean` | `#C98208` | `#C98208` | 数据与字面量 / 布尔值：布尔值按明细表与关键字同色；其他数据文本用默认灰色 |
| `--color-code-symbol` | `#393939` | `#393939` | 数据与字面量 / 符号：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-template-variable` | `#393939` | `#393939` | 数据与字面量 / 模板字符串变量：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-subst` | `#393939` | `#393939` | 数据与字面量 / 模板字符串变量：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-tag` | `#393939` | `#393939` | 标记与标签 / 组件标签：标签保持对比度，继承默认文本色 |
| `--color-code-selector-tag` | `#393939` | `#393939` | 其他 / 选择器：出现次数极低，继承默认文本色 |
| `--color-code-selector-class` | `#393939` | `#393939` | 其他 / 选择器：出现次数极低，继承默认文本色 |
| `--color-code-selector-id` | `#393939` | `#393939` | 其他 / 选择器：出现次数极低，继承默认文本色 |
| `--color-code-error` | `#E02128` | `#E02128` | 其他 / 警示：使用红色增强视觉警示 |

## code-dark

[data-theme="dark"]

| Token | 引用或定义 | 解析色值 | 使用说明 |
| --- | --- | --- | --- |
| `--color-code-background` | `#131416` | `#131416` | 基础与容器 / 代码块基础：定义代码块背景；与非代码背景建立层级 |
| `--color-code-foreground` | `#DFDFDF` | `#DFDFDF` | 基础与容器 / 默认文本：定义代码块基础文本，不与容器背景混淆 |
| `--color-code-comment` | `#777777` | `#777777` | 注释内容 / 普通注释：注释保持可读，并弱化于主要语法 |
| `--color-code-quote` | `#777777` | `#777777` | 注释内容 / 引用/指导：注释保持可读，并弱化于主要语法 |
| `--color-code-bullet` | `#777777` | `#777777` | 注释内容 / 项目符号：注释保持可读，并弱化于主要语法 |
| `--color-code-javadoc` | `#777777` | `#777777` | 注释内容 / 文档注释界定符：注释保持可读，并弱化于主要语法 |
| `--color-code-doctag` | `#777777` | `#777777` | 注释内容 / 文档标签：注释保持可读，并弱化于主要语法 |
| `--color-code-link` | `#2E86DE` | `#2E86DE` | 注释内容 / 链接：文档注释中的链接，需要与普通注释区分 |
| `--color-code-keyword` | `#F8CD75` | `#F8CD75` | 程序结构 / 关键字：以高亮区分结构与控制逻辑，帮助识别 import、if、for 等代码组织关系 |
| `--color-code-punctuation` | `#DFDFDF` | `#DFDFDF` | 程序结构 / 标点符号：基础符号使用默认文本色，减少高亮干扰 |
| `--color-code-operator` | `#DFDFDF` | `#DFDFDF` | 程序结构 / 操作符：基础符号使用默认文本色，减少高亮干扰 |
| `--color-code-section` | `#777777` | `#777777` | 程序结构 / 章节/区块：特殊标记使用弱化的灰色 |
| `--color-code-meta` | `#C76207` | `#C76207` | 修饰器与元指令 / 修饰器：区分装饰器与元指令，使影响声明行为的标记易于识别 |
| `--color-code-type` | `#A89FF9` | `#A89FF9` | 类型系统 / 类型注解：突出类型注解，区别于普通变量及文本 |
| `--color-code-title` | `#36C18D` | `#36C18D` | 类型系统 / 类/结构体名：区分类或组件名称，便于识别类型和结构定义 |
| `--color-code-class` | `#5CA2E9` | `#5CA2E9` | 类型系统 / 类/结构体名：突出类或结构体声明的名称 |
| `--color-code-name` | `#5CA2E9` | `#5CA2E9` | 函数与调用 / 函数名：突出函数调用，便于识别执行入口与调用关系 |
| `--color-code-function` | `#5CA2E9` | `#5CA2E9` | 函数与调用 / 函数定义：突出函数定义，便于区分声明与普通文本 |
| `--color-code-params` | `#DFDFDF` | `#DFDFDF` | 函数与调用 / 函数参数：函数名称突出；参数使用默认文本；内置项另行区分 |
| `--color-code-built-in` | `#55CCD9` | `#55CCD9` | 函数与调用 / 内置函数：函数名称突出；参数使用默认文本；内置项另行区分 |
| `--color-code-attr` | `#A89FF9` | `#A89FF9` | 属性和变量 / 属性名：突出属性键或对象键，与属性值及普通变量区分 |
| `--color-code-value` | `#EB74DF` | `#EB74DF` | 属性和变量 / 属性值：单独区分属性值，避免与属性键混淆 |
| `--color-code-property` | `#5CA2E9` | `#5CA2E9` | 属性和变量 / 对象属性访问：突出对象属性访问，帮助理解成员关系 |
| `--color-code-variable` | `#DFDFDF` | `#DFDFDF` | 属性和变量 / 变量：属性名称、属性值和对象访问分层；普通变量保持默认文本 |
| `--color-code-string` | `#DFDFDF` | `#DFDFDF` | 数据与字面量 / 字符串：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-literal` | `#DFDFDF` | `#DFDFDF` | 数据与字面量 / 字面量：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-number` | `#DFDFDF` | `#DFDFDF` | 数据与字面量 / 数值：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-regexp` | `#DFDFDF` | `#DFDFDF` | 数据与字面量 / 正则表达式：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-boolean` | `#F8CD75` | `#F8CD75` | 数据与字面量 / 布尔值：布尔值按明细表与关键字同色；其他数据文本用默认灰色 |
| `--color-code-symbol` | `#DFDFDF` | `#DFDFDF` | 数据与字面量 / 符号：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-template-variable` | `#DFDFDF` | `#DFDFDF` | 数据与字面量 / 模板字符串变量：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-subst` | `#DFDFDF` | `#DFDFDF` | 数据与字面量 / 模板字符串变量：高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-tag` | `#DFDFDF` | `#DFDFDF` | 标记与标签 / 组件标签：标签保持对比度，继承默认文本色 |
| `--color-code-selector-tag` | `#DFDFDF` | `#DFDFDF` | 其他 / 选择器：出现次数极低，继承默认文本色 |
| `--color-code-selector-class` | `#DFDFDF` | `#DFDFDF` | 其他 / 选择器：出现次数极低，继承默认文本色 |
| `--color-code-selector-id` | `#DFDFDF` | `#DFDFDF` | 其他 / 选择器：出现次数极低，继承默认文本色 |
| `--color-code-error` | `#EE696F` | `#EE696F` | 其他 / 警示：使用红色增强视觉警示 |

## StarCode 语义与平台映射

IDE 项目名是 DevEco 示例，其他 IDE 按实际名称对应；example 为便于使用整理的语法示例。映射元数据只维护于 code-light 各项 codeMapping。

| Token | 大类 / 子类 | Highlight.js | IDE 设置项 | 频率 | 用途示例 | 选色理由 |
| --- | --- | --- | --- | --- | --- | --- |
| `--color-code-background` | 基础与容器 / 代码块基础 | .hljs | background | 高 | 代码块背景 | 定义代码块背景；与非代码背景建立层级 |
| `--color-code-foreground` | 基础与容器 / 默认文本 | foreground | foreground | 高 | 未指定语法样式的文本 | 定义代码块基础文本，不与容器背景混淆 |
| `--color-code-comment` | 注释内容 / 普通注释 | .hljs-comment | Comment | 高 | // 注释；/* 多行注释 */ | 注释保持可读，并弱化于主要语法 |
| `--color-code-quote` | 注释内容 / 引用/指导 | .hljs-quote | / | 低 | > 引用内容 | 注释保持可读，并弱化于主要语法 |
| `--color-code-bullet` | 注释内容 / 项目符号 | .hljs-bullet | / | 低 | - 列表项 | 注释保持可读，并弱化于主要语法 |
| `--color-code-javadoc` | 注释内容 / 文档注释界定符 | .hljs-javadoc | / | 低 | /** 文档注释 */ | 注释保持可读，并弱化于主要语法 |
| `--color-code-doctag` | 注释内容 / 文档标签 | .hljs-doctag | / | 低 | @param | 注释保持可读，并弱化于主要语法 |
| `--color-code-link` | 注释内容 / 链接 | .hljs-link | / | 低 | 文档注释内链接 | 文档注释中的链接，需要与普通注释区分 |
| `--color-code-keyword` | 程序结构 / 关键字 | .hljs-keyword | Keyword; New class 中的 new | 高 | import、function、this、while、if、continue、for、let、new | 以高亮区分结构与控制逻辑，帮助识别 import、if、for 等代码组织关系 |
| `--color-code-punctuation` | 程序结构 / 标点符号 | .hljs-punctuation | Braces; Brackets; Comma; Dot sign; Semicolon; Parenthesis; Arrow function | 高 | [ ] { } ( ) , . ; | 基础符号使用默认文本色，减少高亮干扰 |
| `--color-code-operator` | 程序结构 / 操作符 | .hljs-operator | Operator | 高 | + - * / = > | 基础符号使用默认文本色，减少高亮干扰 |
| `--color-code-section` | 程序结构 / 章节/区块 | .hljs-section | / | 低 | 章节或区块标记 | 特殊标记使用弱化的灰色 |
| `--color-code-meta` | 修饰器与元指令 / 修饰器 | .hljs-meta | Decorator | 高 | @Entry、@Component、@State | 区分装饰器与元指令，使影响声明行为的标记易于识别 |
| `--color-code-type` | 类型系统 / 类型注解 | .hljs-type | Interface; Class; Enum; Type parameter（泛型） | 高 | class Person、let person: Person | 突出类型注解，区别于普通变量及文本 |
| `--color-code-title` | 类型系统 / 类/结构体名 | .hljs-title | Inherited class; Implemented interface; Component name | 高 | 类名与组件名 | 区分类或组件名称，便于识别类型和结构定义 |
| `--color-code-class` | 类型系统 / 类/结构体名 | .hljs-class | Module name; Struct; Type alias; Type parameter | 高 | class Person {}、struct MyComponent {} | 突出类或结构体声明的名称 |
| `--color-code-name` | 函数与调用 / 函数名 | .hljs-name | Function/Method call | 高 | myFunction()、new Person() | 突出函数调用，便于识别执行入口与调用关系 |
| `--color-code-function` | 函数与调用 / 函数定义 | .hljs-function | Function/Method declaration | 高 | build()、onClick() | 突出函数定义，便于区分声明与普通文本 |
| `--color-code-params` | 函数与调用 / 函数参数 | .hljs-params | Parameter | 高 | function test(a, b) {} | 函数名称突出；参数使用默认文本；内置项另行区分 |
| `--color-code-built-in` | 函数与调用 / 内置函数 | .hljs-built_in | Primitive types | 中 | Math、max、console、string、boolean | 函数名称突出；参数使用默认文本；内置项另行区分 |
| `--color-code-attr` | 属性和变量 / 属性名 | .hljs-attr | Object key | 高 | fontSize、onClick 等键名 | 突出属性键或对象键，与属性值及普通变量区分 |
| `--color-code-value` | 属性和变量 / 属性值 | .hljs-value | Injected language fragment | 中 | Text("hello") 等属性值 | 单独区分属性值，避免与属性键混淆 |
| `--color-code-property` | 属性和变量 / 对象属性访问 | .hljs-property | Field; Static field | 高 | title、textSize、info、name | 突出对象属性访问，帮助理解成员关系 |
| `--color-code-variable` | 属性和变量 / 变量 | .hljs-variable | Local variable; Label; Variable | 高 | myVariable、object.property | 属性名称、属性值和对象访问分层；普通变量保持默认文本 |
| `--color-code-string` | 数据与字面量 / 字符串 | .hljs-string | String | 高 | Hello ArkTS、A | 高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-literal` | 数据与字面量 / 字面量 | .hljs-literal | Enum constant; Hexadecimal number; Number | 高 | let isActive = true; let value = null | 高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-number` | 数据与字面量 / 数值 | .hljs-number | Enum constant; Hexadecimal number; Number | 高 | 42、3.14、0xFF | 高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-regexp` | 数据与字面量 / 正则表达式 | .hljs-regexp | Regular expression | 低 | /^\d+$/ | 高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-boolean` | 数据与字面量 / 布尔值 | .hljs-boolean | Keyword | 高 | true、false | 布尔值按明细表与关键字同色；其他数据文本用默认灰色 |
| `--color-code-symbol` | 数据与字面量 / 符号 | .hljs-symbol | / | 低 | Symbol("desc") | 高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-template-variable` | 数据与字面量 / 模板字符串变量 | .hljs-template-variable | / | 中 | `Hello ${name}` | 高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-subst` | 数据与字面量 / 模板字符串变量 | .hljs-subst | / | 中 | ${value} | 高频数据文本以默认灰色保持连续阅读；仅需要强调的逻辑类型高亮 |
| `--color-code-tag` | 标记与标签 / 组件标签 | .hljs-tag | / | 中 | Column、Text | 标签保持对比度，继承默认文本色 |
| `--color-code-selector-tag` | 其他 / 选择器 | .hljs-selector-tag | / | 极低 | div、container | 出现次数极低，继承默认文本色 |
| `--color-code-selector-class` | 其他 / 选择器 | .hljs-selector-class | / | 极低 | .main | 出现次数极低，继承默认文本色 |
| `--color-code-selector-id` | 其他 / 选择器 | .hljs-selector-id | / | 极低 | #main | 出现次数极低，继承默认文本色 |
| `--color-code-error` | 其他 / 警示 | .hljs-error | Bad Character | 高 | 非法字符 | 使用红色增强视觉警示 |

#!/usr/bin/env bash
# generate-ux-prototype 环境安装(macOS) —— fastui-vue-creator 同款机制(逐字移植)
#
# 机制与坑位的完整依据:fastui-vue-creator 仓库 docs/specs/design/fastui-vue-codegen-pipeline.md
# (SPEC-DES-001 §4.1 node 决策 / §4.4 内网托管 / §5.1.1 日志契约)及 SPEC-DES-002 托管手册。
#
# 本脚本只负责一件事:**弄到一个能用的 node**。
# **手上有能跑的 node 就用它,不管大版本**(不设版本门禁,fastui §4.1 定案);一个都没有才下载
# portable node —— 内网很多机器装 opencode 时已经有 node,这批人首装因此完全不碰
# manifest / node 包那条链路。拿到 node 之后立刻 exec setup-compiler.mjs —— 装 compiler
# 依赖、写 env.lock.json 那些跨平台逻辑只在 .mjs 里写一份,PowerShell 和 bash 各写一遍必然漂移。
# (本项目不用 yarn、无脚手架依赖树,所以 node 之后只剩 compiler 依赖一段。)
#
# 用法:
#   bash install.sh [--manifest=<url|path>] [--env-dir=<路径>] [--from-local=<目录>]
#                   [--registry=<npm 源>] [--upgrade] [--skip-node] [--force-portable-node]
#                   [--proxy=<地址>]   # 默认强制直连,只有确实必须经代理才传
#   bash install.sh --check            # 只探测网络,不下载、不安装
# (-skip-node 现在基本是历史开关:手上有能跑的 node 时本来就不会下载)
#
# `-E` 不能省:ERR trap **默认不被 shell 函数继承**,而 --check 的全部逻辑都在 check_mode /
# http_get / probe_asset 这些函数里 —— 少了它,S8 的兜底在整条 --check 路径上一次都不成立。
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

MANIFEST=""; ENV_DIR=""; FROM_LOCAL=""; REGISTRY=""; UPGRADE=""; SKIP_NODE=""; STRICT_CERT=""; PROXY=""; CHECK=""; FORCE_PORTABLE=""; BAD_ARG=""
# 参数非法**先记下来、不当场退出** —— ENV_DIR 要从参数里读,而日志落在 ENV_DIR 下,
# 当场退出的话这条失败路径反而是唯一不落盘的那条。
for a in "$@"; do
  case "$a" in
    --manifest=*)   MANIFEST="${a#*=}" ;;
    --env-dir=*)    ENV_DIR="${a#*=}" ;;
    --from-local=*) FROM_LOCAL="${a#*=}" ;;
    --registry=*)   REGISTRY="${a#*=}" ;;
    --upgrade)      UPGRADE=1 ;;
    --skip-node)    SKIP_NODE=1 ;;
    --force-portable-node) FORCE_PORTABLE=1 ;;   # 逃生开关:系统 node 可疑时强制走下载
    --strict-cert)  STRICT_CERT=1 ;;
    --check)        CHECK=1 ;;
    --proxy=*)      PROXY="${a#*=}" ;;
    *) BAD_ARG="$a" ;;
  esac
done

[ -z "$ENV_DIR" ] && ENV_DIR="${OCTO_UX_ENV_DIR:-$HOME/Library/Application Support/OctoAgent/ux-prototype}"
NODE_DIR="$ENV_DIR/node"
NODE_BIN="$NODE_DIR/bin/node"

# ── 全程落盘(fastui v15 S5)────────────────────────────────────────
#
# 首装失败时如果唯一的证据是 agent 转述的只言片语,就定位不了。
# 判据是「发日志就能定位」—— 所以 stdout / stderr 各自 tee 一份到与 .mjs 共用的
# 日志文件,两条流仍然分开(stdout 只放契约行),只是各多写一份进日志。
#
# **交给 setup-compiler.mjs 之前会把 fd 还原**:那个脚本自己会往同一个文件里写,
# 不还原的话它的每一行都会进日志两遍。
#
# 日志里不留代理凭据:--proxy=http://user:pass@host 这种写法会把口令写进文件,
# 而这个文件是要发给人排障的。
redact() { printf '%s' "$1" | sed -E 's#(://[^:/@]*):[^@[:space:]]*@#\1:***@#g'; }

LOG="$ENV_DIR/octo-ux-prototype.log"
TEE_ON=""
if mkdir -p "$ENV_DIR" 2>/dev/null; then
  exec 3>&1 4>&2
  exec 1> >(tee -a "$LOG" >&3) 2> >(tee -a "$LOG" >&4)
  TEE_ON=1
fi
printf '\n===== %s install.sh %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$(redact "$*")" >&2
[ -z "$TEE_ON" ] && echo "[warn] 建不了 $ENV_DIR,本次不落盘" >&2

fail() {
  echo "RESULT: FAIL | $1: $2"
  [ -n "${3:-}" ] && echo "DETAIL: $3"
  [ -n "${4:-}" ] && echo "HINT: $4"
  [ -n "$TEE_ON" ] && echo "LOG: $LOG"
  exit 1
}
# 用法错误与业务失败分开:退出码 2
bad_usage() { echo "RESULT: FAIL | BAD_USAGE: $1"; [ -n "$TEE_ON" ] && echo "LOG: $LOG"; exit 2; }

# ── 兜底:任何没被 fail 接住的失败也要打出契约行(fastui v15 S8)───────
#
# `set -e` 下 mktemp / read / tar 这类命令失败会直接静默退出,那几条路上
# 一行 `RESULT:` 都没有。ERR trap 把它们收拢成一条 UNEXPECTED ——
# 不求精确归因,只求**任何一次失败都有契约行 + 日志路径**。
#
# **边界(要诚实)**:放在条件位置调用的函数,豁免会传进整个函数体 —— `http_get`
# (总是 `if ! http_get …`)与 `probe_asset`(总是 `… || bad=…`)内部的裸崩,这个兜底
# **接不住**。所以那两个函数自己防:curl 一律 `set +e` 明确接管退出码、grep 一律
# `|| true`、返回值只由显式的 case/return 决定。
on_error() {
  ec=$?
  # ⚠️ **子 shell 里直接把真实退出码原样传出去,一个字都不许打。**
  # `-E` 也传给命令替换的子 shell,而 `g="$(curl …)"` 的 stdout 正是捕获管道 ——
  # trap 一开口,契约行就被灌进变量,真实退出码也被改写(fastui 内网实测)。
  [ "${BASH_SUBSHELL:-0}" -gt 0 ] && exit "$ec"
  echo "RESULT: FAIL | UNEXPECTED: 安装脚本在第 $1 行意外中止(exit=$ec)"
  echo "HINT: 这条路径没有专门的错误处理,把 LOG 里这次运行的整段(从 ===== 那行起)发出来"
  [ -n "$TEE_ON" ] && echo "LOG: $LOG"
  exit 1
}
trap 'on_error $LINENO' ERR

[ -n "$BAD_ARG" ] && bad_usage "未知参数 $BAD_ARG"
[ -n "$CHECK" ] && [ -n "$FROM_LOCAL" ] && bad_usage "--check 是网络探测,不能与 --from-local 同用"

# 内网证书基本都是自签名的,默认放行 —— 传 --strict-cert 才严格校验。
# 完整性靠下载后的 sha256 比对保证,那比 TLS 证书链更强(校验的是文件内容本身)。
#
# **内网 host 一律强制直连**(fastui 内网实测:agent 宿主进程注入出外网代理,NO_PROXY
# 没能生效,请求被送进 CONNECT 隧道拿到 504,首装从第一步就卡死;而内网服务解析到
# 10.x 内网地址,压根不需要代理 —— 直连是唯一走得通的路)。
# 不做"失败了自动回退走代理":那会用第二次的结果掩盖第一次失败的真实原因。
#
# 用数组而不是字符串:`--noproxy *` 不带引号展开会被 shell 当通配符。
# 显式传 --proxy 时也要把 --noproxy 定死成空,否则 curl 仍会读 NO_PROXY,逃生开关可能被静默旁路。
CURL_ARGS=(--noproxy '*')
[ -n "$PROXY" ] && CURL_ARGS=(--proxy "$PROXY" --noproxy '')
[ -z "$STRICT_CERT" ] && CURL_ARGS+=(-k)

# 平台键 darwin 写死(fastui 同款)
ARCH="$(uname -m)"; [ "$ARCH" = "x86_64" ] && ARCH="x64"
PLATFORM_KEY="darwin-$ARCH"

# ── 系统 node:先认出来,它决定后面几乎所有分支 ────────────────────────
SYS_NODE="$(command -v node || true)"
SYS_NODE_VER=""
if [ -n "$SYS_NODE" ]; then
  SYS_NODE_VER="$("$SYS_NODE" -v 2>/dev/null || true)"
  # 版本号只用来打日志(诊断),**不参与任何判断** —— 判据是"跑不跑得出版本号"。
  # 跑不出来的当没有:那种 node 后面 spawn 也会挂,不如当场落回下载。
  case "$SYS_NODE_VER" in
    v[0-9]*) ;;
    *) SYS_NODE=""; SYS_NODE_VER="" ;;
  esac
fi

PY="$(command -v python3 || true)"
# **python3 不是硬门槛**:只用来解析 manifest.json,而复用系统 node 的机器根本不拉
# manifest。真正要用到的两处(--check、下载 node)各自调 require_py。
require_py() {
  [ -n "$PY" ] || fail NO_PYTHON "找不到 python3,无法解析 manifest.json" "" "安装 Xcode Command Line Tools: xcode-select --install;或在一台已有 node 的机器上跑(复用系统 node 那条路不需要 python3)"
}

# 读 skill 自带的 `references/env.manifest.json`(随 skill 走,不走网络)。
# **有系统 node 就用它解析**,没有才用 python3 —— 这个文件是纯本地的,不该把
# "机器上有没有 python3"变成读它的前提。
skill_manifest_field() {   # <字段名>
  local f="$1" j="$SKILL_DIR/references/env.manifest.json"
  [ -f "$j" ] || return 0
  if [ -n "$SYS_NODE" ]; then
    "$SYS_NODE" -e 'const fs=require("fs");let v="";try{v=JSON.parse(fs.readFileSync(process.argv[2],"utf8"))[process.argv[1]]??""}catch{};console.log(Array.isArray(v)?v.join(" "):String(v))' "$f" "$j" 2>/dev/null || true
  elif [ -n "$PY" ]; then
    "$PY" - "$f" "$j" <<'PYJSON' 2>/dev/null || true
import json, sys
try:
    v = json.load(open(sys.argv[2])).get(sys.argv[1], "")
except Exception:
    v = ""
print(" ".join(str(x) for x in v) if isinstance(v, list) else v)
PYJSON
  fi
}

# manifest 默认从 skill 的 env.manifest.json 里读(URL 直接写死在那里)
if [ -z "$MANIFEST" ] && [ -z "$FROM_LOCAL" ]; then
  MANIFEST="$(skill_manifest_field manifestUrl)"
fi

TMP=""
cleanup() { [ -n "${TMP:-}" ] && [ -d "${TMP:-}" ] && rm -rf "$TMP"; }
trap cleanup EXIT
TMP="$(mktemp -d)"

# ── HTTP:统一走这两个函数 ────────────────────────────────────────
#
# **不用 `-f`**:curl 遇 HTTP 错误直接丢弃响应体,而网关错误页的正文恰恰就是
# 定位依据。改成自己判状态码,失败时把 body 写进日志。
HTTP_CODE=""; HTTP_MS=""; CURL_EXIT=0
http_get() {   # url outfile [max-time]
  local url="$1" out="$2" mt="${3:-}" w
  local -a args
  args=("${CURL_ARGS[@]}" -sS -L --connect-timeout 20)
  [ -n "$mt" ] && args+=(--max-time "$mt")
  set +e
  w="$(curl "${args[@]}" -H 'Cache-Control: no-cache' -w '%{http_code} %{time_total}' -o "$out" "$url" 2>"$TMP/curl.err")"
  CURL_EXIT=$?
  set -e
  HTTP_CODE="${w%% *}"; HTTP_MS="${w##* }"
  [ -s "$TMP/curl.err" ] && { echo "[curl] $(tr -d '\r' < "$TMP/curl.err" | tr '\n' ' ')" >&2; }
  echo "[http] $url -> code=$HTTP_CODE exit=$CURL_EXIT time=${HTTP_MS}s" >&2
  case "$HTTP_CODE" in 2*) [ "$CURL_EXIT" = "0" ] && return 0 ;; esac
  return 1
}

# 失败响应体原样进日志。错误页一般几百字节;超过 64KB 或看着像二进制就只记大小。
dump_body() {  # file label
  local f="$1" sz
  [ -f "$f" ] || return 0
  sz="$(wc -c < "$f" | tr -d ' ')"
  if [ "$sz" = "0" ]; then echo "[body] $2: 空" >&2; return 0; fi
  if [ "$sz" -gt 65536 ]; then echo "[body] $2: $sz 字节,过大不记录原文" >&2; return 0; fi
  echo "[body] $2 ($sz 字节),前 2KB:" >&2
  head -c 2048 "$f" | LC_ALL=C tr -d '\000' >&2
  echo "" >&2
}

body_preview() {  # file —— 给 DETAIL 用的一行摘要
  [ -f "$1" ] || return 0
  head -c 200 "$1" | LC_ALL=C tr -d '\000' | tr '\r\n\t' '   ' | sed 's/  */ /g'
}

platforms_of() {  # manifest.json → 每行 "<平台键>\t<相对路径>"
  "$PY" - "$1" <<'PYEOF'
import json, sys
m = json.load(open(sys.argv[1]))
for k, v in (m.get("node", {}).get("platforms", {}) or {}).items():
    print("%s\t%s" % (k, v.get("file", "")))
PYEOF
}

# ── --check:只探测,不下载 ────────────────────────────────────────
#
# 探测放在真正会去下载的这个脚本里,**复用同一套 CURL_ARGS / 同一个 manifest URL /
# 同一条 URL 拼法** —— 平行实现必然漂移(fastui 教训:doctor 与 install 各答一个,
# 出现"诊断 200、安装 504")。
#
# 探测 manifest 里**每一个平台**的包,不只是本机这个 —— 只验跑命令那台的平台,
# 设计师那台另一个平台就从没被验过(fastui 内网踩过)。
probe_asset() {  # 平台键 url
  local key url hkey w ec hcode hlen htype g gec gcode note
  key="$1"; url="$2"
  hkey="$(echo "$key" | tr 'a-z-' 'A-Z_')"

  set +e
  w="$(curl "${CURL_ARGS[@]}" -sS -I -L --connect-timeout 20 --max-time 60 -D "$TMP/h.txt" -o /dev/null -w '%{http_code}' "$url" 2>"$TMP/curl.err")"
  ec=$?
  set -e
  hcode="$w"; [ "$ec" = "0" ] || hcode="$w(curl exit=$ec)"
  hlen="$(grep -i '^content-length:' "$TMP/h.txt" 2>/dev/null | tail -1 | tr -d '\r' | awk '{print $2}' || true)"
  htype="$(grep -i '^content-type:' "$TMP/h.txt" 2>/dev/null | tail -1 | tr -d '\r' | awk '{print $2}' || true)"
  # HEAD 响应没有正文,它的等价物是**响应头** —— WAF 规则号、Server、Set-Cookie 都在那儿。
  # 失败时整份落盘,别只留一个状态码。
  case "$w" in
    2*) ;;
    *) dump_body "$TMP/h.txt" "$key HEAD 响应头"
       [ -s "$TMP/curl.err" ] && echo "[curl] $key HEAD: $(tr -d '\r' < "$TMP/curl.err" | tr '\n' ' ')" >&2 ;;
  esac

  # HEAD 之外再做一次 **1 字节的 Range GET**:同一个 URL 浏览器/HEAD 拿得到、GET 403
  # 是真实发生过的形态 —— 只验 HEAD 会给出假的全绿。--max-filesize 兜住服务端忽略
  # Range 的情况(返回 200 + 完整 Content-Length,curl 以 exit 63 中止,不会真把包拉下来)。
  # **响应体必须落文件**:被谁拦的(WAF 规则号 / MIME / UA)只写在正文里。
  set +e
  g="$(curl "${CURL_ARGS[@]}" -sS -L --connect-timeout 20 --max-time 60 -r 0-0 --max-filesize 1048576 -o "$TMP/probe.bin" -w '%{http_code}' "$url" 2>"$TMP/curl2.err")"
  gec=$?
  set -e
  gcode="$g"; note=""
  [ "$gec" = "63" ] && note="(服务端忽略 Range,已中止,未下载)"
  [ "$gec" != "0" ] && [ "$gec" != "63" ] && gcode="$g(curl exit=$gec)"

  echo "ASSET_$hkey: HEAD=$hcode GET=$gcode$note len=${hlen:-?} type=${htype:-?}"
  case "$g" in
    200|206) return 0 ;;
    *)
      dump_body "$TMP/probe.bin" "$key GET 错误响应"
      [ -s "$TMP/curl2.err" ] && echo "[curl] $key GET: $(tr -d '\r' < "$TMP/curl2.err" | tr '\n' ' ')" >&2
      return 1 ;;
  esac
}

check_mode() {
  local mjson bad total key file v seen
  require_py
  echo "CHECK_MODE: probe-only"
  echo "PLATFORM_HERE: $PLATFORM_KEY"
  if [ -n "$PROXY" ]; then echo "PROXY_MODE: via $(redact "$PROXY")"; else echo "PROXY_MODE: direct(--noproxy '*')"; fi
  if [ -n "$STRICT_CERT" ]; then echo "TLS_VERIFY: ON"; else echo "TLS_VERIFY: OFF(-k,完整性靠 sha256)"; fi
  echo "CURL_VERSION: $(curl --version 2>/dev/null | head -1)"
  # 本进程看到的代理变量 —— curl 会读它们(我们强制直连,但"环境里有什么"本身就是线索)。
  # 一个都没有时也要显式打一行,否则分不清"没有代理"和"没查代理"。
  seen=""
  for k in HTTP_PROXY HTTPS_PROXY ALL_PROXY NO_PROXY http_proxy https_proxy all_proxy no_proxy; do
    v="${!k:-}"
    [ -n "$v" ] && { echo "PROXY_ENV_$k: $v"; seen=1; }
  done
  [ -z "$seen" ] && echo "PROXY_ENV: (无)"

  [ -n "$MANIFEST" ] || fail NO_MANIFEST "没有 manifest 地址" "" "传 --manifest=<url>"
  echo "MANIFEST_URL: $MANIFEST"
  mjson="$TMP/manifest.json"
  case "$MANIFEST" in *\?*) SEP="&" ;; *) SEP="?" ;; esac
  if ! http_get "$MANIFEST${SEP}t=$(date +%s)" "$mjson" 60; then
    dump_body "$mjson" "manifest 错误响应"
    fail MANIFEST_UNREACHABLE "拉不到 manifest(HTTP $HTTP_CODE / curl exit $CURL_EXIT)" \
      "$(body_preview "$mjson")" \
      "响应体已记进 LOG。若这台机器确实必须经代理才能到内网,加 --proxy=<地址> 再跑一次 --check 对比"
  fi
  echo "MANIFEST_HTTP: $HTTP_CODE"
  echo "MANIFEST_BYTES: $(wc -c < "$mjson" | tr -d ' ')"
  echo "MANIFEST_MS: $HTTP_MS"
  if ! "$PY" -c "import json,sys;json.load(open(sys.argv[1]))" "$mjson" 2>/dev/null; then
    dump_body "$mjson" "manifest 正文"
    fail MANIFEST_NOT_JSON "manifest 拿到了但不是 JSON(多半是代理/网关的错误页)" "$(body_preview "$mjson")" "响应体已记进 LOG"
  fi

  BASE="$(dirname "$MANIFEST")"
  bad=0; total=0
  while IFS=$'\t' read -r key file; do
    [ -n "$key" ] || continue
    total=$((total + 1))
    probe_asset "$key" "$BASE/$file" || bad=$((bad + 1))
  done <<EOF
$(platforms_of "$mjson")
EOF

  echo "CHECKED_PLATFORMS: $total"

  [ "$total" = "0" ] && fail NO_PLATFORM_PKG "manifest 的 node.platforms 是空的" "" "在 manifest.json 里补平台条目"
  if [ "$bad" != "0" ]; then
    fail ASSET_UNREACHABLE "$bad/$total 个平台的 node 包拉不到(见上面 ASSET_* 行)" "" \
      "文件在不在、nginx 给没给这个扩展名配 MIME、WAF 有没有按 UA/扩展名拦 —— 这三项要内网投放侧确认"
  fi
  echo "RESULT: OK"
  echo "NOTE: 只做了 HEAD 与 1 字节 Range GET,没有下载整包;整包完整性仍由安装时的 sha256 比对保证"
  exit 0
}

[ -n "$CHECK" ] && check_mode

# ── 决定用哪个 node ──────────────────────────────────────────────
#
# 三级,没有第四种情况:
#   ① --force-portable-node  逃生开关:怀疑手上这个 node 有问题时强制走下载
#   ② 手上有能跑的 node       复用(池子优先于系统)——**不看大版本**
#   ③ 一个都没有              下载 portable node(唯一需要网络的路径)
#
# **不设版本门禁**(fastui v16 定案):设过一版白名单,代价是一台什么都不缺的机器
# 会因为一个猜出来的数字被推去走已知 403 过的下载链路然后死在那儿。
# **不能因为环境卡别人。** 真不兼容的形态由脚本侧 NODE_SUSPECT 指纹认出来,
# 而不是靠事前猜版本号。依赖树一致性不靠 node 版本,靠 lockfileHash。
#
# ② 的判据是「`node -v` 跑得出来」,不是「文件在不在」。
POOL_NODE_OK=""
if [ -x "$NODE_BIN" ] && "$NODE_BIN" -v >/dev/null 2>&1; then POOL_NODE_OK=1; fi

NEED_NODE=""; NODE_SRC=""; EFFECTIVE_NODE=""
if [ -n "$FORCE_PORTABLE" ]; then
  NEED_NODE=1; NODE_SRC="download(--force-portable-node)"
elif [ -n "$POOL_NODE_OK" ]; then
  NODE_SRC="pool"; EFFECTIVE_NODE="$NODE_BIN"
elif [ -n "$SYS_NODE" ]; then
  NODE_SRC="system"; EFFECTIVE_NODE="$SYS_NODE"
elif [ -n "$SKIP_NODE" ]; then
  # --skip-node 明说别碰 node,可是手上一个都没有 —— 这是调用方的矛盾,直接说清楚
  fail NODE_MISSING "--skip-node 要求机器上已有可用的 node,但池子里和系统里都没有" "" "去掉 --skip-node 重跑,让脚本自己下载 portable node"
else
  NEED_NODE=1; NODE_SRC="download(机器上没有 node)"
fi
echo "[node] 来源: $NODE_SRC${EFFECTIVE_NODE:+ -> $EFFECTIVE_NODE}${SYS_NODE_VER:+;系统 node $SYS_NODE_VER}" >&2

# ── 取 manifest ────────────────────────────────────────────────
# **只在要下载 node 时才拉**:已有 node 的机器引导这一段一次网络请求都不发,
# 彻底绕开曾经 504 / 403 过的那条链路(fastui v16 同款)。
if [ -n "$NEED_NODE" ]; then require_py; fi

MJSON=""; BASE=""
if [ -z "$NEED_NODE" ]; then
  if [ -n "$MANIFEST" ] || [ -n "$FROM_LOCAL" ]; then
    echo "[skip] 不需要下载 node,不读 manifest" >&2
  fi
elif [ -n "$FROM_LOCAL" ]; then
  MJSON="$FROM_LOCAL/manifest.json"
  [ -f "$MJSON" ] || fail NO_MANIFEST "离线目录里没有 manifest.json: $MJSON"
  BASE="$FROM_LOCAL"
elif [ -n "$MANIFEST" ]; then
  MJSON="$TMP/manifest.json"
  BASE="$(dirname "$MANIFEST")"
  # 加时间戳破缓存 —— 服务端没设 no-store,升级后别读到旧的
  # manifest URL 可能自带 query,拼第二个 ? 会拿到 404 —— ps1 侧一直判了,两边行为要一致
  case "$MANIFEST" in *\?*) SEP="&" ;; *) SEP="?" ;; esac
  if ! http_get "$MANIFEST${SEP}t=$(date +%s)" "$MJSON" 60; then
    dump_body "$MJSON" "manifest 错误响应"
    fail DOWNLOAD_FAILED "拉不到 manifest: $MANIFEST(HTTP $HTTP_CODE / curl exit $CURL_EXIT)" \
      "$(body_preview "$MJSON")" \
      "已强制直连(不经代理),响应体已记进 LOG。先跑 bash \"$SCRIPT_DIR/install.sh\" --check 看每个平台的包各是什么状态;若这台机器确实必须经代理才能到内网,传 --proxy=<地址>;或改用 --from-local=<本地目录> 离线安装。另:走到下载这一步,说明这台机器上一个能跑的 node 都没有(见上面那行 [node] 来源) —— 用任何方式装上一个 node(**版本不限**)就能整个跳过这条链路"
  fi
else
  fail NO_MANIFEST "要下载 node,但没有 manifest 地址" "" "传 --manifest=<url> 或 --from-local=<目录>"
fi

# manifest 是不是 JSON,在这里就判掉 —— 否则下面 `$PY -c json.load` 会带着 python
# traceback 撞进 ERR trap,报成一条 UNEXPECTED。拿到 200 却不是 JSON,现实里就是
# 代理/网关/SSO 的错误页,这个信息要直接说出来。
if [ -n "$MJSON" ] && ! "$PY" -c "import json,sys;json.load(open(sys.argv[1]))" "$MJSON" 2>/dev/null; then
  dump_body "$MJSON" "manifest 正文"
  fail MANIFEST_NOT_JSON "manifest 拿到了但不是合法 JSON(多半是代理/网关/SSO 的错误页)" \
    "$(body_preview "$MJSON")" \
    "响应体已记进 LOG。跑 bash \"$SCRIPT_DIR/install.sh\" --check 看每个平台各是什么状态"
fi

# registry 从 manifest 取;命令行 --registry 优先。
if [ -z "$REGISTRY" ] && [ -n "$MJSON" ]; then
  REGISTRY="$("$PY" -c "import json,sys;print(json.load(open(sys.argv[1])).get('npmRegistry',''))" "$MJSON")"
fi

# ── 下载 + 校验 + 解压 node ────────────────────────────────────
if [ -n "$NEED_NODE" ]; then
  [ -n "$MJSON" ] || fail NO_MANIFEST "要装 node,但没有可用的 manifest"

  read -r FILE SHA STRIP NODEVER <<EOF
$("$PY" - "$MJSON" "$PLATFORM_KEY" <<'PYEOF'
import json,sys
m=json.load(open(sys.argv[1])); p=m.get("node",{}).get("platforms",{}).get(sys.argv[2])
if not p: print("__MISSING__ __MISSING__ 1 __MISSING__"); sys.exit(0)
print(p.get("file",""), p.get("sha256",""), p.get("stripComponents",1), m.get("node",{}).get("version",""))
PYEOF
)
EOF
  # heredoc 里的命令替换失败**不触发 ERR trap、也不被 set -e 拦住**(fastui 实测),
  # python 崩掉的话 FILE 会是空串,然后一路带着空 URL 往下走 —— 必须显式判空。
  [ -n "${FILE:-}" ] || fail MANIFEST_PARSE_FAILED "解析 manifest 失败,取不到 $PLATFORM_KEY 的包信息" "" "确认 $MJSON 是合法 JSON 且有 node.platforms.$PLATFORM_KEY"
  [ "$FILE" = "__MISSING__" ] && fail NO_PLATFORM_PKG "manifest 里没有 $PLATFORM_KEY 的 node 包" "" "在 manifest.json 的 node.platforms 里补一条"

  # ── 下载 + 校验 ──────────────────────────────────────────────
  PKG="$TMP/$(basename "$FILE")"
  if [ -n "$FROM_LOCAL" ]; then
    cp "$BASE/$FILE" "$PKG" || fail NO_LOCAL_PKG "离线目录里没有 $FILE"
  else
    echo "[download] $BASE/$FILE" >&2
    if ! http_get "$BASE/$FILE" "$PKG"; then
      dump_body "$PKG" "node 包错误响应"
      fail DOWNLOAD_FAILED "下载 node 包失败: $BASE/$FILE(HTTP $HTTP_CODE / curl exit $CURL_EXIT)" \
        "$(body_preview "$PKG")" \
        "已强制直连(不经代理),响应体已记进 LOG。manifest 能拉到不代表这个包也能 —— 跑 bash \"$SCRIPT_DIR/install.sh\" --check 逐平台对比"
    fi
  fi

  # sha256 十六进制大小写不敏感,统一转小写再比 —— 否则会把完全正确的包判成损坏
  GOT="$(shasum -a 256 "$PKG" | awk '{print tolower($1)}')"
  WANT="$(echo "$SHA" | tr 'A-Z' 'a-z' | sed 's/^sha256://')"
  if [ -n "$WANT" ] && [ "$GOT" != "$WANT" ]; then
    fail SHA256_MISMATCH "node 包校验失败(下载可能被截断或代理改写)" "expected=$WANT actual=$GOT size=$(wc -c < "$PKG" | tr -d ' ')" "重新投放资源后重试"
  fi

  # ── 解压 ────────────────────────────────────────────────────
  mkdir -p "$NODE_DIR"
  tar -xzf "$PKG" -C "$NODE_DIR" --strip-components="${STRIP:-1}" \
    || fail EXTRACT_FAILED "解压失败: $PKG"
  [ -x "$NODE_BIN" ] || fail EXTRACT_FAILED "解压后找不到 $NODE_BIN(stripComponents 可能不对)"
  echo "[node] $("$NODE_BIN" -v) → $NODE_DIR" >&2
  EFFECTIVE_NODE="$NODE_BIN"
fi
[ -n "$EFFECTIVE_NODE" ] || fail NODE_MISSING "没能确定用哪个 node(内部状态异常)" "NODE_SRC=$NODE_SRC" "把 LOG 里这次运行的整段发出来"

# ── 交给 setup-compiler.mjs ────────────────────────────────────
ARGS=(--env-dir="$ENV_DIR")
[ -n "$REGISTRY" ] && ARGS+=(--registry="$REGISTRY")
[ -n "$UPGRADE" ] && ARGS+=(--upgrade)
[ -n "$PROXY" ] && ARGS+=(--proxy="$PROXY")   # 不透传的话,逃生开关只对下载 node 那一步有效
echo "[handoff] $EFFECTIVE_NODE setup-compiler.mjs $(redact "${ARGS[*]}") —— 之后的日志由它自己往同一个文件写" >&2

# exec 会替换掉当前进程,EXIT trap 不会跑 —— 临时目录要在这里自己清掉,
# 否则每次装完都留一份几十 MB 的 node 包。
cleanup
trap - EXIT
# tee 的 fd 也要还原,否则 setup-compiler 的输出会被这边 tee 一遍、它自己再写一遍,日志里全是双份。
# 3/4 用完就关,别随 exec 泄漏给 node 进程
[ -n "$TEE_ON" ] && exec 1>&3 2>&4 3>&- 4>&-
# 用 $EFFECTIVE_NODE 而不是写死 $NODE_BIN:复用系统 node 时池子里根本没有 node,
# setup-compiler 也就顺势跑在系统 node 上(它自己用 process.execPath 认出这一点)。
exec "$EFFECTIVE_NODE" "$SKILL_DIR/scripts/setup-compiler.mjs" "${ARGS[@]}"

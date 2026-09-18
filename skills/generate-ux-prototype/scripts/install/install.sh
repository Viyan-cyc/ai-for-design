#!/usr/bin/env bash
# generate-ux-prototype env install (macOS)
#
# Does ONE thing: get a working node.
# Reuse an existing node when `node -v` works (any major version); only
# download a portable node when there is none. After node is settled, exec
# setup-env.mjs which installs the compiler deps via npm (npm-only, no yarn).
#
# Download source: REMOTE MANIFEST. The manifest
# URL lives in references/env-config.json (manifestUrl). The manifest carries
# node.version, per-platform {file, sha256, stripComponents} and npmRegistry.
# node packages resolve relative to dirname(manifestUrl); integrity via the
# manifest's embedded sha256 (replaces the old SHASUMS256.txt flow).
#
# JSON parsing: needs python3 (bare-mac constraint, same as fastui). Machines
# that reuse a system node never pull the manifest, so python3 is only
# required on the download path.
#
# Usage:
#   bash install.sh [--manifest=<url|path>] [--env-dir=<path>] [--registry=<npm registry>]
#                   [--force-portable-node] [--proxy=<addr>] [--check]
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

MANIFEST=""; ENV_DIR=""; REGISTRY=""; PROXY=""; CHECK=""; FORCE_PORTABLE=""; BAD_ARG=""
for a in "$@"; do
  case "$a" in
    --manifest=*) MANIFEST="${a#*=}" ;;
    --env-dir=*) ENV_DIR="${a#*=}" ;;
    --registry=*) REGISTRY="${a#*=}" ;;
    --proxy=*) PROXY="${a#*=}" ;;
    --check) CHECK=1 ;;
    --force-portable-node) FORCE_PORTABLE=1 ;;
    *) BAD_ARG="$a" ;;
  esac
done

# ---------- env config (single source: references/env-config.json) ----------
# sed-based on purpose: this script must work on bare machines with no node,
# so config parsing cannot shell out to node (PS installer parses natively).
read_cfg() {  # <field>
  sed -n "s/^.*\"$1\"[[:space:]]*:[[:space:]]*\"\\([^\"]*\\)\".*/\\1/p" "$SKILL_DIR/references/env-config.json" 2>/dev/null | head -1
}
# manifest URL: --manifest > env-config.json manifestUrl
if [ -z "$MANIFEST" ]; then MANIFEST="$(read_cfg manifestUrl)"; fi
ENV_DIR_NAME="$(read_cfg envDirName)"
[ -z "$ENV_DIR" ] && ENV_DIR="${EP_UX_PROTO_ENV_DIR:-$HOME/Library/Application Support/$ENV_DIR_NAME}"
NODE_DIR="$ENV_DIR/node"
NODE_BIN="$NODE_DIR/bin/node"
LOG="$ENV_DIR/install.log"

# ---------- logging (tee stdout+stderr to LOG) ----------
TEE_ON=""
if mkdir -p "$ENV_DIR" 2>/dev/null; then
  exec 3>&1 4>&2
  exec 1> >(tee -a "$LOG" >&3) 2> >(tee -a "$LOG" >&4)
  TEE_ON=1
fi
printf '\n===== %s install.sh %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" >&2
[ -z "$TEE_ON" ] && echo "[warn] cannot create $ENV_DIR, not logging to disk" >&2

fail() {
  echo "RESULT: FAIL | $1: $2"
  [ -n "${3:-}" ] && echo "DETAIL: $3"
  [ -n "${4:-}" ] && echo "HINT: $4"
  [ -n "$TEE_ON" ] && echo "LOG: $LOG"
  exit 1
}

on_error() {
  ec=$?
  # in command-substitution subshells: pass the real exit code through, print nothing
  [ "${BASH_SUBSHELL:-0}" -gt 0 ] && exit "$ec"
  echo "RESULT: FAIL | UNEXPECTED: install.sh aborted at line $1 (exit=$ec)"
  echo "HINT: send the whole LOG run (from the ===== line) for triage"
  [ -n "$TEE_ON" ] && echo "LOG: $LOG"
  exit 1
}
trap 'on_error $LINENO' ERR

[ -n "$BAD_ARG" ] && fail BAD_USAGE "unknown arg $BAD_ARG" ""
[ -n "$MANIFEST" ] || fail NO_MANIFEST "no manifest URL (references/env-config.json missing manifestUrl)" "" "fix env-config.json or pass --manifest=<url>"

# ---------- curl: direct connection by default ----------
CURL_ARGS=(--noproxy '*')
[ -n "$PROXY" ] && CURL_ARGS=(--proxy "$PROXY" --noproxy '')

ARCH="$(uname -m)"; [ "$ARCH" = "x86_64" ] && ARCH="x64"
PLATFORM_KEY="darwin-$ARCH"

TMP="$(mktemp -d)"
cleanup() { [ -n "${TMP:-}" ] && [ -d "${TMP:-}" ] && rm -rf "$TMP"; }
trap cleanup EXIT

# ---------- system node detection ----------
SYS_NODE="$(command -v node || true)"
SYS_NODE_VER=""
if [ -n "$SYS_NODE" ]; then
  SYS_NODE_VER="$("$SYS_NODE" -v 2>/dev/null || true)"
  case "$SYS_NODE_VER" in
    v[0-9]*) ;;
    *) SYS_NODE=""; SYS_NODE_VER="" ;;
  esac
fi

POOL_NODE_OK=""
if [ -x "$NODE_BIN" ]; then
  if "$NODE_BIN" -v >/dev/null 2>&1; then POOL_NODE_OK=1; fi
fi

NODE_SRC=""
EFFECTIVE_NODE=""
if [ -n "$POOL_NODE_OK" ]; then
  NODE_SRC="pool"; EFFECTIVE_NODE="$NODE_BIN"
elif [ -n "$SYS_NODE" ] && [ -z "$FORCE_PORTABLE" ]; then
  NODE_SRC="system"; EFFECTIVE_NODE="$SYS_NODE"
else
  NODE_SRC="download"
fi
node_line="[node] source: $NODE_SRC"
[ -n "$EFFECTIVE_NODE" ] && node_line="$node_line -> $EFFECTIVE_NODE"
[ -n "$SYS_NODE_VER" ] && node_line="$node_line; system node $SYS_NODE_VER"
echo "$node_line"

# ---------- http helper (no -f: error bodies are triage gold) ----------
HTTP_CODE=""; HTTP_MS=""; CURL_EXIT=0
http_get() {  # url outfile [max-time]
  local url="$1" out="$2" mt="${3:-}" w
  local -a args
  args=("${CURL_ARGS[@]}" -sS -L --connect-timeout 20)
  [ -n "$mt" ] && args+=(--max-time "$mt")
  set +e
  w="$(curl "${args[@]}" -H 'Cache-Control: no-cache' -w '%{http_code} %{time_total}' -o "$out" "$url" 2>"$TMP/curl.err")"
  CURL_EXIT=$?
  set -e
  HTTP_CODE="${w%% *}"; HTTP_MS="${w##* }"
  [ -s "$TMP/curl.err" ] && echo "[curl] $(tr -d '\r' < "$TMP/curl.err" | tr '\n' ' ')" >&2
  echo "[http] $url -> code=$HTTP_CODE exit=$CURL_EXIT time=${HTTP_MS}s" >&2
  case "$HTTP_CODE" in 2*) [ "$CURL_EXIT" = "0" ] && return 0 ;; esac
  return 1
}

dump_body() {  # file label — error bodies go to the log (64KB cap, binary-safe)
  local f="$1" sz
  [ -f "$f" ] || return 0
  sz="$(wc -c < "$f" | tr -d ' ')"
  if [ "$sz" = "0" ]; then echo "[body] $2: empty" >&2; return 0; fi
  if [ "$sz" -gt 65536 ]; then echo "[body] $2: $sz bytes, too large to log" >&2; return 0; fi
  echo "[body] $2 ($sz bytes), first 2KB:" >&2
  head -c 2048 "$f" | LC_ALL=C tr -d '\000' >&2
  echo "" >&2
}

body_preview() {
  [ -f "$1" ] || return 0
  head -c 200 "$1" | LC_ALL=C tr -d '\000' | tr '\r\n\t' '   ' | sed 's/  */ /g'
}

# ---------- python3: only the download path needs it (manifest is JSON) ----------
PY=""
# `command -v python3` alone is not enough: the Windows Store python3 shim
# exists on PATH but prints "Python was not found" and exits non-zero.
require_py() {
  if [ -z "$PY" ]; then
    for cand in python3 python; do
      if command -v "$cand" >/dev/null 2>&1 && "$cand" -c "import json" >/dev/null 2>&1; then PY="$(command -v "$cand")"; break; fi
    done
  fi
  [ -n "$PY" ] || fail NO_PYTHON "python3 not found, cannot parse manifest.json" "" "install Xcode Command Line Tools: xcode-select --install; or use any machine that already has node (the system-node path never pulls the manifest)"
}

# ---------- --check: probe manifest + every platform's asset, no download ----------
check_mode() {
  require_py
  echo "CHECK_MODE: probe-only"
  echo "PLATFORM_HERE: $PLATFORM_KEY"
  echo "MANIFEST_URL: $MANIFEST"
  local mjson="$TMP/manifest.json" sep
  case "$MANIFEST" in *\?*) SEP="&" ;; *) SEP="?" ;; esac
  if ! http_get "$MANIFEST${SEP}t=$(date +%s)" "$mjson" 60; then
    dump_body "$mjson" "manifest error response"
    fail MANIFEST_UNREACHABLE "cannot fetch manifest (HTTP $HTTP_CODE / curl exit $CURL_EXIT)" \
      "$(body_preview "$mjson")" \
      "response body is in the LOG. if this machine needs a proxy to reach the intranet, add --proxy=<addr> and re-run --check"
  fi
  echo "MANIFEST_HTTP: $HTTP_CODE"
  "$PY" -c "import json,sys;json.load(open(sys.argv[1]))" "$mjson" 2>/dev/null \
    || { dump_body "$mjson" "manifest body"; fail MANIFEST_NOT_JSON "manifest is not JSON (proxy/gateway error page?)" "$(body_preview "$mjson")" ""; }

  local BASE; BASE="$(dirname "$MANIFEST")"
  local bad=0 total=0 key file
  # python on Windows prints CRLF; a trailing CR corrupts the URL (curl exit 3).
  # Strip CRs before the loop rather than inside read: the CR lands on the
  # final line where `${var%\r}` in-loop ordering proved unreliable (MSYS).
  while IFS=$'\t' read -r key file; do
    [ -n "$key" ] || continue
    total=$((total + 1))
    local url="$BASE/$file" w ec hcode g gec
    set +e
    w="$(curl "${CURL_ARGS[@]}" -sS -I -L --connect-timeout 20 --max-time 60 -o /dev/null -w '%{http_code}' "$url" 2>/dev/null)"
    ec=$?
    set -e
    hcode="$w"; [ "$ec" != "0" ] && hcode="$w(curl exit=$ec)"
    set +e
    g="$(curl "${CURL_ARGS[@]}" -sS -L --connect-timeout 20 --max-time 60 -r 0-0 --max-filesize 1048576 -o "$TMP/probe.bin" -w '%{http_code}' "$url" 2>/dev/null)"
    gec=$?
    set -e
    [ "$gec" = "63" ] && g="$g(no full download; server ignores Range)"
    echo "ASSET_$(echo "$key" | tr 'a-z-' 'A-Z_'): HEAD=$hcode GET=$g"
    case "$g" in 200|206) ;; *) dump_body "$TMP/probe.bin" "$key GET error"; bad=$((bad + 1)) ;; esac
  done < <("$PY" - "$mjson" <<'PYEOF' | tr -d '\r'
import json, sys
m = json.load(open(sys.argv[1]))
for k, v in (m.get("node", {}).get("platforms", {}) or {}).items():
    print("%s\t%s" % (k, v.get("file", "")))
PYEOF
)
  echo "CHECKED_PLATFORMS: $total"
  [ "$total" = "0" ] && fail NO_PLATFORM_PKG "manifest node.platforms is empty" "" "fix the manifest on the hosting server"
  [ "$bad" != "0" ] && fail ASSET_UNREACHABLE "$bad/$total platform packages unreachable (see ASSET_* lines above)" "" "confirm hosting/nginx/WAF with the platform team"
  echo "RESULT: OK"
  echo "NOTE: probe-only (HEAD + 1-byte Range GET); full integrity is still enforced by sha256 at install time"
  exit 0
}
[ -n "$CHECK" ] && check_mode

# ---------- download node via manifest ----------
if [ "$NODE_SRC" = "download" ]; then
  require_py
  MJSON="$TMP/manifest.json"
  case "$MANIFEST" in *\?*) SEP="&" ;; *) SEP="?" ;; esac
  echo "[manifest] $MANIFEST"
  if ! http_get "$MANIFEST${SEP}t=$(date +%s)" "$MJSON" 60; then
    dump_body "$MJSON" "manifest error response"
    fail MANIFEST_UNREACHABLE "cannot fetch manifest: $MANIFEST (HTTP $HTTP_CODE / curl exit $CURL_EXIT)" \
      "$(body_preview "$MJSON")" \
      "response body is in the LOG. run --check first to see per-platform status; if this machine needs a proxy, pass --proxy=<addr>. note: reaching the download step means NO usable node was found (see the [node] source line) — installing any node by any means skips this whole path"
  fi
  "$PY" -c "import json,sys;json.load(open(sys.argv[1]))" "$MJSON" 2>/dev/null \
    || { dump_body "$MJSON" "manifest body"; fail MANIFEST_NOT_JSON "manifest is not JSON (proxy/gateway/SSO error page?)" "$(body_preview "$MJSON")" ""; }

  BASE="$(dirname "$MANIFEST")"
  # read file / sha256 / stripComponents for this platform
  read -r FILE WANT STRIP NODEVER < <("$PY" - "$MJSON" "$PLATFORM_KEY" <<'PYEOF' | tr -d '\r'
import json, sys
m = json.load(open(sys.argv[1])); p = m.get("node", {}).get("platforms", {}).get(sys.argv[2])
if not p: print("__MISSING__ __MISSING__ 1 __MISSING__"); sys.exit(0)
print(p.get("file", ""), p.get("sha256", ""), p.get("stripComponents", 1), m.get("node", {}).get("version", ""))
PYEOF
)
  # heredoc command-substitution failures do NOT trigger ERR trap or set -e; check explicitly
  [ -n "${FILE:-}" ] || fail MANIFEST_PARSE_FAILED "cannot parse manifest for $PLATFORM_KEY" "" "confirm $MJSON is valid JSON with node.platforms.$PLATFORM_KEY"
  [ "$FILE" = "__MISSING__" ] && fail NO_PLATFORM_PKG "manifest has no node package for $PLATFORM_KEY" "" "add node.platforms.$PLATFORM_KEY to the manifest"

  PKG_FILE="$(basename "$FILE")"
  URL="$BASE/$FILE"
  echo "[download] $URL"
  if ! http_get "$URL" "$TMP/$PKG_FILE" 600; then
    dump_body "$TMP/$PKG_FILE" "node package error response"
    fail DOWNLOAD_FAILED "cannot download $URL (HTTP $HTTP_CODE / curl exit $CURL_EXIT)" \
      "$(body_preview "$TMP/$PKG_FILE")" \
      "check network/proxy; retry; or install node manually from https://nodejs.org then re-run (any version works)"
  fi

  # sha256 verify against the manifest's embedded hash
  [ -n "$WANT" ] && [ "$WANT" != "__MISSING__" ] \
    || fail SHA256_UNKNOWN "manifest entry has no sha256 for $PKG_FILE" "" "fix the manifest on the hosting server"
  GOT="$(shasum -a 256 "$TMP/$PKG_FILE" | awk '{print $1}')"
  if [ "$GOT" != "$WANT" ]; then
    fail SHA256_MISMATCH "node tarball checksum mismatch (truncated or tampered)" "expected=$WANT actual=$GOT size=$(wc -c < "$TMP/$PKG_FILE" | tr -d ' ')" "retry download; if it persists the hosted copy may be broken"
  fi

  mkdir -p "$NODE_DIR"
  tar -xzf "$TMP/$PKG_FILE" -C "$NODE_DIR" --strip-components="${STRIP:-1}"
  if [ ! -x "$NODE_BIN" ]; then
    fail EXTRACT_FAILED "extracted but node binary not found at $NODE_BIN" "tar exit ok? report to skill maintainer"
  fi
  echo "[node] $("$NODE_BIN" -v) -> $NODE_DIR"
  EFFECTIVE_NODE="$NODE_BIN"
fi

# ---------- registry from manifest (download path only; --registry wins) ----------
if [ -z "$REGISTRY" ] && [ -n "${MJSON:-}" ]; then
  REGISTRY="$("$PY" -c "import json,sys;print(json.load(open(sys.argv[1])).get('npmRegistry',''))" "$MJSON" 2>/dev/null || true)"
fi

# ---------- handoff to setup-env.mjs (npm-only dep install) ----------
[ -n "$EFFECTIVE_NODE" ] || fail NODE_MISSING "no usable node resolved (internal state)" ""
ARGV=("$SKILL_DIR/scripts/setup-env.mjs" "--env-dir=$ENV_DIR")
[ -n "$REGISTRY" ] && ARGV+=("--registry=$REGISTRY")
echo "[handoff] $EFFECTIVE_NODE ${ARGV[*]}"
exec "$EFFECTIVE_NODE" "${ARGV[@]}"

#!/usr/bin/env bash
# Optional Linux integration check. All services run in a private display,
# temporary configuration and database; the user's desktop is not modified.
set -eu
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
export TYPING_IME_REPO_ROOT="$task_root"
exec dbus-run-session -- bash -s <<'SESSION'
set -eu
task_root=$TYPING_IME_REPO_ROOT
task_xvfb=${TYPING_XVFB_BINARY:-$(command -v Xvfb || true)}
if [ -z "$task_xvfb" ] || [ ! -x "$task_xvfb" ]; then
  printf '%s\n' 'Xvfb is required (or set TYPING_XVFB_BINARY).'
  exit 1
fi
for task_command in fcitx5 fcitx5-remote xwininfo xdpyinfo python3 curl node rg; do
  if ! command -v "$task_command" >/dev/null 2>&1; then printf 'Missing command: %s\n' "$task_command"; exit 1; fi
done
task_dir=$(mktemp -d "${TMPDIR:-/tmp}/typing-system-ime.XXXXXXXX")
task_xvfb_pid= task_fcitx_pid= task_server_pid=
cleanup() {
  task_status=$?
  if [ "$task_status" -ne 0 ]; then
    for task_log in xvfb fcitx server; do if [ -f "$task_dir/$task_log.log" ]; then tail -30 "$task_dir/$task_log.log" >&2; fi; done
  fi
  for task_pid in "$task_server_pid" "$task_fcitx_pid" "$task_xvfb_pid"; do if [ -n "$task_pid" ]; then kill "$task_pid" 2>/dev/null || true; fi; done
  wait 2>/dev/null || true
  rm -rf -- "$task_dir"
}
trap cleanup EXIT
mkdir -p "$task_dir/config/fcitx5" "$task_dir/data" "$task_dir/cache"
cat > "$task_dir/config/fcitx5/profile" <<'PROFILE'
[Groups/0]
Name=Default
Default Layout=us
DefaultIM=pinyin

[Groups/0/Items/0]
Name=keyboard-us
Layout=

[Groups/0/Items/1]
Name=pinyin
Layout=

[GroupOrder]
0=Default
PROFILE
export XDG_CONFIG_HOME="$task_dir/config" XDG_DATA_HOME="$task_dir/data" XDG_CACHE_HOME="$task_dir/cache"
export XMODIFIERS=@im=fcitx GTK_IM_MODULE=fcitx QT_IM_MODULE=fcitx
unset WAYLAND_DISPLAY || true
mkfifo "$task_dir/display"
"$task_xvfb" -displayfd 3 -screen 0 1280x900x24 -nolisten tcp 3>"$task_dir/display" >"$task_dir/xvfb.log" 2>&1 &
task_xvfb_pid=$!
if ! IFS= read -r -t 10 task_number <"$task_dir/display"; then printf '%s\n' 'Cannot allocate a private X display.' >&2; exit 1; fi
export DISPLAY=:$task_number
for task_step in $(seq 1 50); do if xdpyinfo >/dev/null 2>&1; then break; fi; sleep .1; done
xdpyinfo >/dev/null
fcitx5 -D >"$task_dir/fcitx.log" 2>&1 &
task_fcitx_pid=$!
for task_step in $(seq 1 50); do if fcitx5-remote --check >/dev/null 2>&1; then break; fi; sleep .1; done
fcitx5-remote --check >/dev/null
cd "$task_root"
E2E_PORT=0 NODE_ENV=test TYPING_IME_DISCOVER_PORT=1 node --import tsx e2e/server.ts >"$task_dir/server.log" 2>&1 &
task_server_pid=$!
task_address=
for task_step in $(seq 1 100); do
  task_address=$(rg '^TYPING_TEST_URL=' "$task_dir/server.log" || true)
  if [ -n "$task_address" ]; then break; fi
  if ! kill -0 "$task_server_pid" 2>/dev/null; then break; fi
  sleep .1
done
if [ -z "$task_address" ]; then printf '%s\n' 'Cannot start the isolated test service.' >&2; exit 1; fi
export TYPING_IME_URL=${task_address#TYPING_TEST_URL=}
curl -fsS "$TYPING_IME_URL/api/health" >/dev/null
node scripts/verify-system-ime.mjs
SESSION

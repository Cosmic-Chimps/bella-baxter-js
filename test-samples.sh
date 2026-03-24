#!/usr/bin/env bash
# test-samples.sh — Run and validate all Bella Baxter JS SDK samples.
#
# Usage:  ./test-samples.sh <api-key>
#         ./test-samples.sh bax-myKeyId-mySecret

set -uo pipefail

# ─── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SAMPLES_DIR="$SCRIPT_DIR/samples"
DEMO_ENV_FILE="$SCRIPT_DIR/../../../demo.env"

# ─── Arguments ─────────────────────────────────────────────────────────────
BELLA_API_KEY="${1:-}"
if [[ -z "$BELLA_API_KEY" ]]; then
  echo "Usage: $0 <api-key>   e.g. $0 bax-myKeyId-mySecret"
  exit 1
fi
if [[ ! -f "$DEMO_ENV_FILE" ]]; then
  echo "demo.env not found: $DEMO_ENV_FILE"
  exit 1
fi

# ─── Config ────────────────────────────────────────────────────────────────
export BELLA_BAXTER_URL="http://localhost:5522"
SERVER_PORT=3005
SERVER_STARTUP_TIMEOUT=30

# ─── Expected values from demo.env ─────────────────────────────────────────
get_env() { grep -m1 "^${1}=" "$DEMO_ENV_FILE" | cut -d'=' -f2-; }

EXP_PORT="$(get_env PORT)"
EXP_DB_URL="$(get_env DATABASE_URL)"
EXP_API_KEY="$(get_env EXTERNAL_API_KEY)"
EXP_GLEAP_KEY="$(get_env GLEAP_API_KEY)"
EXP_ENABLE_FEATURES="$(get_env ENABLE_FEATURES)"
EXP_APP_ID="$(get_env APP_ID)"
EXP_CONN_STRING="$(get_env ConnectionStrings__Postgres)"

API_KEY_PREFIX="${EXP_API_KEY:0:4}"
GLEAP_KEY_PREFIX="${EXP_GLEAP_KEY:0:4}"
DB_URL_15="${EXP_DB_URL:0:15}"
CONN_PREFIX="${EXP_CONN_STRING:0:6}"

# ─── Tracking ──────────────────────────────────────────────────────────────
PASS=0
FAIL=0
RESULTS=()

pass() {
  printf "  \xE2\x9C\x85 %s\n" "$1"
  RESULTS=("${RESULTS[@]+"${RESULTS[@]}"}" "PASS: $1")
  PASS=$((PASS + 1))
}
fail() {
  printf "  \xE2\x9D\x8C %s -- %s\n" "$1" "$2"
  RESULTS=("${RESULTS[@]+"${RESULTS[@]}"}" "FAIL: $1 -- $2")
  FAIL=$((FAIL + 1))
}
section() { printf "\n--- %s ---\n" "$1"; }

check() {
  local name="$1" output="$2" pattern="$3"
  if printf '%s' "$output" | grep -qF "$pattern"; then
    pass "$name"
  else
    fail "$name" "expected '$pattern'"
  fi
}

# ─── Server helpers ─────────────────────────────────────────────────────────
cleanup_port() {
  local port="${1:-$SERVER_PORT}"
  local pids
  pids="$(lsof -ti :"$port" 2>/dev/null)" || true
  if [[ -n "$pids" ]]; then
    while IFS= read -r pid; do
      kill "$pid" 2>/dev/null || true
    done <<< "$pids"
    sleep 1
  fi
}

wait_for_server() {
  local port="$1" timeout="$2" elapsed=0
  until curl -s -o /dev/null "http://localhost:${port}/health" 2>/dev/null || \
        curl -s -o /dev/null "http://localhost:${port}/" 2>/dev/null; do
    sleep 1
    elapsed=$((elapsed + 1))
    if [ "$elapsed" -ge "$timeout" ]; then return 1; fi
  done
  return 0
}

SERVER_PID=""
stop_server() {
  if [[ -n "$SERVER_PID" ]]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
  fi
  cleanup_port
}

check_server_secrets() {
  local name="$1" response="$2"
  check "$name PORT"                        "$response" "\"PORT\":\"$EXP_PORT\""
  check "$name DATABASE_URL"                "$response" "\"DATABASE_URL\":\"${DB_URL_15}"
  check "$name EXTERNAL_API_KEY"            "$response" "\"EXTERNAL_API_KEY\":\"${API_KEY_PREFIX}"
  check "$name GLEAP_API_KEY"               "$response" "\"GLEAP_API_KEY\":\"${GLEAP_KEY_PREFIX}"
  check "$name ENABLE_FEATURES"             "$response" "\"ENABLE_FEATURES\":\"$EXP_ENABLE_FEATURES\""
  check "$name APP_ID"                      "$response" "\"APP_ID\":\"$EXP_APP_ID\""
  check "$name ConnectionStrings__Postgres" "$response" "\"ConnectionStrings__Postgres\":\"${CONN_PREFIX}"
  check "$name APP_CONFIG"                  "$response" "\"APP_CONFIG\":"
}

check_cli_secrets() {
  local name="$1" output="$2"
  check "$name PORT"                        "$output" ": $EXP_PORT"
  check "$name DATABASE_URL"               "$output" "$EXP_DB_URL"
  check "$name EXTERNAL_API_KEY"           "$output" "$API_KEY_PREFIX"
  check "$name GLEAP_API_KEY"              "$output" "$GLEAP_KEY_PREFIX"
  check "$name ENABLE_FEATURES"            "$output" "$EXP_ENABLE_FEATURES"
  check "$name APP_ID"                     "$output" "$EXP_APP_ID"
  check "$name ConnectionStrings__Postgres" "$output" "${CONN_PREFIX}"
  check "$name APP_CONFIG"                 "$output" "APP_CONFIG"
}

# ─── Login ──────────────────────────────────────────────────────────────────
section "Authentication"
echo "  Logging in with API key: ${BELLA_API_KEY:0:12}..."
bella login --api-key "$BELLA_API_KEY" > /dev/null 2>&1
echo "  login complete (URL: $BELLA_BAXTER_URL)"

# ─── 01: dotenv-file ────────────────────────────────────────────────────────
section "01 -- dotenv-file (bella secrets get -> .env -> node app.js)"
pushd "$SAMPLES_DIR/01-dotenv-file" > /dev/null
bella secrets get --app js-01-dotenv-file -o .env > /dev/null 2>&1
OUTPUT="$(node app.js 2>&1)"
echo "$OUTPUT"
echo "  --- Validation ---"
check_cli_secrets "01" "$OUTPUT"
rm -f .env
popd > /dev/null

# ─── 02: process-inject ─────────────────────────────────────────────────────
section "02 -- process-inject (bella run -- node app.js)"
pushd "$SAMPLES_DIR/02-process-inject" > /dev/null
OUTPUT="$(bella run --app js-02-process-inject -- node app.js 2>&1)"
echo "$OUTPUT"
echo "  --- Validation ---"
check_cli_secrets "02" "$OUTPUT"
popd > /dev/null

# ─── 03: express ────────────────────────────────────────────────────────────
section "03 -- express (bella exec -- node server.js)"
cleanup_port
pushd "$SAMPLES_DIR/03-express" > /dev/null
bella exec --app js-03-express -- node server.js &
SERVER_PID=$!
echo "  Started PID $SERVER_PID -- waiting for server on :$SERVER_PORT..."
if wait_for_server "$SERVER_PORT" "$SERVER_STARTUP_TIMEOUT"; then
  HEALTH="$(curl -sf "http://localhost:${SERVER_PORT}/health" 2>&1)" || HEALTH=""
  echo "  /health -> $HEALTH"
  check "03 /health" "$HEALTH" '"ok":true'
  RESPONSE="$(curl -sf "http://localhost:${SERVER_PORT}/" 2>&1)" || RESPONSE=""
  echo "  / -> $RESPONSE"
  check_server_secrets "03 /" "$RESPONSE"
else
  fail "03-express" "server did not start within ${SERVER_STARTUP_TIMEOUT}s"
fi
stop_server
popd > /dev/null

# ─── 04: nestjs ─────────────────────────────────────────────────────────────
section "04 -- nestjs (bella exec -- node --loader ts-node/esm src/main.ts)"
cleanup_port
pushd "$SAMPLES_DIR/04-nestjs" > /dev/null
bella exec --app js-04-nestjs -- node --loader ts-node/esm src/main.ts &
SERVER_PID=$!
echo "  Started PID $SERVER_PID -- waiting for server on :$SERVER_PORT..."
if wait_for_server "$SERVER_PORT" "$SERVER_STARTUP_TIMEOUT"; then
  HEALTH="$(curl -sf "http://localhost:${SERVER_PORT}/health" 2>&1)" || HEALTH=""
  echo "  /health -> $HEALTH"
  check "04 /health" "$HEALTH" '"ok":true'
  RESPONSE="$(curl -sf "http://localhost:${SERVER_PORT}/" 2>&1)" || RESPONSE=""
  echo "  / -> $RESPONSE"
  check_server_secrets "04 /" "$RESPONSE"
else
  fail "04-nestjs" "server did not start within ${SERVER_STARTUP_TIMEOUT}s"
fi
stop_server
popd > /dev/null

# ─── 05: nextjs ─────────────────────────────────────────────────────────────
section "05 -- nextjs (bella exec -- npx next dev -p $SERVER_PORT)"
cleanup_port
pushd "$SAMPLES_DIR/05-nextjs" > /dev/null
bella exec --app js-05-nextjs -- npx next dev -p "$SERVER_PORT" &
SERVER_PID=$!
echo "  Started PID $SERVER_PID -- waiting for Next.js on :$SERVER_PORT (up to 60s)..."
if wait_for_server "$SERVER_PORT" 60; then
  HEALTH="$(curl -sf "http://localhost:${SERVER_PORT}/api/health" 2>&1)" || HEALTH=""
  echo "  /api/health -> $HEALTH"
  check "05 /api/health" "$HEALTH" '"ok":true'
  RESPONSE="$(curl -sf "http://localhost:${SERVER_PORT}/api/secrets" 2>&1)" || RESPONSE=""
  echo "  /api/secrets -> $RESPONSE"
  check_server_secrets "05 /api/secrets" "$RESPONSE"
else
  fail "05-nextjs" "server did not start within 60s"
fi
stop_server
popd > /dev/null

# ─── 06: fastify ────────────────────────────────────────────────────────────
section "06 -- fastify (bella exec -- node --loader ts-node/esm server.ts)"
cleanup_port
pushd "$SAMPLES_DIR/06-fastify" > /dev/null
bella exec --app js-06-fastify -- node --loader ts-node/esm server.ts &
SERVER_PID=$!
echo "  Started PID $SERVER_PID -- waiting for server on :$SERVER_PORT..."
if wait_for_server "$SERVER_PORT" "$SERVER_STARTUP_TIMEOUT"; then
  HEALTH="$(curl -sf "http://localhost:${SERVER_PORT}/health" 2>&1)" || HEALTH=""
  echo "  /health -> $HEALTH"
  check "06 /health" "$HEALTH" '"ok":true'
  RESPONSE="$(curl -sf "http://localhost:${SERVER_PORT}/" 2>&1)" || RESPONSE=""
  echo "  / -> $RESPONSE"
  check_server_secrets "06 /" "$RESPONSE"
else
  fail "06-fastify" "server did not start within ${SERVER_STARTUP_TIMEOUT}s"
fi
stop_server
popd > /dev/null

# ─── 07: adonisjs ───────────────────────────────────────────────────────────
section "07 -- adonisjs (bella exec -- node ace serve)"
cleanup_port
pushd "$SAMPLES_DIR/07-adonisjs" > /dev/null
bella exec --app js-07-adonisjs -- node ace serve < /dev/null &
SERVER_PID=$!
echo "  Started PID $SERVER_PID -- waiting for server on :$SERVER_PORT..."
if wait_for_server "$SERVER_PORT" "$SERVER_STARTUP_TIMEOUT"; then
  HEALTH="$(curl -sf "http://localhost:${SERVER_PORT}/health" 2>&1)" || HEALTH=""
  echo "  /health -> $HEALTH"
  check "07 /health" "$HEALTH" '"ok"'
  RESPONSE="$(curl -sf "http://localhost:${SERVER_PORT}/" 2>&1)" || RESPONSE=""
  echo "  / -> $RESPONSE"
  check_server_secrets "07 /" "$RESPONSE"
else
  fail "07-adonisjs" "server did not start within ${SERVER_STARTUP_TIMEOUT}s"
fi
stop_server
popd > /dev/null

# ─── Summary ────────────────────────────────────────────────────────────────
printf "\n=== Results ===\n"
if [[ ${#RESULTS[@]} -gt 0 ]]; then
  for r in "${RESULTS[@]}"; do printf "  %s\n" "$r"; done
fi
printf "\n  Passed: %d   Failed: %d\n\n" "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then exit 1; fi

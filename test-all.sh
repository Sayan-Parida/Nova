#!/usr/bin/env bash

BASE_URL="${BASE_URL:-http://localhost:8081}"
BACKEND_DIR="backend"
BACKEND_LOG="./backend-test.log"
WAIT_SECONDS=15

PASS_COUNT=0
FAIL_COUNT=0
BACKEND_PID=""

print_result() {
  local name="$1"
  local expected="$2"
  local actual="$3"

  if [ "$actual" = "$expected" ]; then
    echo "PASS: ${name} (expected ${expected}, got ${actual})"
    PASS_COUNT=$((PASS_COUNT + 1))
  else
    echo "FAIL: ${name} (expected ${expected}, got ${actual})"
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
}

cleanup() {
  if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    echo "Stopping backend (PID ${BACKEND_PID})..."
    kill "$BACKEND_PID" >/dev/null 2>&1 || true
    wait "$BACKEND_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "Starting backend in background..."
(
  cd "$BACKEND_DIR" && ./mvnw spring-boot:run
) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!

echo "Backend PID: ${BACKEND_PID}"
echo "Waiting ${WAIT_SECONDS} seconds for backend to boot..."
sleep "$WAIT_SECONDS"

TEST_EMAIL="test-all-$(date +%s)@nova.app"
TEST_PASSWORD="StrongPass123"
WRONG_PASSWORD="WrongPass999"
ENCRYPTED_DATA="ZW5jcnlwdGVkLWN5Y2xl"
TODAY_DATE="$(date -u +%Y-%m-%d)"
TIMEZONE_OFFSET="+00:00"
TOKEN=""

run_request() {
  local method="$1"
  local path="$2"
  local body="$3"
  local auth_header="$4"
  local timezone_header="$5"
  local response_file

  response_file="$(mktemp)"

  if [ -n "$auth_header" ] && [ -n "$timezone_header" ]; then
    HTTP_CODE=$(curl -s -o "$response_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${auth_header}" \
      -H "X-Timezone-Offset: ${timezone_header}" \
      -d "$body")
  elif [ -n "$auth_header" ]; then
    HTTP_CODE=$(curl -s -o "$response_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${auth_header}" \
      -d "$body")
  elif [ -n "$body" ]; then
    HTTP_CODE=$(curl -s -o "$response_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}" \
      -H "Content-Type: application/json" \
      -d "$body")
  else
    HTTP_CODE=$(curl -s -o "$response_file" -w "%{http_code}" -X "$method" "${BASE_URL}${path}")
  fi

  RESPONSE_BODY="$(cat "$response_file")"
  rm -f "$response_file"
}

# 1) GET /api/health -> 200
run_request "GET" "/api/health" "" "" ""
print_result "GET /api/health" "200" "$HTTP_CODE"

# 2) POST /api/auth/register with test email -> 201
REGISTER_BODY="{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\",\"timezone\":\"UTC\"}"
run_request "POST" "/api/auth/register" "$REGISTER_BODY" "" ""
print_result "POST /api/auth/register (new user)" "201" "$HTTP_CODE"

# 3) POST /api/auth/register same email again -> 409
run_request "POST" "/api/auth/register" "$REGISTER_BODY" "" ""
print_result "POST /api/auth/register (duplicate user)" "409" "$HTTP_CODE"

# 4) POST /api/auth/login with wrong password -> 401
WRONG_LOGIN_BODY="{\"email\":\"${TEST_EMAIL}\",\"password\":\"${WRONG_PASSWORD}\"}"
run_request "POST" "/api/auth/login" "$WRONG_LOGIN_BODY" "" ""
print_result "POST /api/auth/login (wrong password)" "401" "$HTTP_CODE"

# 5) POST /api/auth/login with correct password -> 200, save token
GOOD_LOGIN_BODY="{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASSWORD}\"}"
run_request "POST" "/api/auth/login" "$GOOD_LOGIN_BODY" "" ""
print_result "POST /api/auth/login (correct password)" "200" "$HTTP_CODE"

TOKEN="$(printf "%s" "$RESPONSE_BODY" | sed -n 's/.*"accessToken"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
if [ -z "$TOKEN" ]; then
  TOKEN="$(printf "%s" "$RESPONSE_BODY" | sed -n 's/.*"token"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
fi

if [ -n "$TOKEN" ]; then
  echo "PASS: token extracted from login response"
  PASS_COUNT=$((PASS_COUNT + 1))
else
  echo "FAIL: could not extract token from login response"
  FAIL_COUNT=$((FAIL_COUNT + 1))
fi

# 6) POST /api/cycles with token -> 201
CYCLE_BODY="{\"encryptedData\":\"${ENCRYPTED_DATA}\",\"dataType\":\"CYCLE\",\"logDate\":\"${TODAY_DATE}\"}"
run_request "POST" "/api/cycles" "$CYCLE_BODY" "$TOKEN" "$TIMEZONE_OFFSET"
print_result "POST /api/cycles (with token)" "201" "$HTTP_CODE"

# 7) POST /api/cycles without token -> 403
run_request "POST" "/api/cycles" "$CYCLE_BODY" "" ""
print_result "POST /api/cycles (without token)" "403" "$HTTP_CODE"

echo ""
echo "Test Summary: ${PASS_COUNT} passed, ${FAIL_COUNT} failed"
if [ "$FAIL_COUNT" -eq 0 ]; then
  echo "OVERALL: PASSED"
  exit 0
else
  echo "OVERALL: FAILED"
  exit 1
fi

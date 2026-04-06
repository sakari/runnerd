#!/usr/bin/env bash
# Generates a GitHub App installation token.
# Reads GITHUB_APP_CLIENT_ID and GITHUB_APP_PRIVATE_KEY from environment.
# Caches the token to /tmp/.gh_app_token for 50 minutes.

set -euo pipefail

TOKEN_FILE="/tmp/.gh_app_token"

# Return cached token if less than 50 minutes old
if [ -f "$TOKEN_FILE" ] && [ -z "$(find "$TOKEN_FILE" -mmin +50 2>/dev/null)" ]; then
  cat "$TOKEN_FILE"
  exit 0
fi

if [ -z "${GITHUB_APP_CLIENT_ID:-}" ] || [ -z "${GITHUB_APP_PRIVATE_KEY:-}" ]; then
  echo "Error: GITHUB_APP_CLIENT_ID and GITHUB_APP_PRIVATE_KEY must be set" >&2
  exit 1
fi

# --- Generate JWT ---
b64enc() { openssl base64 | tr -d '=' | tr '/+' '_-' | tr -d '\n'; }

now=$(date +%s)
iat=$((now - 60))
exp=$((now + 600))

header=$(echo -n '{"typ":"JWT","alg":"RS256"}' | b64enc)
payload=$(echo -n "{\"iat\":${iat},\"exp\":${exp},\"iss\":\"${GITHUB_APP_CLIENT_ID}\"}" | b64enc)

header_payload="${header}.${payload}"
signature=$(
  openssl dgst -sha256 -sign <(echo -n "${GITHUB_APP_PRIVATE_KEY}") \
    <(echo -n "${header_payload}") | b64enc
)

JWT="${header_payload}.${signature}"

# --- Exchange JWT for installation token ---
APP_TOKEN_URL=$(
  curl -sf \
    -H "Authorization: Bearer ${JWT}" \
    -H "Accept: application/vnd.github.v3+json" \
    https://api.github.com/app/installations | jq -r '.[0].access_tokens_url'
)

TOKEN=$(
  curl -sf -X POST \
    -H "Authorization: Bearer ${JWT}" \
    -H "Accept: application/vnd.github.v3+json" \
    "${APP_TOKEN_URL}" | jq -r '.token'
)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "Error: Failed to generate installation token" >&2
  exit 1
fi

echo -n "$TOKEN" > "$TOKEN_FILE"
echo "$TOKEN"

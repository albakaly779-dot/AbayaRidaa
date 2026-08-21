#!/usr/bin/env bash
set -euo pipefail

# This script never echoes secret values. Run it from a trusted terminal.
: "${SUPABASE_PROJECT_REF:?Set SUPABASE_PROJECT_REF first}"
: "${AUDIT_HMAC_KEY_B64:?Set AUDIT_HMAC_KEY_B64 first}"
: "${SMTP_PASSWORD:?Set SMTP_PASSWORD first}"
AUDIT_HMAC_KEY_ID="${AUDIT_HMAC_KEY_ID:-v1}"

if command -v supabase >/dev/null 2>&1; then
  SUPABASE_CLI=(supabase)
elif command -v npx >/dev/null 2>&1; then
  SUPABASE_CLI=(npx --yes supabase)
else
  echo "Supabase CLI is required." >&2
  exit 1
fi

"${SUPABASE_CLI[@]}" link --project-ref "$SUPABASE_PROJECT_REF"
"${SUPABASE_CLI[@]}" secrets set \
  AUDIT_HMAC_KEY_B64="$AUDIT_HMAC_KEY_B64" \
  AUDIT_HMAC_KEY_ID="$AUDIT_HMAC_KEY_ID" \
  SMTP_PASSWORD="$SMTP_PASSWORD"

"${SUPABASE_CLI[@]}" db push

for function_name in audit-event send-email notify-admin invite-user; do
  "${SUPABASE_CLI[@]}" functions deploy "$function_name"
done

echo "Supabase migration, secrets, and Edge Functions were applied successfully."

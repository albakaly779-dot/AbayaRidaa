#!/usr/bin/env python3
"""Verify the append-only audit chain without printing the HMAC secret."""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import sys
from typing import Any

import requests


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def hmac_hex(secret: bytes, payload: Any) -> str:
    return hmac.new(secret, canonical_json(payload).encode("utf-8"), hashlib.sha256).hexdigest()


def main() -> int:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    hmac_key_b64 = os.environ.get("AUDIT_HMAC_KEY_B64", "")
    tenant_key = os.environ.get("AUDIT_TENANT_KEY", "default")
    table = os.environ.get("AUDIT_TABLE", "audit_events")

    if not url or not service_key or not hmac_key_b64:
        print("Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and AUDIT_HMAC_KEY_B64 in the local shell.", file=sys.stderr)
        return 2

    try:
        secret = base64.b64decode(hmac_key_b64, validate=True)
    except Exception:
        print("AUDIT_HMAC_KEY_B64 is not valid Base64.", file=sys.stderr)
        return 2

    endpoint = f"{url}/rest/v1/{table}"
    params = {
        "tenant_key": f"eq.{tenant_key}",
        "select": "sequence,entry_hash,previous_hash,canonical_payload,key_id",
        "order": "sequence.asc",
        "limit": "10000",
    }
    headers = {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Accept-Profile": "public",
    }
    response = requests.get(endpoint, params=params, headers=headers, timeout=30)
    if response.status_code >= 300:
        print(f"Supabase query failed with HTTP {response.status_code}: {response.text[:300]}", file=sys.stderr)
        return 1

    rows = response.json()
    previous = "GENESIS"
    checked = 0
    for row in rows:
        sequence = row.get("sequence")
        stored_previous = row.get("previous_hash")
        stored_entry = row.get("entry_hash")
        payload = row.get("canonical_payload")
        if not isinstance(payload, dict):
            print(f"FAIL sequence={sequence}: canonical_payload is missing or not an object")
            return 1
        if stored_previous != previous:
            print(f"FAIL sequence={sequence}: previous_hash does not match the preceding entry")
            return 1
        calculated = hmac_hex(secret, payload)
        if not hmac.compare_digest(calculated, str(stored_entry or "")):
            print(f"FAIL sequence={sequence}: HMAC mismatch")
            return 1
        if payload.get("previous_hash") != stored_previous:
            print(f"FAIL sequence={sequence}: payload previous_hash mismatch")
            return 1
        previous = str(stored_entry)
        checked += 1

    print(f"OK: verified {checked} audit events for tenant={tenant_key}; HMAC key was not printed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

import hashlib
import hmac
import unittest

from verify_audit_chain import canonical_json, hmac_hex


class AuditChainTests(unittest.TestCase):
    def setUp(self):
        self.secret = b"local-test-secret"

    def test_canonical_json_is_stable(self):
        first = canonical_json({"b": 2, "a": {"z": True, "y": None}})
        second = canonical_json({"a": {"y": None, "z": True}, "b": 2})
        self.assertEqual(first, second)

    def test_hmac_matches_standard_sha256(self):
        payload = {"action": "create", "previous_hash": "GENESIS"}
        expected = hmac.new(self.secret, canonical_json(payload).encode(), hashlib.sha256).hexdigest()
        self.assertEqual(hmac_hex(self.secret, payload), expected)

    def test_payload_change_breaks_hmac(self):
        payload = {"action": "create", "amount": 100, "previous_hash": "GENESIS"}
        entry_hash = hmac_hex(self.secret, payload)
        changed = {**payload, "amount": 101}
        self.assertFalse(hmac.compare_digest(entry_hash, hmac_hex(self.secret, changed)))

    def test_chain_link_must_use_previous_entry_hash(self):
        first = {"action": "create", "previous_hash": "GENESIS"}
        first_hash = hmac_hex(self.secret, first)
        second = {"action": "update", "previous_hash": first_hash}
        second_hash = hmac_hex(self.secret, second)
        self.assertEqual(second["previous_hash"], first_hash)
        self.assertNotEqual(second_hash, first_hash)


if __name__ == "__main__":
    unittest.main()

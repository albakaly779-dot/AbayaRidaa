import tempfile
import unittest
from pathlib import Path

from bot import OrderStore, format_summary, normalize_arabic_digits, normalize_phone, valid_phone


class BotHelpersTest(unittest.TestCase):
    def test_arabic_digits_are_normalized(self):
        self.assertEqual(normalize_arabic_digits("٠٧٨ ١٢٣"), "078 123")

    def test_phone_validation(self):
        self.assertEqual(normalize_phone("٠٧٨-١٢٣-٤٥٦٧"), "0781234567")
        self.assertTrue(valid_phone("0781234567"))
        self.assertTrue(valid_phone("+9647812345678"))
        self.assertFalse(valid_phone("abc"))

    def test_summary_contains_required_fields(self):
        summary = format_summary(
            {
                "name": "عميل تجريبي",
                "phone": "0781234567",
                "province": "بغداد",
                "location": "الكرادة",
                "model_number": "M-10",
                "sizes": "56",
            }
        )
        self.assertIn("عميل تجريبي", summary)
        self.assertIn("صورة الإيداع: مرفقة", summary)
        self.assertIn("صورة الموديل: مرفقة", summary)


class OrderStoreTest(unittest.TestCase):
    def test_draft_and_order_round_trip(self):
        with tempfile.TemporaryDirectory() as directory:
            store = OrderStore(Path(directory) / "orders.sqlite3")
            payload = {"name": "عميل", "phone": "0781234567"}
            store.save_draft("123", "phone", payload)
            self.assertEqual(store.get_draft("123"), ("phone", payload))
            order_id = store.create_order("123", payload)
            row = store.get_order(order_id)
            self.assertIsNotNone(row)
            self.assertEqual(row["order_id"], order_id)
            store.delete_draft("123")
            self.assertIsNone(store.get_draft("123"))
            store.close()


if __name__ == "__main__":
    unittest.main()

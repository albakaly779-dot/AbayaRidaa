"""Telegram order-confirmation bot for Ridaa abaya store.

The bot uses Telegram long polling so it can run on any always-on Python host.
Secrets are read from environment variables and never persisted in source code.
"""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
import sqlite3
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
ADMIN_CHAT_IDS = {
    value.strip()
    for value in os.getenv("ADMIN_CHAT_IDS", "").split(",")
    if value.strip()
}
DATA_DIR = Path(os.getenv("DATA_DIR", "./data")).expanduser()
if not DATA_DIR.is_absolute():
    DATA_DIR = (BASE_DIR / DATA_DIR).resolve()
UPLOADS_DIR = DATA_DIR / "uploads"
DB_PATH = DATA_DIR / "orders.sqlite3"
POLL_TIMEOUT = max(5, int(os.getenv("POLL_TIMEOUT", "30")))
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s | %(levelname)s | %(message)s",
)
logger = logging.getLogger("ridaa-bot")

PROVINCES = [
    "بغداد",
    "البصرة",
    "نينوى",
    "أربيل",
    "السليمانية",
    "دهوك",
    "الأنبار",
    "كركوك",
    "صلاح الدين",
    "ديالى",
    "بابل",
    "كربلاء",
    "النجف",
    "واسط",
    "القادسية",
    "المثنى",
    "ذي قار",
    "ميسان",
    "أخرى",
]

CANCEL_WORDS = {"إلغاء", "الغاء", "/cancel", "cancel"}
START_WORDS = {"بدء طلب جديد", "طلب جديد", "/start", "/new"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def normalize_arabic_digits(value: str) -> str:
    translations = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
    return value.translate(translations)


def normalize_phone(value: str) -> str:
    value = normalize_arabic_digits(value).strip()
    value = re.sub(r"[\s().-]", "", value)
    return value


def valid_phone(value: str) -> bool:
    return bool(re.fullmatch(r"\+?[0-9]{7,15}", normalize_phone(value)))


def safe_filename_suffix(file_path: str, mime_type: str | None = None) -> str:
    suffix = Path(file_path).suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}:
        return suffix
    guessed = mimetypes.guess_extension(mime_type or "") or ".jpg"
    return ".jpg" if guessed == ".jpe" else guessed


def ensure_storage() -> None:
    os.umask(0o077)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    os.chmod(DATA_DIR, 0o700)
    os.chmod(UPLOADS_DIR, 0o700)


class OrderStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.connection = sqlite3.connect(self.path, check_same_thread=False)
        self.connection.row_factory = sqlite3.Row
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA foreign_keys=ON")
        self._create_tables()

    def _create_tables(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS drafts (
                chat_id TEXT PRIMARY KEY,
                state TEXT NOT NULL,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
                order_id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                created_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'new',
                payload TEXT NOT NULL
            );
            """
        )
        self.connection.commit()

    def get_draft(self, chat_id: str) -> tuple[str, dict[str, Any]] | None:
        row = self.connection.execute(
            "SELECT state, payload FROM drafts WHERE chat_id = ?", (chat_id,)
        ).fetchone()
        if not row:
            return None
        return row["state"], json.loads(row["payload"])

    def save_draft(self, chat_id: str, state: str, payload: dict[str, Any]) -> None:
        self.connection.execute(
            """
            INSERT INTO drafts(chat_id, state, payload, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(chat_id) DO UPDATE SET
                state = excluded.state,
                payload = excluded.payload,
                updated_at = excluded.updated_at
            """,
            (chat_id, state, json.dumps(payload, ensure_ascii=False), utc_now()),
        )
        self.connection.commit()

    def delete_draft(self, chat_id: str) -> None:
        self.connection.execute("DELETE FROM drafts WHERE chat_id = ?", (chat_id,))
        self.connection.commit()

    def create_order(self, chat_id: str, payload: dict[str, Any]) -> str:
        order_id = f"RD-{datetime.now().strftime('%y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        self.connection.execute(
            "INSERT INTO orders(order_id, chat_id, created_at, payload) VALUES (?, ?, ?, ?)",
            (order_id, chat_id, utc_now(), json.dumps(payload, ensure_ascii=False)),
        )
        self.connection.commit()
        return order_id

    def recent_orders(self, limit: int = 10) -> list[sqlite3.Row]:
        return list(
            self.connection.execute(
                "SELECT order_id, created_at, status, payload FROM orders ORDER BY created_at DESC LIMIT ?",
                (limit,),
            ).fetchall()
        )

    def get_order(self, order_id: str) -> sqlite3.Row | None:
        return self.connection.execute(
            "SELECT order_id, created_at, status, payload FROM orders WHERE order_id = ?",
            (order_id,),
        ).fetchone()

    def close(self) -> None:
        self.connection.close()


class TelegramAPIError(RuntimeError):
    pass


class TelegramClient:
    def __init__(self, token: str) -> None:
        self.token = token
        self.api_root = f"https://api.telegram.org/bot{token}"
        self.file_root = f"https://api.telegram.org/file/bot{token}"
        self.session = requests.Session()
        self.session.headers.update({"User-Agent": "RidaaOrderBot/1.0"})

    def call(self, method: str, **kwargs: Any) -> Any:
        response = self.session.post(
            f"{self.api_root}/{method}", json=kwargs, timeout=POLL_TIMEOUT + 10
        )
        response.raise_for_status()
        result = response.json()
        if not result.get("ok"):
            raise TelegramAPIError(f"{method}: {result.get('description', 'unknown error')}")
        return result.get("result")

    def get_updates(self, offset: int | None) -> list[dict[str, Any]]:
        payload: dict[str, Any] = {"timeout": POLL_TIMEOUT, "allowed_updates": ["message", "callback_query"]}
        if offset is not None:
            payload["offset"] = offset
        return self.call("getUpdates", **payload)

    def send_message(
        self, chat_id: str | int, text: str, reply_markup: dict[str, Any] | None = None
    ) -> Any:
        payload: dict[str, Any] = {"chat_id": chat_id, "text": text}
        if reply_markup:
            payload["reply_markup"] = reply_markup
        return self.call("sendMessage", **payload)

    def answer_callback(self, callback_id: str, text: str = "") -> Any:
        return self.call("answerCallbackQuery", callback_query_id=callback_id, text=text)

    def get_file(self, file_id: str) -> dict[str, Any]:
        return self.call("getFile", file_id=file_id)

    def download_file(self, file_id: str, destination: Path) -> None:
        file_info = self.get_file(file_id)
        remote_path = file_info.get("file_path")
        if not remote_path:
            raise TelegramAPIError("Telegram لم يُرجع مسار الملف")
        response = self.session.get(f"{self.file_root}/{remote_path}", stream=True, timeout=60)
        response.raise_for_status()
        content_length = int(response.headers.get("content-length", "0"))
        if content_length > MAX_UPLOAD_BYTES:
            raise ValueError("حجم الصورة أكبر من الحد المسموح")
        written = 0
        with destination.open("wb") as output:
            for chunk in response.iter_content(chunk_size=64 * 1024):
                if not chunk:
                    continue
                written += len(chunk)
                if written > MAX_UPLOAD_BYTES:
                    destination.unlink(missing_ok=True)
                    raise ValueError("حجم الصورة أكبر من الحد المسموح")
                output.write(chunk)
        os.chmod(destination, 0o600)

    def send_media(self, chat_id: str | int, path: Path, caption: str) -> Any:
        method = "sendPhoto" if path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"} else "sendDocument"
        field = "photo" if method == "sendPhoto" else "document"
        with path.open("rb") as handle:
            response = self.session.post(
                f"{self.api_root}/{method}",
                data={"chat_id": str(chat_id), "caption": caption},
                files={field: (path.name, handle)},
                timeout=60,
            )
        response.raise_for_status()
        result = response.json()
        if not result.get("ok"):
            raise TelegramAPIError(f"{method}: {result.get('description', 'unknown error')}")
        return result.get("result")


def main_keyboard() -> dict[str, Any]:
    return {
        "keyboard": [[{"text": "بدء طلب جديد"}], [{"text": "معرفة رقم المحادثة"}]],
        "resize_keyboard": True,
        "one_time_keyboard": False,
    }


def cancel_keyboard() -> dict[str, Any]:
    return {"keyboard": [[{"text": "إلغاء"}]], "resize_keyboard": True}


def province_keyboard() -> dict[str, Any]:
    rows = []
    for index in range(0, len(PROVINCES), 3):
        rows.append([{"text": item} for item in PROVINCES[index : index + 3]])
    rows.append([{"text": "إلغاء"}])
    return {"keyboard": rows, "resize_keyboard": True, "one_time_keyboard": True}


def confirm_keyboard() -> dict[str, Any]:
    return {
        "inline_keyboard": [
            [
                {"text": "تأكيد إرسال الطلب", "callback_data": "confirm_order"},
                {"text": "تعديل البيانات", "callback_data": "edit_order"},
            ],
            [{"text": "إلغاء الطلب", "callback_data": "cancel_order"}],
        ]
    }


def text_value(message: dict[str, Any]) -> str:
    return str(message.get("text", "")).strip()


def extract_file_id(message: dict[str, Any]) -> tuple[str, str] | None:
    photos = message.get("photo")
    if photos:
        selected = photos[-1]
        return selected["file_id"], ".jpg"
    document = message.get("document")
    if document:
        mime = str(document.get("mime_type", ""))
        name = str(document.get("file_name", ""))
        if mime.startswith("image/") or Path(name).suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            return document["file_id"], safe_filename_suffix(name, mime)
    return None


def location_value(message: dict[str, Any]) -> str | None:
    location = message.get("location")
    if not location:
        return None
    latitude = location.get("latitude")
    longitude = location.get("longitude")
    if latitude is None or longitude is None:
        return None
    return f"إحداثيات: {latitude}, {longitude}"


def format_summary(payload: dict[str, Any]) -> str:
    return (
        "راجع بيانات طلبك قبل الإرسال:\n\n"
        f"الاسم: {payload.get('name', '—')}\n"
        f"رقم الهاتف: {payload.get('phone', '—')}\n"
        f"المحافظة: {payload.get('province', '—')}\n"
        f"الموقع: {payload.get('location', '—')}\n"
        f"رقم الموديل: {payload.get('model_number', '—')}\n"
        f"المقاسات: {payload.get('sizes', '—')}\n"
        "صورة الإيداع: مرفقة\n"
        "صورة الموديل: مرفقة\n\n"
        "إذا كانت البيانات صحيحة اضغط «تأكيد إرسال الطلب»."
    )


def format_admin_summary(order_id: str, payload: dict[str, Any]) -> str:
    return (
        f"طلب عباية جديد — {order_id}\n\n"
        f"الاسم: {payload.get('name', '—')}\n"
        f"الهاتف: {payload.get('phone', '—')}\n"
        f"المحافظة: {payload.get('province', '—')}\n"
        f"الموقع: {payload.get('location', '—')}\n"
        f"رقم الموديل: {payload.get('model_number', '—')}\n"
        f"المقاسات: {payload.get('sizes', '—')}\n"
        f"معرّف محادثة العميل: {payload.get('customer_chat_id', '—')}"
    )


class RidaaBot:
    def __init__(self, client: TelegramClient, store: OrderStore) -> None:
        self.client = client
        self.store = store

    def start_message(self, chat_id: str) -> None:
        self.client.send_message(
            chat_id,
            "أهلاً بك في بوت رِداء للعبايات.\n\nلإرسال طلبك للتأكيد، اضغط «بدء طلب جديد». سنطلب منك الاسم ورقم الهاتف والمحافظة والموقع والمقاسات ورقم الموديل وصورتي الإيداع والموديل.",
            main_keyboard(),
        )

    def start_order(self, chat_id: str) -> None:
        self.store.save_draft(chat_id, "name", {})
        self.client.send_message(
            chat_id,
            "لنبدأ بتأكيد طلبك. اكتب الاسم الثلاثي أو الاسم الذي نستخدمه للتواصل معك:",
            cancel_keyboard(),
        )

    def cancel(self, chat_id: str) -> None:
        draft = self.store.get_draft(chat_id)
        if draft:
            _, payload = draft
            for key in ("deposit_path", "model_path"):
                path = payload.get(key)
                if path:
                    Path(path).unlink(missing_ok=True)
        self.store.delete_draft(chat_id)
        self.client.send_message(chat_id, "تم إلغاء الطلب. يمكنك البدء من جديد في أي وقت.", main_keyboard())

    def save_photo(self, chat_id: str, message: dict[str, Any], kind: str) -> str:
        extracted = extract_file_id(message)
        if not extracted:
            raise ValueError("أرسل صورة واضحة أو ملف صورة بصيغة JPG أو PNG أو WEBP")
        file_id, suffix = extracted
        destination = UPLOADS_DIR / f"draft_{chat_id}_{kind}_{uuid.uuid4().hex[:8]}{suffix}"
        self.client.download_file(file_id, destination)
        return str(destination)

    def handle_photo_step(self, chat_id: str, message: dict[str, Any], state: str, payload: dict[str, Any]) -> None:
        kind = "deposit" if state == "deposit_photo" else "model"
        key = "deposit_path" if kind == "deposit" else "model_path"
        try:
            path = self.save_photo(chat_id, message, kind)
        except (ValueError, requests.RequestException, TelegramAPIError) as error:
            logger.warning("Unable to download %s image for %s: %s", kind, chat_id, error)
            self.client.send_message(chat_id, f"تعذر استلام الصورة. {error}\nأعد إرسالها من فضلك.", cancel_keyboard())
            return
        old_path = payload.get(key)
        if old_path:
            Path(old_path).unlink(missing_ok=True)
        payload[key] = path
        if kind == "deposit":
            self.store.save_draft(chat_id, "model_photo", payload)
            self.client.send_message(
                chat_id,
                "تم استلام صورة الإيداع. الآن أرسل صورة الموديل بوضوح:",
                cancel_keyboard(),
            )
        else:
            self.store.save_draft(chat_id, "confirm", payload)
            self.client.send_message(chat_id, format_summary(payload), confirm_keyboard())

    def handle_message(self, message: dict[str, Any]) -> None:
        chat = message.get("chat") or {}
        chat_id = str(chat.get("id", ""))
        if not chat_id:
            return
        text = text_value(message)
        normalized = text.casefold()

        if normalized in {"/help", "مساعدة"}:
            self.start_message(chat_id)
            return
        if normalized in {"/myid", "معرفة رقم المحادثة"}:
            self.client.send_message(chat_id, f"رقم هذه المحادثة هو: {chat_id}", main_keyboard())
            return
        if normalized in CANCEL_WORDS:
            self.cancel(chat_id)
            return
        if normalized in START_WORDS:
            self.start_order(chat_id)
            return

        draft = self.store.get_draft(chat_id)
        if not draft:
            self.client.send_message(chat_id, "اختر «بدء طلب جديد» حتى نبدأ تسجيل بيانات الطلب.", main_keyboard())
            return

        state, payload = draft
        if state == "name":
            if len(text) < 2:
                self.client.send_message(chat_id, "اكتب الاسم بشكل صحيح من فضلك:", cancel_keyboard())
                return
            payload["name"] = text
            self.store.save_draft(chat_id, "phone", payload)
            self.client.send_message(chat_id, "اكتب رقم الهاتف للتواصل معك (مثال: 07XXXXXXXXX):", cancel_keyboard())
        elif state == "phone":
            phone = normalize_phone(text)
            if not valid_phone(phone):
                self.client.send_message(chat_id, "رقم الهاتف غير واضح. أرسله من 7 إلى 15 رقماً، ويمكن أن يبدأ بعلامة +:", cancel_keyboard())
                return
            payload["phone"] = phone
            self.store.save_draft(chat_id, "province", payload)
            self.client.send_message(chat_id, "اختر المحافظة:", province_keyboard())
        elif state == "province":
            if text not in PROVINCES:
                self.client.send_message(chat_id, "اختر المحافظة من الأزرار الظاهرة، أو اختر «أخرى»:", province_keyboard())
                return
            payload["province"] = text
            self.store.save_draft(chat_id, "location", payload)
            self.client.send_message(chat_id, "أرسل الموقع أو العنوان بالتفصيل. يمكنك أيضاً مشاركة موقعك الجغرافي من تيليجرام:", cancel_keyboard())
        elif state == "location":
            value = location_value(message) or text
            if len(value) < 3:
                self.client.send_message(chat_id, "أرسل عنواناً أو موقعاً أو شارك موقعك الجغرافي:", cancel_keyboard())
                return
            payload["location"] = value
            self.store.save_draft(chat_id, "model_number", payload)
            self.client.send_message(chat_id, "اكتب رقم الموديل:", cancel_keyboard())
        elif state == "model_number":
            if len(text) < 1:
                self.client.send_message(chat_id, "اكتب رقم الموديل من فضلك:", cancel_keyboard())
                return
            payload["model_number"] = text
            self.store.save_draft(chat_id, "sizes", payload)
            self.client.send_message(chat_id, "اكتب المقاسات المطلوبة، مثال: عباية 56، كم 58، أو أكثر من مقاس:", cancel_keyboard())
        elif state == "sizes":
            if len(text) < 1:
                self.client.send_message(chat_id, "اكتب المقاسات المطلوبة من فضلك:", cancel_keyboard())
                return
            payload["sizes"] = text
            self.store.save_draft(chat_id, "deposit_photo", payload)
            self.client.send_message(chat_id, "أرسل صورة الإيداع الآن. يجب أن تكون الصورة واضحة وتظهر تفاصيل الإيداع:", cancel_keyboard())
        elif state in {"deposit_photo", "model_photo"}:
            self.handle_photo_step(chat_id, message, state, payload)
        elif state == "confirm":
            self.client.send_message(chat_id, format_summary(payload), confirm_keyboard())

    def handle_callback(self, callback: dict[str, Any]) -> None:
        callback_id = str(callback.get("id", ""))
        message = callback.get("message") or {}
        chat_id = str((message.get("chat") or {}).get("id", ""))
        action = str(callback.get("data", ""))
        if callback_id:
            self.client.answer_callback(callback_id)
        if not chat_id:
            return

        draft = self.store.get_draft(chat_id)
        if not draft:
            self.client.send_message(chat_id, "انتهت جلسة الطلب. اضغط «بدء طلب جديد» للبدء مرة أخرى.", main_keyboard())
            return
        state, payload = draft
        if state != "confirm":
            self.client.send_message(chat_id, "أكمل خطوات الطلب أولاً.", cancel_keyboard())
            return

        if action == "cancel_order":
            self.cancel(chat_id)
        elif action == "edit_order":
            self.store.save_draft(chat_id, "name", {})
            self.client.send_message(chat_id, "سنبدأ التعديل من جديد. اكتب الاسم:", cancel_keyboard())
        elif action == "confirm_order":
            self.confirm_order(chat_id, payload)

    def confirm_order(self, chat_id: str, payload: dict[str, Any]) -> None:
        if not payload.get("deposit_path") or not payload.get("model_path"):
            self.client.send_message(chat_id, "لم تكتمل الصور المطلوبة. أرسل الصور ثم حاول التأكيد مرة أخرى.", cancel_keyboard())
            return
        payload = dict(payload)
        payload["customer_chat_id"] = chat_id
        order_id = self.store.create_order(chat_id, payload)
        for key in ("deposit_path", "model_path"):
            old_path = Path(payload[key])
            new_path = UPLOADS_DIR / f"{order_id}_{key.replace('_path', '')}{old_path.suffix}"
            old_path.replace(new_path)
            payload[key] = str(new_path)
        self.store.connection.execute(
            "UPDATE orders SET payload = ? WHERE order_id = ?",
            (json.dumps(payload, ensure_ascii=False), order_id),
        )
        self.store.connection.commit()
        self.store.delete_draft(chat_id)

        self.client.send_message(
            chat_id,
            f"تم استلام طلبك بنجاح. رقم الطلب: {order_id}\nسيتواصل معك فريق رِداء بعد مراجعة البيانات والإيداع. شكراً لاختيارك رِداء.",
            main_keyboard(),
        )
        self.notify_admins(order_id, payload)

    def notify_admins(self, order_id: str, payload: dict[str, Any]) -> None:
        if not ADMIN_CHAT_IDS:
            logger.warning("ADMIN_CHAT_IDS is empty; order %s was saved locally only", order_id)
            return
        summary = format_admin_summary(order_id, payload)
        for admin_id in ADMIN_CHAT_IDS:
            try:
                self.client.send_message(admin_id, summary)
                for key, label in (("deposit_path", "صورة الإيداع"), ("model_path", "صورة الموديل")):
                    path = Path(payload[key])
                    self.client.send_media(admin_id, path, f"{order_id} — {label}")
            except (OSError, requests.RequestException, TelegramAPIError) as error:
                logger.exception("Failed to notify admin %s for %s: %s", admin_id, order_id, error)

    def run(self) -> None:
        offset: int | None = None
        logger.info("Ridaa bot is running. Admin chats configured: %s", len(ADMIN_CHAT_IDS))
        while True:
            try:
                updates = self.client.get_updates(offset)
                for update in updates:
                    offset = int(update["update_id"]) + 1
                    try:
                        if update.get("callback_query"):
                            self.handle_callback(update["callback_query"])
                        elif update.get("message"):
                            self.handle_message(update["message"])
                    except Exception:
                        logger.exception("Failed to process update %s", update.get("update_id"))
            except (requests.RequestException, TelegramAPIError) as error:
                logger.error("Telegram connection error: %s; retrying in 5 seconds", error)
                time.sleep(5)
            except KeyboardInterrupt:
                logger.info("Stopping bot")
                break


def main() -> int:
    if not TOKEN:
        print("Missing TELEGRAM_BOT_TOKEN. Copy .env.example to .env and set the token.", file=sys.stderr)
        return 2
    ensure_storage()
    store = OrderStore(DB_PATH)
    try:
        RidaaBot(TelegramClient(TOKEN), store).run()
    finally:
        store.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

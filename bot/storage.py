"""Verknüpfung Telegram-Nutzer → Web-App-Konto (SQLite)."""
from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path


@dataclass(frozen=True)
class Session:
    telegram_id: int
    user_id: str
    creator_key: str
    status_code: Decimal


class SessionStore:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(path)
        self.db.execute(
            """CREATE TABLE IF NOT EXISTS sessions (
                 telegram_id INTEGER PRIMARY KEY,
                 user_id     TEXT NOT NULL,
                 creator_key TEXT NOT NULL,
                 status_code TEXT NOT NULL,
                 linked_at   TEXT NOT NULL
               )"""
        )
        self.db.commit()

    def get(self, telegram_id: int) -> Session | None:
        row = self.db.execute(
            "SELECT telegram_id, user_id, creator_key, status_code FROM sessions WHERE telegram_id = ?",
            (telegram_id,),
        ).fetchone()
        return Session(row[0], row[1], row[2], Decimal(row[3])) if row else None

    def save(self, telegram_id: int, user_id: str, creator_key: str, status_code: Decimal) -> Session:
        self.db.execute(
            """INSERT INTO sessions (telegram_id, user_id, creator_key, status_code, linked_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(telegram_id) DO UPDATE SET
                 user_id = excluded.user_id, creator_key = excluded.creator_key,
                 status_code = excluded.status_code, linked_at = excluded.linked_at""",
            (telegram_id, user_id, creator_key, str(status_code), datetime.now(timezone.utc).isoformat()),
        )
        self.db.commit()
        return Session(telegram_id, user_id, creator_key, status_code)

    def update_status(self, telegram_id: int, status_code: Decimal) -> None:
        self.db.execute("UPDATE sessions SET status_code = ? WHERE telegram_id = ?", (str(status_code), telegram_id))
        self.db.commit()

    def delete(self, telegram_id: int) -> None:
        self.db.execute("DELETE FROM sessions WHERE telegram_id = ?", (telegram_id,))
        self.db.commit()

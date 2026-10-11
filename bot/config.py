"""Einstellungen aus bot/.env (oder Umgebungsvariablen)."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BOT_DIR = Path(__file__).resolve().parent
REPO_DIR = BOT_DIR.parent
DATA_DIR = BOT_DIR / "data"


def _load_env_file(path: Path) -> None:
    """Minimaler .env-Parser (KEY=VALUE), überschreibt keine gesetzten Variablen."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Config:
    token: str
    api_url: str          # Google-Apps-Script-Web-App (leer = Demo-Modus)
    web_app_url: str      # Basis-URL der Web-App (für Links im Chat)

    @property
    def demo(self) -> bool:
        return not self.api_url


def load_config() -> Config:
    _load_env_file(BOT_DIR / ".env")
    return Config(
        token=os.environ.get("TELEGRAM_BOT_TOKEN", ""),
        api_url=os.environ.get("API_URL", ""),
        web_app_url=os.environ.get("WEB_APP_URL", "https://tts-creator-beta.vercel.app").rstrip("/"),
    )

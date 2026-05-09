import os
from dotenv import load_dotenv

load_dotenv()


def _clean_env(name: str, default: str = "") -> str:
    value = os.getenv(name, default)
    if not isinstance(value, str):
        return default
    cleaned = value.strip().strip("\"'")
    if cleaned.endswith("...") or cleaned.lower() in {"none", "null"}:
        return default
    return cleaned


ANTHROPIC_API_KEY = _clean_env("ANTHROPIC_API_KEY")
OPENAI_API_KEY = _clean_env("OPENAI_API_KEY")
DEFAULT_MODEL = (
    _clean_env("MODEL_CHAT")
    or _clean_env("OPENAI_MODEL")
    or _clean_env("DEFAULT_MODEL")
    or ("gpt-4o-mini" if OPENAI_API_KEY else "claude-sonnet-4-20250514")
)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DEFAULT_ROUNDS = int(os.getenv("PROBABYLON_DEFAULT_ROUNDS", "5"))
DEFAULT_LIQUIDITY_B = float(os.getenv("PROBABYLON_LMSR_B", "75"))
DEFAULT_OUTPUT_DIR = os.getenv("PROBABYLON_OUTPUT_DIR", "runs")

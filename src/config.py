import os
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "claude-sonnet-4-20250514")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DEFAULT_ROUNDS = int(os.getenv("PROBABYLON_DEFAULT_ROUNDS", "5"))
DEFAULT_LIQUIDITY_B = float(os.getenv("PROBABYLON_LMSR_B", "75"))
DEFAULT_OUTPUT_DIR = os.getenv("PROBABYLON_OUTPUT_DIR", "runs")

"""
Probabylon MVP CLI entrypoint.
Runs a generic binary prediction market with multi-agent trading.
"""

from __future__ import annotations

import argparse
import logging
from textwrap import dedent

from .config import DEFAULT_LIQUIDITY_B, DEFAULT_OUTPUT_DIR, DEFAULT_ROUNDS, LOG_LEVEL
from .engine import ProbabylonEngine

logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s [%(levelname)s] %(message)s")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="probabylon",
        description="Multi-agent prediction market engine for probabilistic reasoning.",
    )
    parser.add_argument("--question", required=True, help="Binary prediction question.")
    parser.add_argument("--description", default="", help="Optional market description.")
    parser.add_argument(
        "--resolution-criteria",
        required=True,
        help="How this market resolves to YES/NO at expiry.",
    )
    parser.add_argument("--category", default="general", help="Freeform category label.")
    parser.add_argument("--rounds", type=int, default=DEFAULT_ROUNDS, help="Simulation rounds.")
    parser.add_argument("--liquidity-b", type=float, default=DEFAULT_LIQUIDITY_B, help="LMSR liquidity parameter.")
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR, help="Run output directory.")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    engine = ProbabylonEngine(output_dir=args.output_dir, liquidity_b=args.liquidity_b)
    result = engine.run(
        question=args.question,
        description=args.description or args.question,
        resolution_criteria=args.resolution_criteria,
        category=args.category,
        rounds=args.rounds,
    )
    print(
        dedent(
            f"""
            Probabylon Simulation Complete
            ----------------------------------------
            Market: {result.market.question}
            Category: {result.market.category}
            Rounds: {result.rounds}
            Trades: {result.trade_count}
            Final probability (YES): {result.final_probability:.4f}
            Explainability log: {result.explainability_log_path}
            Trade log: {result.trade_log_path}
            Agent capitals: {result.agent_capitals}
            """
        ).strip()
    )


if __name__ == "__main__":
    main()

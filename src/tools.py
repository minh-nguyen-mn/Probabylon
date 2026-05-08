"""
General utility tools for Probabylon.
The market engine itself is implemented in dedicated modules.
"""

from __future__ import annotations

import ast
import operator
from collections.abc import Callable

import httpx

OPS: dict[type, Callable[[float, float], float]] = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Pow: operator.pow,
}


def calculate(expression: str) -> str:
    """Safely evaluate simple arithmetic expressions."""

    def eval_node(node: ast.AST) -> float:
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.BinOp) and type(node.op) in OPS:
            return OPS[type(node.op)](eval_node(node.left), eval_node(node.right))
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.USub):
            return -eval_node(node.operand)
        raise ValueError("Unsupported expression")

    try:
        parsed = ast.parse(expression, mode="eval")
        return str(eval_node(parsed.body))
    except Exception as exc:
        return f"Error: {exc}"


def fetch_url(url: str) -> str:
    """Fetch text content from a URL."""
    try:
        response = httpx.get(url, timeout=10, follow_redirects=True)
        response.raise_for_status()
        return response.text[:3000]
    except Exception as exc:
        return f"Error: {exc}"

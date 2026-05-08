import math


def clamp(value: float) -> float:
    return max(1e-6, min(1 - 1e-6, value))


def cost(b: float, q_yes: float, q_no: float) -> float:
    return b * math.log(math.exp(q_yes / b) + math.exp(q_no / b))


def probability(b: float, q_yes: float, q_no: float) -> float:
    y = math.exp(q_yes / b)
    n = math.exp(q_no / b)
    return clamp(y / (y + n))


def move_to_probability(b: float, q_yes: float, q_no: float, target_probability: float) -> tuple[float, float, float]:
    target_probability = clamp(target_probability)
    before = cost(b, q_yes, q_no)
    gap = b * math.log(target_probability / (1 - target_probability))
    q_yes_next = q_no + gap
    spend = max(0.0, cost(b, q_yes_next, q_no) - before)
    return q_yes_next, q_no, spend

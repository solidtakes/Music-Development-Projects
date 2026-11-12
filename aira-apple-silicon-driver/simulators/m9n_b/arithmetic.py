"""Count-only arithmetic. No samples, files, device APIs or hardware backend."""
from dataclasses import dataclass


class ModelError(ValueError):
    pass


def integer(value, low=0, high=(1 << 63) - 1):
    if type(value) is not int or not low <= value <= high:
        raise ModelError("integer_bounds")
    return value


@dataclass(frozen=True)
class RequestFrame:
    value: int

    def __post_init__(self):
        integer(self.value, high=(1 << 63) - 4)


@dataclass(frozen=True)
class TransactionSlot:
    value: int

    def __post_init__(self):
        integer(self.value)


def slots(origin):
    if type(origin) is not RequestFrame:
        raise ModelError("request_frame_unit")
    # Explicit synthetic adapter: raw request-frame delta -> eight HS slots.
    return tuple(TransactionSlot(origin.value * 8 + i) for i in range(8))


def pack(frames):
    integer(frames, high=112)
    return tuple(((i + 1) * frames // 8 - i * frames // 8) for i in range(8))


@dataclass
class Fallback:
    phase: int = 0

    def effective(self, frames):
        integer(frames, high=14)
        if frames >= 6:
            return frames
        self.phase += 7904
        carry, self.phase = divmod(self.phase, 8000)
        return 11 + carry

    def request(self, counts, strict=True):
        if len(counts) != 8:
            raise ModelError("transaction_count")
        for count in counts:
            integer(count, high=560)
            if strict and count % 40:
                raise ModelError("frame_alignment")
        # Validate the whole request before changing phase.
        return sum(self.effective(n // 40) for n in counts)


def nominal_budget(rate=96000, milliseconds=1, phase=0):
    integer(rate, high=1000000); integer(milliseconds, high=1000)
    integer(phase, high=999)
    return divmod(rate * milliseconds + phase, 1000)


def input_clock(transactions, ppm=0):
    """Synthetic IN drift generator only. Never used to generate OUT budgets."""
    integer(transactions); integer(ppm, -10000, 10000)
    phase = 0
    for _ in range(transactions):
        n, phase = divmod(phase + 12 * (1000000 + ppm), 1000000)
        yield n * 40

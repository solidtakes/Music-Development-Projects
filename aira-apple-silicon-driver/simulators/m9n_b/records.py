"""Independent readiness, callback, lease and consumer state records."""
from dataclasses import dataclass, field

REFERENCE = "ROLAND_STATIC_REFERENCE"
SAFE = "CONSERVATIVE_NATIVE_POLICY"
UNDERRUN = 0xe00002e7
ABORTED = 0xe00002eb


@dataclass(frozen=True)
class Fault:
    pack_available: bool = True
    prepare_ok: bool = True
    descriptor_present: bool = True
    api_accepts: bool = True


@dataclass(frozen=True)
class Transaction:
    status: int = -1
    count: int = 0
    timestamp: int = 0


@dataclass
class Pack:
    uid: int
    generation: int
    direction: str
    origin: int
    budget: int | None = None
    eligible: bool = True
    active: bool = True
    lease: str = "LOCAL"
    callback: str = "NOT_SEEN"
    saved_status: int = -1
    retired: bool = False
    retirement_code: int | None = None
    consumed: bool = False
    coherent: bool = False
    cancellation_requested: bool = False
    cancellation_effective: bool = False
    transactions: tuple = field(default_factory=lambda: (Transaction(),) * 8)
    frames: tuple = ()

    @property
    def end_frame(self):
        return self.origin + 1


@dataclass
class Budget:
    uid: int
    generation: int
    frames: int
    source: str
    source_pack: int | None = None
    disposition: str = "PENDING"
    out_pack: int | None = None


@dataclass
class StageResult:
    direction: str
    ok: bool
    stage: str
    uid: int | None
    bus_before: int
    bus_after: int
    offset_before: int
    offset_after: int


@dataclass
class Cycle:
    budget: int
    frames: int
    source: str
    enabled: tuple
    stages: list = field(default_factory=list)
    shared_attempted: bool = False
    failure: str | None = None
    result_code: int = 0

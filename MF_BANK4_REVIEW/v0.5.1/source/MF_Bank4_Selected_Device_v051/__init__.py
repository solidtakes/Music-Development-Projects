"""Bank 4 Selected Device Controls v0.5.1 — new rebuild candidate."""
from .surface import Bank4Surface


def create_instance(c_instance):
    return Bank4Surface(c_instance)

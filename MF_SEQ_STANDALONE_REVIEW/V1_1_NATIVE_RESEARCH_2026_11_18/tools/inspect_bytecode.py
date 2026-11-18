"""Static inspection only: never import or execute installed Ableton modules."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent / "deps"))
from xdis.load import load_module
from xdis import Bytecode, get_opcode_module
from xdis.version_info import PythonImplementation


def inspect(path):
    version, timestamp, magic, code, *_ = load_module(str(path))
    out = io.StringIO()
    opcodes = get_opcode_module(version, PythonImplementation.CPython)

    def visit(item, prefix=""):
        name = prefix + item.co_name
        out.write("\n=== {} (line {}) ===\n".format(name, item.co_firstlineno))
        out.write(Bytecode(item, opcodes).dis())
        for constant in item.co_consts:
            if hasattr(constant, "co_code"):
                visit(constant, name + ".")

    visit(code)
    return out.getvalue(), {
        "path": str(path), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "python_version": list(version), "pyc_magic": magic,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="+")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    target = Path(args.out)
    target.mkdir(parents=True, exist_ok=True)
    manifest = []
    for index, value in enumerate(args.paths):
        source = Path(value)
        result, metadata = inspect(source)
        dest = "{:02d}_{}.dis.txt".format(index, source.stem)
        (target / dest).write_text(result, encoding="utf-8")
        metadata["disassembly"] = dest
        manifest.append(metadata)
    (target / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("Inspected {} files without executing them.".format(len(manifest)))

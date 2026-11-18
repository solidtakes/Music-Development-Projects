"""Extract only this diagnostic's records; never publish the user's whole Live log."""
import argparse
import json
from pathlib import Path


def collect(log):
    records = []
    for line in log.read_text(encoding="utf-8", errors="replace").splitlines():
        if "RemoteScriptMessage:" in line and "MFSEQ_R1 " in line:
            record = json.loads(line.split("MFSEQ_R1 ", 1)[1])
            record["host_log_timestamp"] = line.split(": info:", 1)[0]
            records.append(record)
    return records


def compact(records):
    summaries, snapshot = [], 0
    for record in records:
        kind, data = record["kind"], record["data"]
        if kind == "runtime":
            snapshot = data["snapshot"]
            item = dict(record)
            item["data"] = dict(data)
            item["data"]["Live_has_StepSequencer_in_dir"] = "StepSequencer" in data["Live_public_members"]
            del item["data"]["Live_public_members"]
        elif kind in ("Clip_class", "object"):
            item = dict(record)
            item["data"] = dict(data)
            if "members" in data:
                item["data"]["members_matching_native_terms"] = [
                    n for n in data["members"] if any(t in n.lower() for t in
                                                     ("step", "row", "lane", "seq", "midi_clip_type"))]
                del item["data"]["members"]
            if "properties" in data:
                item["data"]["properties"] = {
                    key: {k: v for k, v in value.items() if k != "descriptor_doc"}
                    for key, value in data["properties"].items()}
        else:
            item = dict(record)
        item["snapshot"] = snapshot
        summaries.append(item)
    return summaries


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("log")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    records = collect(Path(args.log))
    result = {
        "build": "13.0b24",
        "build_source": "Installed executable ProductVersion and the Live 13.0b24 Preferences log directory",
        "runtime_version_caveat": "Application version methods returned [13, 0, 0], not the beta suffix",
        "probe_id": "MFSEQ_R1",
        "record_count": len(records),
        "records": compact(records),
    }
    Path(args.out).write_text(json.dumps(result, indent=2), encoding="utf-8")
    print("Extracted {} diagnostic records".format(len(records)))

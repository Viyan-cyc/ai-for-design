#!/usr/bin/env python3
"""Compare prototype assets against an asset library and propose sync actions."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

from scan_assets import scan_directory, load_index


def _load_contract(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def classify(kind: str, proto_assets: dict, lib_assets: dict, lib_index: dict) -> List[dict]:
    """Classify each prototype asset as added, changed, in-sync, or ignored."""
    items = []
    for asset_id, info in proto_assets.items():
        entry = {
            "kind": kind,
            "id": asset_id,
            "prototypeFile": info["file"],
            "prototypeHash": info["hash"],
            "files": info["files"],
        }
        if asset_id not in lib_index:
            entry["status"] = "added"
            entry["action"] = "register"
            entry["reason"] = "New asset in prototype, not present in library index."
            entry["approvedIndexEntry"] = None
        else:
            lib_source = lib_index[asset_id].get("source", "")
            entry["libraryFile"] = lib_source
            if asset_id in lib_assets:
                entry["libraryHash"] = lib_assets[asset_id]["hash"]
                if lib_assets[asset_id]["hash"] != info["hash"]:
                    entry["status"] = "changed"
                    entry["action"] = "update"
                    entry["reason"] = "Prototype source differs from library source."
                else:
                    entry["status"] = "in-sync"
                    entry["action"] = "none"
                    entry["reason"] = "Contents are identical."
            else:
                # Registered in index but source file missing in library
                entry["status"] = "orphaned"
                entry["action"] = "update"
                entry["reason"] = "Registered in index but source file missing; will recreate from prototype."
        items.append(entry)
    return items


def compare(prototype_root: Path, library_root: Path, contract: dict) -> dict:
    proto_scan = scan_directory(prototype_root, contract, target="prototype")
    lib_scan = scan_directory(library_root, contract, target="library")

    component_index = load_index(library_root, contract, "components")
    template_index = load_index(library_root, contract, "templates")

    components = classify("component", proto_scan["components"], lib_scan["components"], component_index)
    templates = classify("template", proto_scan["templates"], lib_scan["templates"], template_index)

    all_items = components + templates
    actionable = [item for item in all_items if item["action"] != "none"]

    return {
        "schemaVersion": "1.0",
        "assetId": contract["assetId"],
        "prototypeRoot": str(prototype_root),
        "libraryRoot": str(library_root),
        "approved": False,
        "summary": {
            "totalPrototypeComponents": len(proto_scan["components"]),
            "totalPrototypeTemplates": len(proto_scan["templates"]),
            "added": len([i for i in all_items if i["status"] == "added"]),
            "changed": len([i for i in all_items if i["status"] == "changed"]),
            "orphaned": len([i for i in all_items if i["status"] == "orphaned"]),
            "inSync": len([i for i in all_items if i["status"] == "in-sync"]),
            "actionable": len(actionable),
        },
        "components": components,
        "templates": templates,
        "actionable": actionable,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("contract", type=Path, help="Path to asset-library.contract.json")
    parser.add_argument("prototype", type=Path, help="Path to prototype root")
    parser.add_argument("library", type=Path, help="Path to asset library root")
    parser.add_argument("-o", "--output", type=Path, help="Write proposal to file")
    args = parser.parse_args()

    contract = _load_contract(args.contract)
    proposal = compare(args.prototype.resolve(), args.library.resolve(), contract)

    text = json.dumps(proposal, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
        print(f"Proposal written to {args.output}")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

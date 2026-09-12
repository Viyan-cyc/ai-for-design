#!/usr/bin/env python3
"""Freeze a user-confirmed UX prototype into an engineering handoff record."""

from __future__ import annotations

import argparse
import json
import hashlib
from datetime import datetime, timezone
from pathlib import Path

from validate_source_draft import validate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("assets_root", type=Path)
    parser.add_argument("--direction-id", required=True)
    parser.add_argument("--browser-report", type=Path, required=True)
    parser.add_argument("--confirmation-reference", required=True)
    args = parser.parse_args()
    output, assets_root = args.output.resolve(), args.assets_root.resolve()
    errors = validate(output, assets_root)
    if errors:
        print("\n".join(f"ERROR: {item}" for item in errors))
        return 1
    selection = json.loads((output / "asset-selection.json").read_text(encoding="utf-8"))
    if args.direction_id != selection.get("directionId"):
        print(f"ERROR: direction-id differs from the resolved direction: {selection.get('directionId')!r}")
        return 1
    if not args.confirmation_reference.strip():
        parser.error("User confirmation reference is required")
    report = json.loads(args.browser_report.read_text())
    config_hash = hashlib.sha256((output / selection['configFile']).read_bytes()).hexdigest()
    if (report.get('status') != 'passed' or report.get('prototypeRoot') != str(output)
        or report.get('configSha256') != config_hash
        or not set(selection['criticalInteractions']) <= set(report.get('criticalInteractions', []))):
        parser.error("Browser report must cover this prototype, configuration and all critical interactions")
    handoff = {
        "schemaVersion": "2.2",
        "status": "confirmed",
        "confirmedAt": datetime.now(timezone.utc).isoformat(),
        "directionId": args.direction_id,
        "browserSmokeTest": "passed",
        "browserReport": {"path": str(args.browser_report.resolve()), "sha256": hashlib.sha256(args.browser_report.read_bytes()).hexdigest()},
        "userConfirmationReference": args.confirmation_reference,
        "asset": {key: selection[key] for key in ("assetId", "assetVersion", "sourceReleaseSha256", "templateId")},
        "components": selection["components"],
        "interactions": selection["interactions"],
        "businessConfig": selection["configFile"],
        "criticalActionIds": selection.get("criticalInteractions", []),
    }
    (output / "design-handoff.json").write_text(json.dumps(handoff, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote confirmed design handoff: {output / 'design-handoff.json'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""One-shot entry: scan prototype, compare with asset library, and optionally sync."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from compare_assets import compare
from sync_to_library import sync


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("contract", type=Path, help="Path to asset-library.contract.json")
    parser.add_argument("prototype", type=Path, help="Path to prototype root")
    parser.add_argument("library", type=Path, help="Path to asset library root")
    parser.add_argument("--dry-run", action="store_true", help="Show proposal and would-be changes without writing")
    parser.add_argument("--yes", action="store_true", help="Skip confirmation and apply sync")
    parser.add_argument("-o", "--output", type=Path, default=Path("sync-proposal.json"), help="Proposal output path")
    args = parser.parse_args()

    contract = json.loads(args.contract.read_text(encoding="utf-8"))
    proposal = compare(args.prototype.resolve(), args.library.resolve(), contract)

    print(json.dumps(proposal, ensure_ascii=False, indent=2))
    args.output.write_text(json.dumps(proposal, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nProposal saved to {args.output}")

    if proposal["summary"]["actionable"] == 0:
        print("No actionable items found.")
        return 0

    if args.dry_run:
        print("\nDry run: no changes applied.")
        return 0

    if not args.yes:
        print("\nRun with --yes to apply sync, or use sync_to_library.py manually.")
        return 0

    proposal['approved'] = True
    result = sync(args.prototype.resolve(), args.library.resolve(), args.contract.resolve(), proposal, dry_run=False)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result.get("blocked") else 0


if __name__ == "__main__":
    raise SystemExit(main())

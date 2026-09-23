"""Export the API contract without starting the application or connecting to services."""

import argparse
import json
from pathlib import Path

from saint_tibo.core.config import Settings
from saint_tibo.main import create_api

DEFAULT_OUTPUT = Path(__file__).resolve().parents[2] / "contracts" / "openapi.json"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--check", action="store_true", help="Fail if the saved contract is stale")
    args = parser.parse_args()
    # Contract generation must not depend on runtime environment variables or secrets.
    schema = create_api(Settings.model_construct()).openapi()
    content = json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    if args.check:
        if not args.output.exists() or args.output.read_text() != content:
            parser.exit(
                1,
                "OpenAPI contract is stale. Run `bun run api:generate` from the repository root.\n",
            )
        return
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(content)
    print(f"Exported {args.output}")


if __name__ == "__main__":
    main()

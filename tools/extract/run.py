"""Direct subprocess entrypoint; the sibling extract package uses only stdlib."""
from extract.cli import main

raise SystemExit(main())

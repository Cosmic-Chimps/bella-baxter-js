#!/usr/bin/env python3
"""Move npm's `latest` dist-tag onto a just-published version, when that is correct.

npm has no notion of a prerelease at install time: `npm install @bella-baxter/sdk`
installs whatever `latest` points at, and nothing else. Publishing every preview
under `--tag preview` therefore left `latest` frozen on 0.1.1-preview.11 — the last
release published before publish.yml grew its dist-tag logic — for six months, so
every JS consumer kept getting a February build while PyPI, NuGet, Go and Maven all
carried .102 (Cosmic-Chimps/bella-baxter#732).

pip and NuGet resolve to the newest prerelease when a package has no stable release;
this gives npm the same behaviour. The moment a stable version is published, this
stops moving `latest` — a prerelease must never be dragged over a real release.

Usage:
    promote-dist-tag.py <version> <package> [<package> ...] [--dry-run]

Package names are the unscoped halves (`sdk`, `kiota-client`, ...). The decision is
per package, so one package with a stable release does not block the others, and
re-running an old tag never moves `latest` backwards.
"""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.error
import urllib.request

SCOPE = "@bella-baxter"
REGISTRY = "https://registry.npmjs.org"


def semver_key(version: str):
    """Order versions by semver precedence (build metadata ignored, as the spec says)."""
    core, _, rest = version.partition("-")
    prerelease = rest.partition("+")[0]
    try:
        numbers = [int(part) for part in core.split(".")]
    except ValueError:
        return ([-1], (0, []))  # unparseable: sorts below everything real
    if not prerelease:
        return (numbers, (1,))  # a stable release outranks any prerelease of the same core
    identifiers = [
        (0, int(part), "") if part.isdigit() else (1, 0, part)
        for part in prerelease.split(".")
    ]
    return (numbers, (0, identifiers))


def is_prerelease(version: str) -> bool:
    return "-" in version


def fetch_packument(name: str) -> dict:
    url = f"{REGISTRY}/{name.replace('/', '%2F')}"
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.load(response)


def decide(name: str, version: str) -> tuple[bool, str]:
    """Return (promote?, reason). Anything unknown declines — `latest` is what users get."""
    try:
        packument = fetch_packument(name)
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as exc:
        return False, f"registry unreadable ({exc}) — leaving `latest` where it is"

    published = list(packument.get("versions", {}))
    if version not in published:
        return False, f"{version} is not on the registry"

    current = packument.get("dist-tags", {}).get("latest")
    if current == version:
        return False, "`latest` already points here"

    stable = [v for v in published if not is_prerelease(v)]
    if stable:
        newest_stable = max(stable, key=semver_key)
        return False, f"a stable release exists ({newest_stable}) — `latest` belongs to it"

    newest = max(published, key=semver_key)
    if newest != version:
        return False, f"{newest} is newer than {version}"

    return True, f"no stable release yet and {version} is the newest published"


def main(argv: list[str]) -> int:
    args = [a for a in argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in argv[1:]
    if len(args) < 2:
        print(__doc__, file=sys.stderr)
        return 2

    version, packages = args[0], args[1:]
    if not is_prerelease(version):
        print(f"{version} is a stable release — publish already set `latest`. Nothing to do.")
        return 0

    failures = []
    for package in packages:
        name = f"{SCOPE}/{package}"
        promote, reason = decide(name, version)
        if not promote:
            print(f"– {name}: skipped — {reason}")
            continue
        print(f"→ {name}@{version}: promoting to `latest` — {reason}")
        if dry_run:
            continue
        result = subprocess.run(
            ["npm", "dist-tag", "add", f"{name}@{version}", "latest"],
            capture_output=True,
            text=True,
        )
        sys.stdout.write(result.stdout)
        sys.stderr.write(result.stderr)
        if result.returncode != 0:
            failures.append(name)

    if failures:
        print(f"::error::failed to move `latest` for: {', '.join(failures)}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

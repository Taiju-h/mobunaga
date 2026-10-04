#!/usr/bin/env python3
"""Fast post-processing for already extracted Mobunaga battle frames.

This script NEVER reads the source MP4. It reads an existing manifest.csv and groups
nearby timestamps into one operation/burst, keeping only the last frame in each burst.
Use this to tune --gap repeatedly without rescanning a large screen recording.
"""

from __future__ import annotations

import argparse
import csv
import math
import os
from pathlib import Path
import shutil
import sys


def die(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def parse_time(row: dict[str, str]) -> float:
    value = (row.get("time_seconds") or "").strip()
    if not value:
        return math.nan
    try:
        return float(value)
    except ValueError:
        return math.nan


def group_rows(rows: list[dict[str, str]], gap: float) -> list[dict[str, str]]:
    if not rows:
        return []

    kept: list[dict[str, str]] = []
    burst_last = rows[0]
    prev_time = parse_time(rows[0])

    for row in rows[1:]:
        current = parse_time(row)
        if math.isnan(prev_time) or math.isnan(current) or (current - prev_time) > gap:
            kept.append(burst_last)
        burst_last = row
        prev_time = current

    kept.append(burst_last)
    return kept


def link_or_copy(src: Path, dst: Path) -> None:
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="既に抽出済みの対戦画像を、動画を再読込せず時間間隔だけで高速に絞り込む"
    )
    parser.add_argument("source", type=Path,
                        help="extract-battle-frames.py の出力ディレクトリ")
    parser.add_argument("--gap", type=float, default=1.0,
                        help="この秒数以内の連続画像を1操作にまとめる (default: 1.0)")
    parser.add_argument("--output", type=Path, default=None,
                        help="省略時は source/reduced_gap_X")
    args = parser.parse_args()

    source = args.source.resolve()
    manifest = source / "manifest.csv"
    frames = source / "frames"

    if not manifest.is_file():
        die(f"manifest.csv がありません: {manifest}")
    if not frames.is_dir():
        die(f"frames ディレクトリがありません: {frames}")

    with manifest.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    if not rows:
        die("manifest.csv にデータがありません。")

    kept = group_rows(rows, args.gap)

    gap_label = str(args.gap).replace(".", "p")
    out = args.output.resolve() if args.output else (source / f"reduced_gap_{gap_label}")
    out_frames = out / "frames"

    if out.exists():
        shutil.rmtree(out)
    out_frames.mkdir(parents=True)

    out_rows: list[dict[str, str]] = []
    for n, row in enumerate(kept, 1):
        src_name = row.get("file") or ""
        src = frames / src_name
        if not src.is_file():
            die(f"画像がありません: {src}")

        suffix = src.suffix.lower() or ".jpg"
        timecode = (row.get("timecode") or "unknown").replace(":", "-")
        dst_name = f"battle_{n:04d}_t{timecode}{suffix}"
        link_or_copy(src, out_frames / dst_name)

        new_row = dict(row)
        new_row["battle_no"] = str(n)
        new_row["file"] = dst_name
        out_rows.append(new_row)

    fieldnames = list(rows[0].keys())
    if "battle_no" not in fieldnames:
        fieldnames.insert(0, "battle_no")
    if "file" not in fieldnames:
        fieldnames.append("file")

    out_manifest = out / "manifest.csv"
    with out_manifest.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(out_rows)

    print("完了（動画の再読込なし）")
    print(f"  元画像     : {len(rows)}")
    print(f"  gap        : {args.gap:.3f} 秒")
    print(f"  残した画像 : {len(kept)}")
    print(f"  出力       : {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

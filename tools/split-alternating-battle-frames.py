#!/usr/bin/env python3
"""Split extracted Mobunaga frames into alternating A/B groups without rereading MP4.

Typical recording workflow is:
  battle detail open -> close/list -> next battle detail -> close/list -> ...
After temporal burst reduction, this often leaves an alternating sequence.  This tool
creates two non-destructive groups (A=1st,3rd,5th..., B=2nd,4th,6th...) using hard
links when possible so the user can identify which group contains battle details.

No source video is read and no source images are modified.
"""

from __future__ import annotations

import argparse
import csv
import os
from pathlib import Path
import shutil
import sys


def die(message: str) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(1)


def link_or_copy(src: Path, dst: Path) -> None:
    try:
        os.link(src, dst)
    except OSError:
        shutil.copy2(src, dst)


def write_group(rows: list[dict[str, str]], source_frames: Path, out: Path) -> None:
    frames = out / "frames"
    frames.mkdir(parents=True, exist_ok=True)
    output_rows: list[dict[str, str]] = []

    for n, row in enumerate(rows, 1):
        src_name = (row.get("file") or "").strip()
        src = source_frames / src_name
        if not src.is_file():
            die(f"画像がありません: {src}")
        suffix = src.suffix.lower() or ".jpg"
        dst_name = f"frame_{n:04d}{suffix}"
        link_or_copy(src, frames / dst_name)
        new_row = dict(row)
        new_row["group_no"] = str(n)
        new_row["original_file"] = src_name
        new_row["file"] = dst_name
        output_rows.append(new_row)

    if output_rows:
        fieldnames = list(output_rows[0].keys())
        if "group_no" not in fieldnames:
            fieldnames.insert(0, "group_no")
        if "original_file" not in fieldnames:
            fieldnames.append("original_file")
        with (out / "manifest.csv").open("w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(output_rows)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="抽出済みフレームを奇数/偶数の2群に分け、対戦詳細側を確認しやすくする"
    )
    parser.add_argument("source", type=Path,
                        help="extract-battle-frames.py の出力ディレクトリ")
    parser.add_argument("--output", type=Path, default=None,
                        help="省略時は source/alternating")
    args = parser.parse_args()

    source = args.source.resolve()
    manifest = source / "manifest.csv"
    source_frames = source / "frames"
    if not manifest.is_file():
        die(f"manifest.csv がありません: {manifest}")
    if not source_frames.is_dir():
        die(f"frames がありません: {source_frames}")

    with manifest.open("r", encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        die("manifest.csv にデータがありません。")

    out = args.output.resolve() if args.output else (source / "alternating")
    if out.exists():
        shutil.rmtree(out)
    (out / "A").mkdir(parents=True)
    (out / "B").mkdir(parents=True)

    group_a = rows[0::2]
    group_b = rows[1::2]
    write_group(group_a, source_frames, out / "A")
    write_group(group_b, source_frames, out / "B")

    print("完了（動画の再読込なし・元画像変更なし）")
    print(f"  元フレーム : {len(rows)}")
    print(f"  A群        : {len(group_a)}  (1,3,5,...)")
    print(f"  B群        : {len(group_b)}  (2,4,6,...)")
    print(f"  確認先A    : {out / 'A' / 'frames'}")
    print(f"  確認先B    : {out / 'B' / 'frames'}")
    print("AとBの frame_0001.jpg を1枚ずつ開き、対戦詳細が並ぶ方を選んでください。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

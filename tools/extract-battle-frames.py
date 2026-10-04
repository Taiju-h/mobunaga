#!/usr/bin/env python3
"""Extract unique battle-report screens from a long screen recording.

Designed for the Mobunaga workflow where a battle entry is opened, closed, then the
next entry is opened. The script:
  1. extracts scene-change candidates with ffmpeg;
  2. builds tiny grayscale fingerprints in one ffmpeg pass;
  3. removes adjacent near-duplicates;
  4. removes a strictly-identical recurring UI screen (typically the list screen);
  5. writes numbered battle_*.jpg files and manifest.csv.

No Python packages are required. ffmpeg/ffprobe must be installed on the server.
Compatible with Ubuntu ffmpeg 4.2.x.
"""

from __future__ import annotations

import argparse
import csv
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys

SHOWINFO_RE = re.compile(r"pts_time:([0-9]+(?:\.[0-9]+)?)")
FP_WIDTH = 96
FP_HEIGHT = 54


def die(message: str, code: int = 1) -> None:
    print(f"ERROR: {message}", file=sys.stderr)
    raise SystemExit(code)


def require_command(name: str) -> None:
    if shutil.which(name) is None:
        die(f"{name} が見つかりません。apt install ffmpeg で導入してください。")


def run_scene_extract(video: Path, candidate_dir: Path, threshold: float, quality: int) -> list[float]:
    candidate_dir.mkdir(parents=True, exist_ok=True)
    pattern = candidate_dir / "candidate_%06d.jpg"

    # showinfo is intentionally after select so stderr contains one pts_time per output frame.
    vf = f"select='gt(scene,{threshold})',showinfo"
    cmd = [
        "ffmpeg", "-hide_banner", "-y", "-i", str(video),
        "-vf", vf,
        # ffmpeg 4.2 does not have -fps_mode. -vsync vfr is its compatible equivalent.
        "-vsync", "vfr",
        "-q:v", str(quality),
        str(pattern),
    ]
    print("[1/4] シーン変化を抽出しています…")
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print(proc.stderr[-8000:], file=sys.stderr)
        die("ffmpeg のシーン抽出に失敗しました。")

    times = [float(m.group(1)) for m in SHOWINFO_RE.finditer(proc.stderr)]
    files = sorted(candidate_dir.glob("candidate_*.jpg"))
    if not files:
        die("候補画像を1枚も抽出できませんでした。--scene-threshold を下げてください。")

    # Some ffmpeg builds may print extra showinfo records. Keep list lengths aligned safely.
    if len(times) < len(files):
        times.extend([math.nan] * (len(files) - len(times)))
    elif len(times) > len(files):
        times = times[: len(files)]

    print(f"      候補: {len(files)} 枚")
    return times


def load_fingerprints(candidate_dir: Path, count: int) -> list[bytes]:
    pattern = candidate_dir / "candidate_%06d.jpg"
    frame_bytes = FP_WIDTH * FP_HEIGHT
    cmd = [
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        "-framerate", "1", "-start_number", "1", "-i", str(pattern),
        "-vf", f"scale={FP_WIDTH}:{FP_HEIGHT},format=gray",
        "-f", "rawvideo", "-pix_fmt", "gray", "-",
    ]
    print("[2/4] 重複判定用の指紋を作っています…")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    assert proc.stdout is not None
    fingerprints: list[bytes] = []
    for _ in range(count):
        buf = proc.stdout.read(frame_bytes)
        if len(buf) != frame_bytes:
            break
        fingerprints.append(buf)
    _, stderr = proc.communicate()
    if proc.returncode != 0:
        die("指紋作成に失敗しました: " + stderr.decode("utf-8", "replace")[-2000:])
    if len(fingerprints) != count:
        die(f"候補 {count} 枚に対して指紋が {len(fingerprints)} 枚しか作れませんでした。")
    return fingerprints


def mae(a: bytes, b: bytes) -> float:
    """Mean absolute grayscale difference, 0..255."""
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def ahash64(fp: bytes) -> int:
    """Cheap 64-bit visual hash used only as a pre-filter before MAE."""
    # Sample an 8x8 grid from the 96x54 fingerprint.
    values: list[int] = []
    for gy in range(8):
        y = round(gy * (FP_HEIGHT - 1) / 7)
        row = y * FP_WIDTH
        for gx in range(8):
            x = round(gx * (FP_WIDTH - 1) / 7)
            values.append(fp[row + x])
    avg = sum(values) / 64.0
    result = 0
    for value in values:
        result = (result << 1) | int(value >= avg)
    return result


def bit_count(value: int) -> int:
    """Compatibility helper for Python versions without int.bit_count()."""
    return bin(value).count("1")


def find_recurring_ui(fps: list[bytes], threshold: float, minimum: int) -> set[int]:
    """Find a strictly repeated visual state anywhere in the candidate sequence.

    Typical target: the battle-list screen that reappears after every close. A fast
    64-bit hash rejects obviously different screens before the more expensive MAE.
    """
    hashes = [ahash64(fp) for fp in fps]
    clusters: list[dict[str, object]] = []

    for idx, fp in enumerate(fps):
        matched = False
        current_hash = hashes[idx]
        for cluster in clusters:
            rep_hash = int(cluster["hash"])
            # More than 6 differing bits is never strict enough for our recurring UI.
            if bit_count(current_hash ^ rep_hash) > 6:
                continue
            rep = cluster["rep"]
            assert isinstance(rep, bytes)
            if mae(fp, rep) <= threshold:
                members = cluster["members"]
                assert isinstance(members, list)
                members.append(idx)
                matched = True
                break
        if not matched:
            clusters.append({"hash": current_hash, "rep": fp, "members": [idx]})

    repeated: set[int] = set()
    for cluster in clusters:
        members = cluster["members"]
        assert isinstance(members, list)
        if len(members) >= minimum:
            repeated.update(int(i) for i in members)
    return repeated


def hms(seconds: float) -> str:
    if math.isnan(seconds):
        return "unknown"
    ms = int(round(seconds * 1000))
    hh, rem = divmod(ms, 3_600_000)
    mm, rem = divmod(rem, 60_000)
    ss, msec = divmod(rem, 1000)
    return f"{hh:02d}-{mm:02d}-{ss:02d}.{msec:03d}"


def main() -> int:
    parser = argparse.ArgumentParser(description="Mobunaga 対戦録画から対戦画面だけを抽出")
    parser.add_argument("video", type=Path, help="入力 MP4")
    parser.add_argument("--output", type=Path, required=True, help="出力ディレクトリ")
    parser.add_argument("--scene-threshold", type=float, default=0.055,
                        help="ffmpeg scene 閾値。取りこぼす場合は下げる (default: 0.055)")
    parser.add_argument("--adjacent-mae", type=float, default=2.4,
                        help="隣接候補を同一とみなす平均画素差 (default: 2.4)")
    parser.add_argument("--recurring-mae", type=float, default=0.85,
                        help="繰返しUIを同一とみなす厳格な平均画素差 (default: 0.85)")
    parser.add_argument("--recurring-min", type=int, default=4,
                        help="同じ画面がこの回数以上なら閉じた一覧画面扱い (default: 4)")
    parser.add_argument("--keep-recurring", action="store_true",
                        help="繰返しUI画面を削除せず残す")
    parser.add_argument("--jpeg-quality", type=int, default=2,
                        help="ffmpeg JPEG q:v (2=high quality, default: 2)")
    args = parser.parse_args()

    require_command("ffmpeg")
    require_command("ffprobe")

    video = args.video.resolve()
    if not video.is_file():
        die(f"動画がありません: {video}")

    out = args.output.resolve()
    candidate_dir = out / "_candidates"
    frame_dir = out / "frames"
    if out.exists():
        shutil.rmtree(out)
    candidate_dir.mkdir(parents=True)
    frame_dir.mkdir(parents=True)

    times = run_scene_extract(video, candidate_dir, args.scene_threshold, args.jpeg_quality)
    candidates = sorted(candidate_dir.glob("candidate_*.jpg"))
    fingerprints = load_fingerprints(candidate_dir, len(candidates))

    print("[3/4] 隣接重複と繰返し一覧画面を除外しています…")
    adjacent_dupes: set[int] = set()
    previous_kept: int | None = None
    for i, fp in enumerate(fingerprints):
        if previous_kept is not None and mae(fp, fingerprints[previous_kept]) <= args.adjacent_mae:
            adjacent_dupes.add(i)
        else:
            previous_kept = i

    recurring: set[int] = set()
    if not args.keep_recurring:
        recurring = find_recurring_ui(fingerprints, args.recurring_mae, args.recurring_min)

    accepted = [i for i in range(len(candidates)) if i not in adjacent_dupes and i not in recurring]

    rows: list[dict[str, str]] = []
    for battle_no, i in enumerate(accepted, 1):
        t = times[i]
        stamp = hms(t)
        dst_name = f"battle_{battle_no:04d}_t{stamp}.jpg"
        shutil.copy2(candidates[i], frame_dir / dst_name)
        rows.append({
            "battle_no": str(battle_no),
            "time_seconds": "" if math.isnan(t) else f"{t:.3f}",
            "timecode": stamp,
            "file": dst_name,
            "source_candidate": candidates[i].name,
        })

    manifest = out / "manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["battle_no", "time_seconds", "timecode", "file", "source_candidate"],
        )
        writer.writeheader()
        writer.writerows(rows)

    # Temporary candidates are no longer needed after final battle frames are copied.
    shutil.rmtree(candidate_dir)

    print("[4/4] 完了")
    print(f"      シーン候補       : {len(candidates)}")
    print(f"      隣接重複を除外   : {len(adjacent_dupes)}")
    print(f"      繰返しUIを除外   : {len(recurring)}")
    print(f"      対戦候補         : {len(accepted)}")
    print(f"      画像              : {frame_dir}")
    print(f"      一覧              : {manifest}")
    print("\n一覧画面も残したい場合は --keep-recurring を付けて再実行できます。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

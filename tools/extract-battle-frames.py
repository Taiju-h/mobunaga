#!/usr/bin/env python3
"""Extract likely battle-report screens from a long screen recording.

Workflow assumption:
  - a battle entry is opened;
  - it is left visible briefly;
  - it is closed;
  - the next battle entry is opened.

The important part is not to keep every ffmpeg scene-change frame. One click/open or
close action can create many scene-change frames because of animation, scrolling,
hover effects and compression noise. We therefore group scene changes that happen
close together in time into one "burst" and keep only the last frame of each burst.
After that we remove adjacent near-duplicates and strictly recurring UI screens.

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

    vf = f"select='gt(scene,{threshold})',showinfo"
    cmd = [
        "ffmpeg", "-hide_banner", "-y", "-i", str(video),
        "-vf", vf,
        "-vsync", "vfr",  # ffmpeg 4.2 compatible
        "-q:v", str(quality),
        str(pattern),
    ]
    print("[1/5] シーン変化を抽出しています…")
    proc = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True)
    if proc.returncode != 0:
        print(proc.stderr[-8000:], file=sys.stderr)
        die("ffmpeg のシーン抽出に失敗しました。")

    times = [float(m.group(1)) for m in SHOWINFO_RE.finditer(proc.stderr)]
    files = sorted(candidate_dir.glob("candidate_*.jpg"))
    if not files:
        die("候補画像を1枚も抽出できませんでした。--scene-threshold を下げてください。")

    if len(times) < len(files):
        times.extend([math.nan] * (len(files) - len(times)))
    elif len(times) > len(files):
        times = times[: len(files)]

    print(f"      シーン候補: {len(files)} 枚")
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
    print("[2/5] 重複判定用の指紋を作っています…")
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


def group_scene_bursts(times: list[float], gap_seconds: float) -> list[int]:
    """Collapse rapid scene changes into one representative frame per click/animation burst.

    The last scene-change frame in each burst is normally the closest one to the stable
    state the user actually stopped on.
    """
    if not times:
        return []

    representatives: list[int] = []
    burst_last = 0
    prev_time = times[0]

    for i in range(1, len(times)):
        current = times[i]
        if math.isnan(prev_time) or math.isnan(current) or (current - prev_time) > gap_seconds:
            representatives.append(burst_last)
        burst_last = i
        prev_time = current

    representatives.append(burst_last)
    return representatives


def mae(a: bytes, b: bytes) -> float:
    return sum(abs(x - y) for x, y in zip(a, b)) / len(a)


def ahash64(fp: bytes) -> int:
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
    return bin(value).count("1")


def find_recurring_ui(indices: list[int], fps: list[bytes], threshold: float, minimum: int) -> set[int]:
    """Find strictly repeated stable screens among burst representatives.

    This is aimed at the list screen shown after closing each battle. Because we run
    this only after temporal burst reduction, we no longer classify thousands of
    animation frames as separate screens.
    """
    clusters: list[dict[str, object]] = []

    for idx in indices:
        fp = fps[idx]
        current_hash = ahash64(fp)
        matched = False
        for cluster in clusters:
            rep_hash = int(cluster["hash"])
            if bit_count(current_hash ^ rep_hash) > 6:
                continue
            rep_idx = int(cluster["rep_idx"])
            if mae(fp, fps[rep_idx]) <= threshold:
                members = cluster["members"]
                assert isinstance(members, list)
                members.append(idx)
                matched = True
                break
        if not matched:
            clusters.append({"hash": current_hash, "rep_idx": idx, "members": [idx]})

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
    parser.add_argument("--burst-gap", type=float, default=0.75,
                        help="この秒数以内の連続シーン変化を1操作にまとめる (default: 0.75)")
    parser.add_argument("--adjacent-mae", type=float, default=2.4,
                        help="隣接した安定画面を同一とみなす平均画素差 (default: 2.4)")
    parser.add_argument("--recurring-mae", type=float, default=0.85,
                        help="繰返しUIを同一とみなす厳格な平均画素差 (default: 0.85)")
    parser.add_argument("--recurring-min", type=int, default=4,
                        help="同じ安定画面がこの回数以上なら繰返しUI扱い (default: 4)")
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

    print("[3/5] 時間的に連続した画面変化を1操作にまとめています…")
    burst_reps = group_scene_bursts(times, args.burst_gap)
    print(f"      操作バースト代表: {len(burst_reps)} 枚")

    print("[4/5] 隣接重複と繰返し一覧画面を除外しています…")
    adjacent_dupes: set[int] = set()
    previous_kept: int | None = None
    for idx in burst_reps:
        if previous_kept is not None and mae(fingerprints[idx], fingerprints[previous_kept]) <= args.adjacent_mae:
            adjacent_dupes.add(idx)
        else:
            previous_kept = idx

    after_adjacent = [idx for idx in burst_reps if idx not in adjacent_dupes]
    recurring: set[int] = set()
    if not args.keep_recurring:
        recurring = find_recurring_ui(after_adjacent, fingerprints, args.recurring_mae, args.recurring_min)

    accepted = [idx for idx in after_adjacent if idx not in recurring]

    rows: list[dict[str, str]] = []
    for battle_no, idx in enumerate(accepted, 1):
        t = times[idx]
        stamp = hms(t)
        dst_name = f"battle_{battle_no:04d}_t{stamp}.jpg"
        shutil.copy2(candidates[idx], frame_dir / dst_name)
        rows.append({
            "battle_no": str(battle_no),
            "time_seconds": "" if math.isnan(t) else f"{t:.3f}",
            "timecode": stamp,
            "file": dst_name,
            "source_candidate": candidates[idx].name,
        })

    manifest = out / "manifest.csv"
    with manifest.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["battle_no", "time_seconds", "timecode", "file", "source_candidate"],
        )
        writer.writeheader()
        writer.writerows(rows)

    shutil.rmtree(candidate_dir)

    print("[5/5] 完了")
    print(f"      シーン候補       : {len(candidates)}")
    print(f"      操作バースト代表 : {len(burst_reps)}")
    print(f"      隣接重複を除外   : {len(adjacent_dupes)}")
    print(f"      繰返しUIを除外   : {len(recurring)}")
    print(f"      対戦候補         : {len(accepted)}")
    print(f"      画像              : {frame_dir}")
    print(f"      一覧              : {manifest}")
    print("\n多すぎる場合は --burst-gap 1.0、少なすぎる場合は --burst-gap 0.5 で再実行できます。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

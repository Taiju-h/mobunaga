#!/usr/bin/env python3
"""Inventory DiscordKit land exports in a PRIVATE work directory, never public assets.
Only attachment images are collected. Avatars/user names and raw HTML are not published.
Redaction and manual review are separate prerequisites for public import.
"""
import argparse, concurrent.futures, hashlib, json, re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

class Attachments(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = {}
    def handle_starttag(self, tag, attrs):
        if tag != 'img':
            return
        src = dict(attrs).get('src', '')
        u = urlsplit(src)
        if u.scheme == 'https' and u.hostname in ('cdn.discordapp.com', 'media.discordapp.net') and '/attachments/' in u.path:
            self.urls[u.path] = src

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--download', action='store_true')
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if args.output.resolve().is_relative_to(root):
        parser.error('Private source images must be outside the repository until redacted and reviewed.')
    args.output.mkdir(parents=True, exist_ok=True)
    summary, pending = [], []
    for file in args.files:
        level = re.search(r'土地([5-8])', file.name)
        if not level:
            parser.error('Expected a land 5–8 export filename')
        level = int(level[1]); text = file.read_text(); html = Attachments(); html.feed(text)
        entry = {'level': level, 'source_sha256': hashlib.sha256(file.read_bytes()).hexdigest(),
                 'messages': int(re.search(r'Exported (\d+) message', text)[1]),
                 'attachment_images': len(html.urls), 'downloaded': 0,
                 'status': 'pending_redaction_and_fact_review', 'published': False}
        summary.append(entry)
        for i, url in enumerate(html.urls.values(), 1):
            pending.append((entry, args.output / f'land{level}-{i:03d}.source', url))
    def download(item):
        entry, dest, url = item
        try:
            with urlopen(Request(url, headers={'User-Agent': 'Mozilla/5.0'}), timeout=20) as response:
                data = response.read(20 * 1024 * 1024 + 1)
                if len(data) > 20 * 1024 * 1024 or not response.headers.get('Content-Type', '').startswith('image/'):
                    return entry, False
                dest.write_bytes(data)
            return entry, True
        except Exception:
            return entry, False
    if args.download:
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            for entry, ok in pool.map(download, pending):
                entry['downloaded'] += int(ok)
    (args.output / 'manifest.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(summary, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()

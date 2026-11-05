"""Generate gallery thumbnails from the public Azure originals. Originals are never modified."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
import hashlib
import json
from pathlib import Path
import time
from urllib.parse import urlparse
from urllib.request import urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'assets' / 'artwork.js'
CACHE = ROOT / '.cache' / 'art-originals'
OUTPUT = ROOT / 'assets' / 'thumbnails'


def generate(art, refresh=False):
    url = art['src']
    if urlparse(url).scheme != 'https' or urlparse(url).hostname != 'noxkuuimages.blob.core.windows.net':
        raise ValueError('Unexpected image host: ' + url)
    image_id = hashlib.sha256(url.encode()).hexdigest()[:16]
    cached = CACHE / image_id
    if refresh or not cached.exists():
        for attempt in range(3):
            try:
                with urlopen(url, timeout=60) as response:
                    raw = response.read(40 * 1024 * 1024 + 1)
                if len(raw) > 40 * 1024 * 1024:
                    raise ValueError('Original is larger than 40 MB')
                cached.write_bytes(raw)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
    raw = cached.read_bytes()
    output = OUTPUT / (image_id + '.webp')
    with Image.open(BytesIO(raw)) as original:
        image = ImageOps.exif_transpose(original)
        image.thumbnail((800, 1000), Image.Resampling.LANCZOS)
        if image.mode not in ('RGB', 'RGBA'):
            image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
        options = {'icc_profile': image.info['icc_profile']} if image.info.get('icc_profile') else {}
        image.save(output, 'WEBP', quality=82, method=6, **options)
        width, height = image.size
    with Image.open(output) as check:
        check.verify()
    return {**art, 'thumbnail': '/assets/thumbnails/' + output.name,
            'thumbnailWidth': width, 'thumbnailHeight': height}, len(raw), output.stat().st_size


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Download originals again, even when cached')
    args = parser.parse_args()
    text = DATA.read_text(encoding='utf-8')
    comment, encoded = text.split('export const artwork = ', 1)
    artwork = json.loads(encoded.strip().removesuffix(';'))
    CACHE.mkdir(parents=True, exist_ok=True)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda art: generate(art, args.refresh), artwork))
    # Only update the catalogue once every image has downloaded and converted successfully.
    DATA.write_text(comment + 'export const artwork = ' + json.dumps(
        [result[0] for result in results], ensure_ascii=False, indent=2) + ';\n', encoding='utf-8', newline='\n')
    original_bytes = sum(result[1] for result in results)
    thumbnail_bytes = sum(result[2] for result in results)
    print(json.dumps({'images': len(results), 'original_bytes': original_bytes,
                      'thumbnail_bytes': thumbnail_bytes,
                      'reduction_percent': round(100 * (1 - thumbnail_bytes / original_bytes), 1)}, indent=2))


if __name__ == '__main__':
    main()

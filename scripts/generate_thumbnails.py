"""Generate small gallery thumbnails and sharper viewing WebPs from public Azure originals."""
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
VARIANTS = [('thumbnail', 'thumbnails', (800, 1000), 82),
            ('display', 'views', (2000, 2000), 88)]


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
    result = dict(art)
    sizes = {}
    with Image.open(BytesIO(raw)) as original:
        source = ImageOps.exif_transpose(original)
        if source.mode not in ('RGB', 'RGBA'):
            source = source.convert('RGBA' if 'transparency' in source.info else 'RGB')
        for field, folder, bounds, quality in VARIANTS:
            output = ROOT / 'assets' / folder / (image_id + '.webp')
            if refresh or not output.exists():
                image = source.copy()
                image.thumbnail(bounds, Image.Resampling.LANCZOS)
                options = {'icc_profile': source.info['icc_profile']} if source.info.get('icc_profile') else {}
                image.save(output, 'WEBP', quality=quality, method=6, **options)
            with Image.open(output) as check:
                width, height = check.size
                check.verify()
            result.update({field: '/assets/' + folder + '/' + output.name,
                           field + 'Width': width, field + 'Height': height})
            sizes[field] = output.stat().st_size
    return result, len(raw), sizes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--refresh', action='store_true', help='Download originals again and regenerate both sizes')
    args = parser.parse_args()
    comment, encoded = DATA.read_text(encoding='utf-8').split('export const artwork = ', 1)
    artwork = json.loads(encoded.strip().removesuffix(';'))
    CACHE.mkdir(parents=True, exist_ok=True)
    for _, folder, _, _ in VARIANTS:
        (ROOT / 'assets' / folder).mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda art: generate(art, args.refresh), artwork))
    # Only replace the catalogue after every image has converted and verified successfully.
    DATA.write_text(comment + 'export const artwork = ' + json.dumps(
        [result[0] for result in results], ensure_ascii=False, indent=2) + ';\n',
        encoding='utf-8', newline='\n')
    original_bytes = sum(result[1] for result in results)
    view_bytes = sum(result[2]['display'] for result in results)
    print(json.dumps({'images': len(results), 'original_bytes': original_bytes,
                      'thumbnail_bytes': sum(result[2]['thumbnail'] for result in results),
                      'view_bytes': view_bytes,
                      'view_reduction_percent': round(100 * (1 - view_bytes / original_bytes), 1)}, indent=2))


if __name__ == '__main__':
    main()

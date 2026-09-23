#!/usr/bin/env python3
"""Fetch reference photos from Wikimedia Commons for squares that are not
species, or whose species iNaturalist could not supply.

Every file below was picked by eye from Commons search results; see
docs/08-reference-photos.md. The licence and author are read from each file's
Commons page at fetch time, and anything not cc0 / cc-by / cc-by-sa / public
domain is refused. Writes JPEGs with a 360px short side (the re-encode drops
EXIF) and updates the pack's photo and credits fields.

Uses file pages and thumbnail URLs rather than the Action API, which rate
limits shared cloud addresses hard.

Usage: python3 tools/fetch-commons-references.py     (needs Pillow)
"""
import hashlib, html, io, json, os, re, sys, time, urllib.parse, urllib.request
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'app', 'packs')
UA = 'SpringoRefFetch/1.0 (https://github.com/jserfass-glitch/claude-springo) python-urllib'
OPEN = re.compile(r'^(cc0|public domain|cc by(-sa)? [\d.]+)', re.I)
SHORT = 360
# where the file page names no person
AUTHOR = {'deer-crossing': 'Federal Highway Administration'}

PICKS = {
    'road-trip': {
        'water-tower': 'Cameron_North_Carolina_Water_Tower.jpg',
        'hay-bale': 'Roundbale1.jpg',
        'grain-silo': 'Grain_bins_in_Cashton,_Wisconsin.jpg',
        'hawk-on-a-wire': 'Red-tailed_Hawk_(45812546121).jpg',
        'barn-quilt': 'Grundy_Center_Barn.jpg',
        'armadillo': 'Nine-banded_armadillo_(13594).jpg',
        'church-steeple': 'White_Steeple_Gallery_Church,_Silverton_-_DPLA_-_a53db88afaa102d2c1c20556ddbd594c.jpg',
        'cattle-in-shade': 'Herd_of_cattle_sheltering_under_the_shade_of_a_tree,_Torry_Hill_-_geograph.org.uk_-_6559929.jpg',
        'fireworks-stand': 'TNT_Fireworks_Stand_Stockton,_California.jpg',
        'vanity-plate': 'Michigan_2010_Vanity_License_Plate_VANITAS.jpg',
        'tractor-crossing': 'Ford_8N.jpg',
        'kudzu': 'Kudzu_on_trees_in_Atlanta,_Georgia.jpg',
        'rusted-pickup': 'Truck_of_Many_Colors,_UT_8-25-12_(15257791381).jpg',
        'gazebo': 'Gazebo_in_Town_Square_Park,_Mountain_Grove,_MO.jpg',
        'dairy-queen': 'Dairy_Queen,_Stratford,_Ontario,_2025-08-04.jpg',
        'crop-duster': 'CROP_DUSTER_PLANE_OVER_IMPERIAL_VALLEY_FARMS_-_NARA_-_548883.jpg',
        'river-bridge': 'Fourth_Street_Bridge,_truss_bridge_over_the_Arkansas_River,_Cañon_City,_Colorado.jpg',
        'turkey-vulture': 'Turkey_vulture_(Cathartes_aura)_in_flight.JPG',
        'antique-mall': 'Antique_Mall_Exit_57,_Springfield_OH.jpg',
        'grain-elevator': 'Grain_elevator_greensburg_kansas_2007.jpg',
        'now-hiring': '"Now_Hiring"_Sign.jpg',
        'ditch-wildflowers': 'Roadside_wildflowers,_Littleton_-_geograph.org.uk_-_1978461.jpg',
        'deer-crossing': 'MUTCD_W11-3.svg',
        'combine': 'Corn_combine_harvest_with_grain_cart-4.jpg',
    },
    'ozark-fall': {
        'sassafras': 'Sassafras_albidum—unlobed,_bilobed,_trilobed_leaves.jpg',
        'black-walnut': 'Black_Walnut_nut_and_leave_detail.JPG',
        'beaver-sign': 'Beaver_Chewed_Tree_1_20160807.jpg',
    },
}


def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def thumb(name, width):
    h = hashlib.md5(name.encode()).hexdigest()
    q = urllib.parse.quote(name)
    ext = '.png' if name.lower().endswith('.svg') else ''
    return f'https://thumb.wikimedia.org/wikipedia/commons/thumb/{h[0]}/{h[:2]}/{q}/{width}px-{q}{ext}'


def text(fragment):
    fragment = re.sub(r'<style[^>]*>.*?</style>', ' ', fragment, flags=re.S)
    t = html.unescape(re.sub(r'<[^>]+>', ' ', fragment))
    return re.sub(r'\s+', ' ', t).strip()


def credit(name):
    page = get('https://commons.wikimedia.org/wiki/File:' + urllib.parse.quote(name)).decode()
    licences = [text(m) for m in re.findall(r'licensetpl(?:&#95;|_)short"[^>]*>(.*?)</span>', page)]
    lic = next((l for l in licences if OPEN.match(l)), None)
    m = re.search(r'id="fileinfotpl(?:&#95;|_)aut"[^>]*>.*?</td>\s*<td[^>]*>(.*?)</td>', page, re.S)
    by = text(m.group(1)) if m else ''
    by = re.split(r'\s*(?:\bfrom\b|\(|,\s*https?:|\bTalk\b|\bDescription\b|\bLogo design\b|\bDate of birth\b|\bAlternative names\b)', by)[0]
    by = re.sub(r'^Photo by\s+', '', by).strip() or 'Wikimedia Commons'
    return lic, by[:48], licences


def main():
    for pack_id, picks in PICKS.items():
        path = os.path.join(ROOT, pack_id + '.json')
        raw = open(path).read()
        pack = json.loads(raw)
        out_dir = os.path.join(ROOT, pack_id)
        os.makedirs(out_dir, exist_ok=True)
        pack['photoDir'] = f'packs/{pack_id}/'
        pack.setdefault('credits', {})
        items = {i['key']: i for i in pack['items'] if i.get('key')}
        for key, name in picks.items():
            lic, by, seen = credit(name)
            if not lic:
                print(f'SKIP {key}: no open licence in {seen}', file=sys.stderr)
                continue
            data = None
            for w in (960, 500, 330):
                try:
                    data = get(thumb(name, w)); break
                except Exception:
                    time.sleep(0.5)
            if not data:
                print(f'SKIP {key}: no thumbnail', file=sys.stderr)
                continue
            im = Image.open(io.BytesIO(data))
            if im.mode in ('RGBA', 'LA', 'P'):
                im = im.convert('RGBA')
                bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[-1]); im = bg
            im = im.convert('RGB')
            s = SHORT / min(im.size)
            if s < 1:
                im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
            im.save(os.path.join(out_dir, key + '.jpg'), 'JPEG', quality=80, optimize=True, progressive=True)
            items[key]['photo'] = key + '.jpg'
            pack['credits'][key] = [AUTHOR.get(key, by), lic, 'Wikimedia Commons']
            print(f'{pack_id}/{key}.jpg  {im.size}  {lic}  {by}')
            time.sleep(0.4)
        with open(path, 'w') as f:
            f.write(json.dumps(pack, indent=0, ensure_ascii=False) + ('\n' if raw.endswith('\n') else ''))


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Fetch open-licensed reference photos for a pack from iNaturalist.

Research-grade observations, flowering phenology where available, filtered to
cc0 / cc-by / cc-by-sa so the images stay usable if the app is ever monetised.
Writes 300px JPEGs plus credits.json. The re-encode also drops EXIF.

See docs/08-reference-photos.md for what this measured: roughly 75 percent of
results are usable without a human looking at them.

Usage: python3 tools/fetch-references.py     (needs Pillow)
"""
import json, time, urllib.request, urllib.parse, io, os
from PIL import Image
OUT="/home/user/kings-river-media/prototype/ref"
UA="SpringoPrototype/0.1 (design prototype; contact via github.com/jserfass-glitch)"
OK={"cc0","cc-by","cc-by-sa"}
# term_id 12 = Plant Phenology, term_value_id 13 = Flowering
PHENO="&term_id=12&term_value_id=13"
ITEMS=[("trout-lily","Trout Lily","Erythronium americanum"),
 ("bloodroot","Bloodroot","Sanguinaria canadensis"),
 ("spring-beauty","Spring Beauty","Claytonia virginica"),
 ("dutchmans-breeches","Dutchman's Breeches","Dicentra cucullaria"),
 ("mayapple","Mayapple","Podophyllum peltatum"),
 ("virginia-bluebell","Virginia Bluebell","Mertensia virginica"),
 ("trillium","Trillium","Trillium recurvatum"),
 ("rue-anemone","Rue Anemone","Thalictrum thalictroides"),
 ("wild-ginger","Wild Ginger","Asarum canadense"),
 ("jack-in-the-pulpit","Jack-in-the-Pulpit","Arisaema triphyllum"),
 ("cutleaf-toothwort","Cutleaf Toothwort","Cardamine concatenata"),
 ("blue-eyed-mary","Blue-eyed Mary","Collinsia verna"),
 ("celandine-poppy","Celandine Poppy","Stylophorum diphyllum"),
 ("shooting-star","Shooting Star","Primula meadia"),
 ("wood-betony","Wood Betony","Pedicularis canadensis"),
 ("hepatica","Hepatica","Anemone acutiloba"),
 ("fire-pink","Fire Pink","Silene virginica"),
 ("wild-blue-phlox","Wild Blue Phlox","Phlox divaricata"),
 ("green-dragon","Green Dragon","Arisaema dracontium"),
 ("yellow-violet","Yellow Violet","Viola pubescens"),
 ("ozark-wake-robin","Ozark Wake Robin","Trillium pusillum"),
 ("pawpaw-bloom","Pawpaw Bloom","Asimina triloba"),
 ("false-rue-anemone","False Rue Anemone","Enemion biternatum"),
 ("bishops-cap","Bishop's Cap","Mitella diphylla")]
def get(u): return urllib.request.urlopen(urllib.request.Request(u,headers={"User-Agent":UA}),timeout=40).read()
man=[]; misses=[]
for slug,name,sci in ITEMS:
    q=urllib.parse.quote(sci); picked=None
    for extra in (PHENO, ""):           # flowering first, any phase as fallback
        try:
            u=(f"https://api.inaturalist.org/v1/observations?taxon_name={q}"
               f"&photo_license=cc0%2Ccc-by%2Ccc-by-sa&quality_grade=research"
               f"{extra}&order_by=votes&per_page=8")
            for o in json.loads(get(u)).get("results",[]):
                for p in o.get("photos",[]) or []:
                    if (p.get("license_code") or "").lower() in OK:
                        picked=(p,o,bool(extra)); break
                if picked: break
        except Exception as e: print("ERR",slug,repr(e)[:90])
        if picked: break
        time.sleep(.4)
    if not picked: misses.append(slug); print("MISS",slug); continue
    p,o,flowering=picked
    try:
        raw=get((p.get("url") or "").replace("square","medium"))
        im=Image.open(io.BytesIO(raw)).convert("RGB"); s=min(im.size)
        im=im.crop(((im.width-s)//2,(im.height-s)//2,(im.width+s)//2,(im.height+s)//2)).resize((300,300),Image.LANCZOS)
        path=os.path.join(OUT,slug+".jpg"); im.save(path,"JPEG",quality=72,optimize=True)
        man.append({"slug":slug,"name":name,"sci":sci,"license":p.get("license_code"),
          "by":(o.get("user") or {}).get("login","iNaturalist contributor"),
          "obs":o.get("id"),"photo_id":p.get("id"),"flowering":flowering,
          "bytes":os.path.getsize(path)})
        print(f"{'FLW' if flowering else 'any'} {slug:22} {p.get('license_code'):8} {os.path.getsize(path):>6}b")
    except Exception as e: print("IMGERR",slug,repr(e)[:90])
    time.sleep(.6)
json.dump(man,open(os.path.join(OUT,"credits.json"),"w"),indent=1)
print(f"\n{len(man)} images, {sum(m['bytes'] for m in man)//1024} KB, "
      f"{sum(1 for m in man if m['flowering'])} matched the flowering filter")

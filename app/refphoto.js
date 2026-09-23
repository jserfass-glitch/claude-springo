// Reference photos for generated lists, looked up from the browser.
//
// Species come from iNaturalist: research grade, flowering first. Anything
// else, or a species iNaturalist cannot supply, gets the lead photo of its
// Wikipedia article, or failing that the first Commons search hit. Open
// licences only, because a CC BY-NC photo breaks the moment this app charges
// for anything. See docs/08-reference-photos.md.

const INAT_OPEN = new Set(['cc0', 'cc-by', 'cc-by-sa']);
const COMMONS_OPEN = /^(cc0|public domain|cc by(-sa)? [\d.]+)/i;
const WIKI = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*';
const COMMONS = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*';
const META = '&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&iiextmetadatafilter=LicenseShortName|Artist';

async function getJson(url) {
  try {
    const r = await fetch(url);
    return r.ok ? await r.json() : null;
  } catch { return null; }   // offline or blocked: the sheet hides the pane
}

async function inatPhoto(sci) {
  const base = 'https://api.inaturalist.org/v1/observations'
    + '?photo_license=cc0%2Ccc-by%2Ccc-by-sa&quality_grade=research&order_by=votes&per_page=6'
    + '&taxon_name=' + encodeURIComponent(sci);
  for (const extra of ['&term_id=12&term_value_id=13', '']) {   // flowering first
    const j = await getJson(base + extra);
    for (const o of j?.results || []) {
      for (const ph of o.photos || []) {
        if (INAT_OPEN.has(String(ph.license_code || '').toLowerCase())) {
          return { url: String(ph.url || '').replace('square', 'medium'),
                   credit: [o.user?.login || 'iNaturalist', ph.license_code] };
        }
      }
    }
  }
  return null;
}

const plain = s => String(s || '').replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/\s+/g, ' ').trim().slice(0, 48);

function fromCommons(page) {
  const info = page?.imageinfo?.[0];
  const lic = String(info?.extmetadata?.LicenseShortName?.value || '').trim();
  if (!info?.thumburl || !COMMONS_OPEN.test(lic)) return null;
  return { url: info.thumburl,
           credit: [plain(info.extmetadata?.Artist?.value) || 'Wikimedia Commons', lic, 'Wikimedia Commons'] };
}

async function commonsPhoto(query) {
  // an exact article first: its lead photo is usually the canonical picture
  const w = await getJson(`${WIKI}&redirects=1&prop=pageimages&piprop=name&pilicense=free&titles=${encodeURIComponent(query)}`);
  // "Barn quilt" redirects to a section of "Quilt", whose photo is a quilt
  const toSection = w?.query?.redirects?.some(r => r.tofragment);
  const name = !toSection && w?.query?.pages?.[0]?.pageimage;
  if (name) {
    const f = await getJson(`${COMMONS}${META}&titles=${encodeURIComponent('File:' + name)}`);
    const got = fromCommons(f?.query?.pages?.[0]);
    if (got) return got;
  }
  const s = await getJson(`${COMMONS}${META}&generator=search&gsrnamespace=6&gsrlimit=6`
    + `&gsrsearch=${encodeURIComponent(query + ' filetype:bitmap')}`);
  const hits = (s?.query?.pages || []).sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  for (const p of hits) { const got = fromCommons(p); if (got) return got; }
  return null;
}

/** { url, credit: [by, licence, source?] } or null. Never throws. */
export async function findRefPhoto(item) {
  if (item.sci) {
    const got = await inatPhoto(item.sci) || await commonsPhoto(item.sci);
    if (got) return got;
  }
  return commonsPhoto(item.label);
}

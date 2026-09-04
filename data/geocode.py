import json, time, urllib.request, urllib.parse, os, sys
MAX = int(sys.argv[sys.argv.index('--max')+1]) if '--max' in sys.argv else 10**9
d = json.load(open('stations.json'))
cache = json.load(open('geocache.json')) if os.path.exists('geocache.json') else {}
todo = [s for s in d['stations'] if not s['city'] and f"{s['lat']:.4f},{s['lon']:.4f}" not in cache][:MAX]
print('a geocodificar:', len(todo), flush=True)
for i, s in enumerate(todo):
    key = f"{s['lat']:.4f},{s['lon']:.4f}"
    if key not in cache:
        url = 'https://nominatim.openstreetmap.org/reverse?' + urllib.parse.urlencode({'lat': s['lat'], 'lon': s['lon'], 'format': 'jsonv2', 'zoom': 14, 'accept-language': 'pt-BR'})
        req = urllib.request.Request(url, headers={'User-Agent': 'EletropostosBrasil-build/1.0 (spartanti.com.br)'})
        try:
            r = json.load(urllib.request.urlopen(req, timeout=30))
            a = r.get('address', {})
            cache[key] = {'city': a.get('city') or a.get('town') or a.get('municipality') or a.get('village') or a.get('county') or '',
                          'uf': a.get('ISO3166-2-lvl4', '').replace('BR-', ''), 'road': a.get('road', ''), 'suburb': a.get('suburb', ''), 'cep': a.get('postcode', '')}
        except Exception as e:
            cache[key] = {'err': str(e)}
        time.sleep(1.1)
        if i % 25 == 0:
            json.dump(cache, open('geocache.json', 'w'), ensure_ascii=False); print(i, key, cache[key], flush=True)
json.dump(cache, open('geocache.json', 'w'), ensure_ascii=False)
print('done', len(cache), flush=True)

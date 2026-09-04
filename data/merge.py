#!/usr/bin/env python3
"""Une OpenChargeMap (export por POI) + OpenStreetMap (Overpass) em um JSON compacto para o app."""
import json, glob, math, re, sys, datetime
from collections import Counter

ref = json.load(open('ocm-export/data/referencedata.json'))
OPS = {o['ID']: o['Title'] for o in ref['Operators']}
CT  = {c['ID']: c['Title'] for c in ref['ConnectionTypes']}
UT  = {u['ID']: u['Title'] for u in ref['UsageTypes']}
ST  = {s['ID']: (s['Title'], s.get('IsOperational')) for s in ref['StatusTypes']}
CUR = {c['ID']: c['Title'] for c in ref['CurrentTypes']}

UF = {'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA','Ceará':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Goiás':'GO','Maranhão':'MA','Mato Grosso':'MT','Mato Grosso do Sul':'MS','Minas Gerais':'MG','Pará':'PA','Paraíba':'PB','Paraná':'PR','Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ','Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO','Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE','Tocantins':'TO'}
UF_SIGLAS = set(UF.values())

def norm_uf(s):
    if not s: return ''
    s = s.strip()
    if s.upper() in UF_SIGLAS: return s.upper()
    for k, v in UF.items():
        if k.lower() == s.lower(): return v
    # tenta sem acento
    import unicodedata
    def strip(x): return ''.join(c for c in unicodedata.normalize('NFD', x) if unicodedata.category(c) != 'Mn').lower()
    for k, v in UF.items():
        if strip(k) == strip(s): return v
    m = re.search(r'\b([A-Z]{2})\b', s)
    if m and m.group(1) in UF_SIGLAS: return m.group(1)
    return ''

# Mapeamento de conectores para nomes curtos padronizados
def ocm_conn_name(title):
    t = (title or '').lower()
    if 'ccs (type 2)' in t: return 'CCS2'
    if 'ccs (type 1)' in t: return 'CCS1'
    if 'type 2' in t: return 'Tipo 2'
    if 'type 1' in t or 'j1772' in t: return 'Tipo 1'
    if 'chademo' in t: return 'CHAdeMO'
    if 'gb-t' in t or 'gb/t' in t: return 'GB/T'
    if 'tesla' in t: return 'Tesla'
    if 'cee' in t or 'iec 60309' in t: return 'Industrial'
    if 'nema' in t or 'schuko' in t or 'wall' in t or 'europlug' in t: return 'Tomada'
    return 'Outro'

OSM_SOCKETS = {
    'type2_combo': 'CCS2', 'type1_combo': 'CCS1', 'type2': 'Tipo 2', 'type2_cable': 'Tipo 2',
    'type1': 'Tipo 1', 'type1_cable': 'Tipo 1', 'chademo': 'CHAdeMO', 'gb_dc': 'GB/T', 'gb_ac': 'GB/T',
    'tesla_supercharger': 'Tesla', 'tesla_supercharger_ccs': 'CCS2', 'tesla_destination': 'Tesla', 'tesla_standard': 'Tesla',
    'cee_blue': 'Industrial', 'cee_red_16a': 'Industrial', 'cee_red_32a': 'Industrial', 'cee_red_63a': 'Industrial',
    'nema_5_15': 'Tomada', 'nema_5_20': 'Tomada', 'nema_14_50': 'Tomada', 'schuko': 'Tomada', 'nbr14136': 'Tomada', 'nbr14136_20a': 'Tomada', 'nbr14136_10a': 'Tomada',
}
DC = {'CCS2', 'CCS1', 'CHAdeMO', 'GB/T', 'Tesla'}

def parse_kw(v):
    if v is None: return None
    m = re.search(r'([\d.,]+)\s*(kw|w)?', str(v).lower())
    if not m: return None
    n = float(m.group(1).replace(',', '.'))
    if m.group(2) == 'w': n /= 1000
    return round(n, 1) if n > 0 else None

def tr_usage(u):
    u = u or ''
    if not u or u.startswith('('): return ''
    if u.startswith('Public - Membership'): return 'Público - requer cadastro/app'
    if u.startswith('Public - Pay'): return 'Público - pagamento no local'
    if u.startswith('Public - Notice'): return 'Público - aviso prévio'
    if u == 'Public': return 'Público'
    if u.startswith('Private - For Staff'): return 'Privado - clientes/visitantes'
    if u.startswith('Private'): return 'Privado - acesso restrito'
    return u

def tr_status(s):
    return {'Operational': 'Operacional', 'Not Operational': 'Fora de operação', 'Temporarily Unavailable': 'Temporariamente indisponível',
            'Partly Operational (Mixed)': 'Parcialmente operacional', 'Planned For Future Date': 'Planejado',
            'Currently Available (Automated Status)': 'Disponível agora', 'Currently In Use (Automated Status)': 'Em uso agora', 'Unknown': ''}.get(s or '', s or '')

stations = []
stats = Counter()

# ---------- OpenChargeMap ----------
for f in sorted(glob.glob('ocm-export/data/BR/*.json')):
    p = json.load(open(f))
    if p.get('SubmissionStatusTypeID', 200) not in (100, 200): stats['ocm_skip_status'] += 1; continue
    a = p.get('AddressInfo') or {}
    lat, lon = a.get('Latitude'), a.get('Longitude')
    if lat is None or lon is None: stats['ocm_skip_coord'] += 1; continue
    if not (-34.5 <= lat <= 6 and -74.5 <= lon <= -28): stats['ocm_skip_bbox'] += 1; continue
    conns = []
    for c in p.get('Connections') or []:
        name = ocm_conn_name(CT.get(c.get('ConnectionTypeID')))
        kw = c.get('PowerKW')
        cur = CUR.get(c.get('CurrentTypeID')) or ''
        conns.append({'t': name, 'kw': round(kw, 1) if kw else None, 'q': c.get('Quantity') or 1, 'dc': (name in DC) or cur == 'DC'})
    st_title, st_op = ST.get(p.get('StatusTypeID'), ('', None))
    op = OPS.get(p.get('OperatorID')) or ''
    if op.startswith('(') : op = ''
    op = re.sub(r'\s*\((BR|Brasil|Brazil)\)\s*$', '', op).strip()
    usage = UT.get(p.get('UsageTypeID')) or ''
    stations.append({
        'id': f"ocm-{p['ID']}",
        'src': 'ocm',
        'name': (a.get('Title') or '').strip() or (op or 'Eletroposto'),
        'addr': ', '.join(x.strip() for x in [a.get('AddressLine1') or '', a.get('AddressLine2') or ''] if x and x.strip()),
        'city': (a.get('Town') or '').strip(),
        'uf': norm_uf(a.get('StateOrProvince')),
        'cep': (a.get('Postcode') or '').strip(),
        'lat': round(lat, 6), 'lon': round(lon, 6),
        'op': op,
        'conns': conns,
        'points': max(p.get('NumberOfPoints') or 0, sum(c['q'] for c in conns) if conns else 0, 1),
        'usage': tr_usage(usage),
        'public': not usage.lower().startswith('private'),
        'status': tr_status(st_title),
        'operational': st_op,
        'cost': (p.get('UsageCost') or '').strip(),
        'phone': (a.get('ContactTelephone1') or '').strip(),
        'url': (a.get('RelatedURL') or '').strip(),
        'hours': '',
        'notes': (p.get('GeneralComments') or a.get('AccessComments') or '').strip(),
        'updated': (p.get('DateLastStatusUpdate') or p.get('DateCreated') or '')[:10],
    })
    stats['ocm'] += 1

# ---------- OpenStreetMap ----------
osm = json.load(open('overpass_raw.json'))['elements']
unmapped = Counter()
for e in osm:
    t = e.get('tags', {})
    lat = e.get('lat') or (e.get('center') or {}).get('lat')
    lon = e.get('lon') or (e.get('center') or {}).get('lon')
    if lat is None: stats['osm_skip_coord'] += 1; continue
    # só carros: ignora estações exclusivas de bicicleta/patinete
    if t.get('motorcar') == 'no' or (t.get('bicycle') == 'yes' and t.get('motorcar') is None and t.get('car') is None and not any(k.startswith('socket:type2') or k.startswith('socket:chademo') for k in t)):
        stats['osm_skip_bike'] += 1; continue
    conns = []
    for k, v in t.items():
        if not k.startswith('socket:') or k.count(':') != 1: continue
        sock = k.split(':', 1)[1]
        name = OSM_SOCKETS.get(sock)
        if not name:
            unmapped[sock] += 1; name = 'Outro'
        try: q = int(re.match(r'\d+', str(v)).group()) if re.match(r'\d+', str(v)) else 1
        except Exception: q = 1
        kw = parse_kw(t.get(f'{k}:output'))
        conns.append({'t': name, 'kw': kw, 'q': q, 'dc': name in DC})
    if not conns and t.get('charging_station:output'):
        conns.append({'t': 'Outro', 'kw': parse_kw(t.get('charging_station:output')), 'q': 1, 'dc': False})
    op = (t.get('operator') or t.get('brand') or t.get('network') or '').strip()
    addr = ', '.join(x for x in [
        ' '.join(y for y in [t.get('addr:street', ''), t.get('addr:housenumber', '')] if y),
        t.get('addr:suburb', '')] if x)
    access = t.get('access', '')
    fee = t.get('fee', '')
    usage = {'yes': 'Público', 'permissive': 'Público', 'customers': 'Clientes', 'private': 'Privado', 'no': 'Privado'}.get(access, 'Público' if access == '' else access)
    if fee == 'no': usage += ' - Gratuito'
    elif fee == 'yes': usage += ' - Pago'
    stations.append({
        'id': f"osm-{e['type'][0]}{e['id']}",
        'src': 'osm',
        'name': (t.get('name') or '').strip() or (op or 'Eletroposto'),
        'addr': addr,
        'city': (t.get('addr:city') or '').strip(),
        'uf': norm_uf(t.get('addr:state', '')),
        'cep': (t.get('addr:postcode') or '').strip(),
        'lat': round(lat, 6), 'lon': round(lon, 6),
        'op': op,
        'conns': conns,
        'points': int(re.match(r'\d+', t.get('capacity', '1')).group()) if re.match(r'\d+', t.get('capacity', '') or '') else max(1, sum(c['q'] for c in conns) if conns else 1),
        'usage': usage,
        'public': access not in ('private', 'no'),
        'status': '',
        'operational': None,
        'cost': (t.get('charge') or '').strip(),
        'phone': (t.get('phone') or t.get('contact:phone') or '').strip(),
        'url': (t.get('website') or t.get('contact:website') or '').strip(),
        'hours': (t.get('opening_hours') or '').strip(),
        'notes': (t.get('description') or '').strip(),
        'updated': t.get('check_date', ''),
    })
    stats['osm'] += 1

# ---------- Dedup por proximidade (~60 m): OCM tem prioridade, mas herda campos vazios do OSM ----------
def dist_m(a, b):
    R = 6371000
    p1, p2 = math.radians(a['lat']), math.radians(b['lat'])
    dp, dl = math.radians(b['lat'] - a['lat']), math.radians(b['lon'] - a['lon'])
    h = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*R*math.asin(math.sqrt(h))

ocm_list = [s for s in stations if s['src'] == 'ocm']
osm_list = [s for s in stations if s['src'] == 'osm']
grid = {}
for s in ocm_list:
    grid.setdefault((round(s['lat'], 2), round(s['lon'], 2)), []).append(s)
merged = list(ocm_list)
for s in osm_list:
    near = None
    for dx in (-0.01, 0, 0.01):
        for dy in (-0.01, 0, 0.01):
            for c in grid.get((round(s['lat'] + dx, 2), round(s['lon'] + dy, 2)), []):
                if dist_m(s, c) < 60: near = c; break
            if near: break
        if near: break
    if near:
        stats['dup'] += 1
        for k in ('addr', 'city', 'uf', 'cep', 'op', 'hours', 'phone', 'url', 'notes'):
            if not near.get(k) and s.get(k): near[k] = s[k]
        if not near['conns'] and s['conns']: near['conns'] = s['conns']
        near['id2'] = s['id']
    else:
        merged.append(s)

def clean_addr(a, city, uf):
    s = (a or '').strip()
    s = re.sub(r'(,\s*)?\b(Brazil|Brasil)\b\s*$', '', s, flags=re.I)
    s = re.sub(r',\s*\d{5}-?\d{3}\s*$', '', s)
    # remove "Cidade - UF" / "Cidade, UF" / "- UF" no final quando já temos cidade/uf
    if city:
        s = re.sub(r'[,\s-]*' + re.escape(city) + r'\s*[-,/]?\s*(' + re.escape(uf) + r')?\s*$', '', s, flags=re.I)
    if uf:
        s = re.sub(r'[,\s-]+' + uf + r'\s*$', '', s)
    s = re.sub(r'\s*,\s*,', ',', s).strip().strip(',-– ').strip()
    return s

for s in stations:
    s['addr'] = clean_addr(s['addr'], s['city'], s['uf'])

# ---------- Cidade/UF por geocodificação reversa grosseira (centroides de capitais) para quem não tem ----------
# Centroides aproximados dos estados para preencher UF ausente
UF_CENTROID = {'AC':(-9.02,-70.81),'AL':(-9.57,-36.78),'AP':(1.41,-51.77),'AM':(-3.47,-65.1),'BA':(-12.96,-41.7),'CE':(-5.2,-39.53),'DF':(-15.83,-47.86),'ES':(-19.19,-40.34),'GO':(-15.98,-49.86),'MA':(-5.42,-45.44),'MT':(-12.64,-55.42),'MS':(-20.51,-54.54),'MG':(-18.1,-44.38),'PA':(-3.79,-52.48),'PB':(-7.28,-36.72),'PR':(-24.89,-51.55),'PE':(-8.38,-37.86),'PI':(-6.6,-42.28),'RJ':(-22.25,-42.66),'RN':(-5.81,-36.59),'RS':(-30.17,-53.5),'RO':(-10.83,-63.34),'RR':(1.99,-61.33),'SC':(-27.45,-50.95),'SP':(-22.19,-48.79),'SE':(-10.57,-37.45),'TO':(-9.46,-48.26)}
for s in merged:
    if not s['uf']:
        s['uf'] = min(UF_CENTROID, key=lambda u: (UF_CENTROID[u][0]-s['lat'])**2 + (UF_CENTROID[u][1]-s['lon'])**2)
        s['uf_est'] = True
    # resumo de potência
    kws = [c['kw'] for c in s['conns'] if c.get('kw')]
    s['maxkw'] = max(kws) if kws else None
    s['dc'] = any(c['dc'] for c in s['conns'])
    s['name'] = s['name'][:120]

# ---------- Aplica cache de geocodificação reversa (geocode.py / Nominatim), se existir ----------
import os
if os.path.exists('geocache.json'):
    cache = json.load(open('geocache.json'))
    for s in merged:
        c = cache.get(f"{s['lat']:.4f},{s['lon']:.4f}")
        if not c or 'err' in c: continue
        if not s['city'] and c.get('city'): s['city'] = c['city']
        if c.get('uf') and s.get('uf_est'): s['uf'] = c['uf']
        if not s['addr'] and c.get('road'): s['addr'] = ', '.join(x for x in [c['road'], c.get('suburb', '')] if x)
        if not s['cep'] and c.get('cep'): s['cep'] = c['cep']
for s in merged: s.pop('uf_est', None)

merged.sort(key=lambda s: (s['uf'], s['city'], s['name']))
out = {
    'generated': datetime.date.today().isoformat(),
    'sources': {'ocm': 'Open Charge Map (CC BY 4.0 / CC0), export 2026-04-22', 'osm': 'OpenStreetMap contributors (ODbL), Overpass 2026-09-04'},
    'count': len(merged),
    'stations': merged,
}
json.dump(out, open('stations.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(out, open('stations_pretty.json', 'w'), ensure_ascii=False, indent=1)
print('STATS', dict(stats), 'TOTAL', len(merged))
print('UF', Counter(s['uf'] for s in merged).most_common())
print('DC', sum(1 for s in merged if s['dc']), 'com kW', sum(1 for s in merged if s['maxkw']))
print('sem cidade', sum(1 for s in merged if not s['city']), 'sem endereço', sum(1 for s in merged if not s['addr']))
print('OSM sockets não mapeados', unmapped.most_common())
import os; print('bytes', os.path.getsize('stations.json'))
if len(merged) < 800: print('ERRO: base muito pequena, não publicar'); sys.exit(1)

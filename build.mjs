// Gera o site estático de divulgação/SEO a partir de stations.json. Uso: node build.mjs
import fs from 'fs';
// Sem domínio próprio definido, publica no GitHub Pages do projeto (links com prefixo /eletropostos-brasil).
const DOMAIN = process.env.SITE_DOMAIN || '';
const ROOT = DOMAIN ? '' : (process.env.SITE_ROOT ?? '/eletropostos-brasil');
const BASE = DOMAIN ? `https://${DOMAIN}` : `https://spartanti.github.io${ROOT}`;
const data = JSON.parse(fs.readFileSync('stations.json', 'utf8'));
const stations = data.stations;
const UF = { AC:'Acre',AL:'Alagoas',AP:'Amapá',AM:'Amazonas',BA:'Bahia',CE:'Ceará',DF:'Distrito Federal',ES:'Espírito Santo',GO:'Goiás',MA:'Maranhão',MT:'Mato Grosso',MS:'Mato Grosso do Sul',MG:'Minas Gerais',PA:'Pará',PB:'Paraíba',PR:'Paraná',PE:'Pernambuco',PI:'Piauí',RJ:'Rio de Janeiro',RN:'Rio Grande do Norte',RS:'Rio Grande do Sul',RO:'Rondônia',RR:'Roraima',SC:'Santa Catarina',SP:'São Paulo',SE:'Sergipe',TO:'Tocantins' };
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const kw = c => c.kw ? `${Number.isInteger(c.kw) ? c.kw : c.kw.toFixed(1)} kW` : '';
const fmt = n => n.toLocaleString('pt-BR');
const today = new Date().toISOString().slice(0, 10);

const CSS = `
:root{--azul:#1565C0;--azul2:#0B3D91;--claro:#DCE8FF;--laranja:#EF6C00;--fundo:#F4F7FC;--texto:#16202E;--cinza:#4A5666}
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--texto);background:var(--fundo);line-height:1.55}
a{color:var(--azul)}header{background:#fff;border-bottom:1px solid #DDE5F0;position:sticky;top:0;z-index:10}
.nav{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:18px;padding:10px 16px}.nav .logo{display:flex;align-items:center;gap:10px;font-weight:800;color:var(--azul2);text-decoration:none;font-size:1.1rem}
.nav .logo img{width:36px;height:36px;border-radius:10px}.nav nav{margin-left:auto;display:flex;gap:14px;flex-wrap:wrap}.nav nav a{text-decoration:none;color:var(--cinza);font-weight:600}
.btn{display:inline-block;background:var(--azul);color:#fff!important;padding:12px 20px;border-radius:12px;text-decoration:none;font-weight:700}.btn.l{background:var(--laranja)}.btn.o{background:#fff;color:var(--azul)!important;border:2px solid var(--azul)}
main{max-width:1100px;margin:0 auto;padding:24px 16px}.hero{display:grid;grid-template-columns:1.2fr 1fr;gap:32px;align-items:center;padding:36px 0}
.hero h1{font-size:2.4rem;line-height:1.15;color:var(--azul2);margin:0 0 12px}.hero p{font-size:1.15rem;color:var(--cinza)}.hero img{width:100%;max-width:420px;border-radius:24px;box-shadow:0 20px 50px rgba(21,101,192,.25);justify-self:center}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;margin:24px 0}.stat{background:#fff;border-radius:16px;padding:18px;text-align:center;box-shadow:0 2px 10px rgba(0,0,0,.05)}.stat b{display:block;font-size:2rem;color:var(--azul)}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}.card{background:#fff;border-radius:16px;padding:18px;box-shadow:0 2px 10px rgba(0,0,0,.05)}.card h3{margin:0 0 6px;color:var(--azul2)}
.chip{display:inline-block;background:var(--claro);color:var(--azul2);border-radius:8px;padding:2px 8px;font-size:.85rem;margin:2px 4px 2px 0}.chip.ac{background:#FFE3C4;color:#5C2A00}
h2{color:var(--azul2);margin-top:36px}table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden}td,th{padding:10px 12px;border-bottom:1px solid #EEF2F8;text-align:left;vertical-align:top}th{background:var(--claro);color:var(--azul2)}
footer{max-width:1100px;margin:40px auto;padding:20px 16px;color:var(--cinza);font-size:.9rem;border-top:1px solid #DDE5F0}.shots{display:flex;gap:14px;overflow-x:auto;padding:10px 0}.shots img{height:420px;border-radius:18px;box-shadow:0 8px 24px rgba(0,0,0,.12)}
.ufs{display:flex;flex-wrap:wrap;gap:8px}.ufs a{background:#fff;border:1px solid #DDE5F0;border-radius:10px;padding:8px 12px;text-decoration:none;color:var(--azul2);font-weight:600}
@media(max-width:800px){.hero{grid-template-columns:1fr}.hero h1{font-size:1.8rem}.nav nav{display:none}}
`;
function page({ title, desc, path, body, jsonld, extraHead = '' }) {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${BASE}${path}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:image" content="${BASE}/assets/icon-512.png"><meta property="og:type" content="website">
<link rel="icon" href="${ROOT}/assets/icon-512.png"><style>${CSS}</style>${extraHead}${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}</head>
<body><header><div class="nav"><a class="logo" href="${ROOT}/"><img src="${ROOT}/assets/icon-512.png" alt="">Eletropostos Brasil</a><nav><a href="${ROOT}/mapa.html">Mapa</a><a href="${ROOT}/estacoes/">Estações por estado</a><a href="${ROOT}/dados.html">Dados do mercado</a><a href="${ROOT}/cadastrar.html">Cadastrar eletroposto</a><a href="${ROOT}/#baixar" class="btn">Baixar o app</a></nav></div></header>
<main>${body}</main>
<footer>Eletropostos Brasil é desenvolvido e gerenciado pela <a href="https://spartanti.com.br">Spartan TI</a> · <a href="${ROOT}/privacidade.html">Política de privacidade</a> · <a href="mailto:admin@spartanti.com.br">admin@spartanti.com.br</a> · WhatsApp <a href="https://wa.me/5527992557140">+55 27 99255-7140</a><br>Dados: © Open Charge Map contributors (CC BY 4.0), © OpenStreetMap contributors (ODbL), cadastros da comunidade. Base atualizada em ${data.generated}.</footer>
</body></html>`;
}
const stationLi = s => `<div class="card"><h3>${esc(s.name)}</h3><div>${esc([s.addr, s.city && s.uf ? `${s.city} - ${s.uf}` : ''].filter(Boolean).join(', '))}</div>
<div style="margin:6px 0">${s.conns.map(c => `<span class="chip ${c.dc ? '' : 'ac'}">${esc(c.t)}${kw(c) ? ' ' + kw(c) : ''}${c.q > 1 ? ' ×' + c.q : ''}</span>`).join('') || '<span class="chip">tomada não informada</span>'}</div>
<div style="color:var(--cinza);font-size:.9rem">${[s.op && 'Operador: ' + esc(s.op), s.usage && esc(s.usage), s.hours && 'Horário: ' + esc(s.hours), s.cost && s.cost !== '0' && 'Preço: ' + esc(s.cost)].filter(Boolean).join(' · ')}</div>
<div style="margin-top:8px"><a href="https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lon}">Ver no Google Maps</a></div></div>`;

// ---------- agregados ----------
const byUf = {}; for (const s of stations) (byUf[s.uf] ||= []).push(s);
const dc = stations.filter(s => s.dc).length, cities = new Set(stations.map(s => `${s.uf}|${s.city}`)).size;
const connCount = {}; for (const s of stations) for (const c of s.conns) connCount[c.t] = (connCount[c.t] || 0) + c.q;
const opCount = {}; for (const s of stations) if (s.op) opCount[s.op] = (opCount[s.op] || 0) + 1;
const out = {};

// ---------- home ----------
out['index.html'] = page({ title: 'Eletropostos Brasil – mapa e app de estações de recarga para carros elétricos', desc: `App gratuito com ${fmt(stations.length)} eletropostos em ${Object.keys(byUf).length} estados: mapa, filtros por tomada e potência, planejador de viagem e relatos da comunidade. Sem cadastro.`, path: '/', jsonld: { '@context': 'https://schema.org', '@type': 'SoftwareApplication', name: 'Eletropostos Brasil', operatingSystem: 'Android', applicationCategory: 'TravelApplication', offers: { '@type': 'Offer', price: '0', priceCurrency: 'BRL' }, author: { '@type': 'Organization', name: 'Spartan TI', url: 'https://spartanti.com.br' } },
  body: `<section class="hero"><div><h1>Onde carregar seu carro elétrico, em todo o Brasil</h1><p>Mapa com ${fmt(stations.length)} eletropostos, filtros por tomada e potência, planejador de viagem com paradas de recarga e relatos de quem já carregou. Sem cadastro, sem cartão.</p>
<p id="baixar"><a class="btn" href="${ROOT}/assets/eletropostos-brasil.apk">Baixar para Android (APK)</a> &nbsp; <a class="btn o" href="${ROOT}/mapa.html">Abrir o mapa</a></p><p style="font-size:.9rem;color:var(--cinza)">Em breve na Google Play. Ao instalar o APK, permita "instalar apps desconhecidos" para o navegador.</p></div>
<img src="${ROOT}/assets/02-mapa-selecionado.png" alt="Tela do app Eletropostos Brasil com o mapa de estações"></section>
<section class="stats"><div class="stat"><b>${fmt(stations.length)}</b>eletropostos</div><div class="stat"><b>${fmt(dc)}</b>com recarga rápida (DC)</div><div class="stat"><b>${fmt(cities)}</b>cidades</div><div class="stat"><b>${Object.keys(byUf).length}</b>estados + DF</div></section>
<h2>O que o app faz</h2><section class="grid">
<div class="card"><h3>Mais próximos de você</h3>Lista e mapa ordenados pela distância, com tomada, potência e etiqueta rápida/lenta.</div>
<div class="card"><h3>Funciona ou não?</h3>Relatos da comunidade e status operacional; um ponto verde ou vermelho no pino diz o que esperar.</div>
<div class="card"><h3>Planejador de viagem</h3>Informe a autonomia do carro e receba as paradas de recarga rápida no caminho.</div>
<div class="card"><h3>Meu carro</h3>Escolha o modelo e veja só os eletropostos compatíveis com suas tomadas.</div>
<div class="card"><h3>Aberto agora e preço</h3>Horário de funcionamento e valor por kWh quando informados.</div>
<div class="card"><h3>Cadastre seu ponto</h3>Donos e operadores enviam o eletroposto pelo app; após revisão, aparece para todos.</div></section>
<h2>Telas</h2><div class="shots">${['01-lista', '02-mapa-selecionado', '03-viagem', '04-detalhe', '05-carro'].map(f => `<img src="${ROOT}/assets/${f}.png" alt="Tela do app">`).join('')}</div>
<h2>Eletropostos por estado</h2><div class="ufs">${Object.keys(byUf).sort().map(uf => `<a href="${ROOT}/estacoes/${uf.toLowerCase()}/">${UF[uf] || uf} (${fmt(byUf[uf].length)})</a>`).join('')}</div>` });

// ---------- mapa ----------
out['mapa.html'] = page({ title: 'Mapa de eletropostos do Brasil – Eletropostos Brasil', desc: `Mapa interativo com ${fmt(stations.length)} estações de recarga para carros elétricos no Brasil, com tomadas e potência.`, path: '/mapa.html',
  extraHead: `<link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet"><script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script><style>#map{height:78vh;border-radius:16px}.pop h4{margin:0 0 4px}</style>`,
  body: `<h1 style="color:var(--azul2)">Mapa de eletropostos</h1><p>Azul = recarga rápida (DC), laranja = lenta (AC). Toque num ponto para ver tomadas e potência. <a href="${ROOT}/#baixar">No app</a> você tem distância, filtros, relatos e planejador de viagem.</p><div id="map"></div>
<script>
const map = new maplibregl.Map({ container: 'map', style: 'https://tiles.openfreemap.org/styles/liberty', center: [-52, -14.5], zoom: 3.6 });
map.addControl(new maplibregl.NavigationControl()); map.addControl(new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }));
map.on('load', async () => {
  const d = await (await fetch('${ROOT}/stations.json')).json();
  const fc = { type: 'FeatureCollection', features: d.stations.map(s => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [s.lon, s.lat] }, properties: { name: s.name, addr: [s.addr, s.city, s.uf].filter(Boolean).join(', '), dc: s.dc, conns: s.conns.map(c => c.t + (c.kw ? ' ' + c.kw + ' kW' : '')).join(', '), lat: s.lat, lon: s.lon } })) };
  map.addSource('st', { type: 'geojson', data: fc, cluster: true, clusterRadius: 50, clusterMaxZoom: 13 });
  map.addLayer({ id: 'cl', type: 'circle', source: 'st', filter: ['has', 'point_count'], paint: { 'circle-color': '#1565C0', 'circle-radius': ['step', ['get', 'point_count'], 16, 10, 20, 50, 26, 200, 32], 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' } });
  map.addLayer({ id: 'cn', type: 'symbol', source: 'st', filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 13, 'text-font': ['Noto Sans Bold'] }, paint: { 'text-color': '#fff' } });
  map.addLayer({ id: 'pt', type: 'circle', source: 'st', filter: ['!', ['has', 'point_count']], paint: { 'circle-color': ['case', ['get', 'dc'], '#1565C0', '#EF6C00'], 'circle-radius': 8, 'circle-stroke-width': 2, 'circle-stroke-color': '#fff' } });
  map.on('click', 'cl', e => { const f = map.queryRenderedFeatures(e.point, { layers: ['cl'] })[0]; map.getSource('st').getClusterExpansionZoom(f.properties.cluster_id, (err, z) => { if (!err) map.easeTo({ center: f.geometry.coordinates, zoom: z }); }); });
  map.on('click', 'pt', e => { const p = e.features[0].properties; new maplibregl.Popup().setLngLat(e.features[0].geometry.coordinates).setHTML('<div class="pop"><h4>' + p.name + '</h4>' + p.addr + '<br><b>' + (p.conns || 'tomada não informada') + '</b><br><a href="https://www.google.com/maps/dir/?api=1&destination=' + p.lat + ',' + p.lon + '">Traçar rota</a></div>').addTo(map); });
  for (const l of ['cl', 'pt']) { map.on('mouseenter', l, () => map.getCanvas().style.cursor = 'pointer'); map.on('mouseleave', l, () => map.getCanvas().style.cursor = ''); }
});
</script>` });

// ---------- estados e cidades ----------
const ufLinks = Object.keys(byUf).sort().map(uf => `<a href="${ROOT}/estacoes/${uf.toLowerCase()}/">${UF[uf] || uf} (${fmt(byUf[uf].length)})</a>`).join('');
out['estacoes/index.html'] = page({ title: 'Eletropostos por estado – Eletropostos Brasil', desc: 'Estações de recarga para carros elétricos em cada estado do Brasil, com cidades, tomadas e potência.', path: '/estacoes/', body: `<h1 style="color:var(--azul2)">Eletropostos por estado</h1><div class="ufs">${ufLinks}</div>` });
const urls = ['/', '/mapa.html', '/estacoes/', '/dados.html', '/cadastrar.html', '/privacidade.html'];
for (const uf of Object.keys(byUf).sort()) {
  const list = byUf[uf]; const byCity = {}; for (const s of list) (byCity[s.city || 'Sem cidade'] ||= []).push(s);
  const cities2 = Object.keys(byCity).sort((a, b) => byCity[b].length - byCity[a].length || a.localeCompare(b));
  const ufPath = `/estacoes/${uf.toLowerCase()}/`; urls.push(ufPath);
  out[`estacoes/${uf.toLowerCase()}/index.html`] = page({ title: `Eletropostos em ${UF[uf] || uf}: ${fmt(list.length)} estações de recarga – Eletropostos Brasil`, desc: `Lista de ${fmt(list.length)} eletropostos em ${UF[uf] || uf} (${list.filter(s => s.dc).length} com recarga rápida), por cidade, com tomadas e potência.`, path: ufPath,
    jsonld: { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Estados', item: `${BASE}/estacoes/` }, { '@type': 'ListItem', position: 2, name: UF[uf] || uf, item: `${BASE}${ufPath}` }] },
    body: `<h1 style="color:var(--azul2)">Eletropostos em ${UF[uf] || uf}</h1><p>${fmt(list.length)} estações de recarga, ${fmt(list.filter(s => s.dc).length)} com recarga rápida (DC), em ${cities2.length} cidades. <a href="${ROOT}/#baixar">Baixe o app</a> para ver as mais próximas de você.</p>
<h2>Cidades</h2><div class="ufs">${cities2.map(c => `<a href="${ufPath}${slug(c)}.html">${esc(c)} (${byCity[c].length})</a>`).join('')}</div>
<h2>Maiores potências em ${UF[uf] || uf}</h2><div class="grid">${list.filter(s => s.maxkw).sort((a, b) => b.maxkw - a.maxkw).slice(0, 12).map(stationLi).join('')}</div>` });
  for (const c of cities2) {
    const cs = byCity[c]; const cp = `${ufPath}${slug(c)}.html`; urls.push(cp);
    out[`estacoes/${uf.toLowerCase()}/${slug(c)}.html`] = page({ title: `Eletropostos em ${c} - ${uf}: ${cs.length} estações de recarga – Eletropostos Brasil`, desc: `Onde carregar carro elétrico em ${c} (${UF[uf] || uf}): ${cs.length} eletropostos com endereço, tomadas (${[...new Set(cs.flatMap(s => s.conns.map(x => x.t)))].join(', ') || 'diversas'}) e potência.`, path: cp,
      jsonld: { '@context': 'https://schema.org', '@type': 'ItemList', name: `Eletropostos em ${c} - ${uf}`, numberOfItems: cs.length, itemListElement: cs.slice(0, 50).map((s, i) => ({ '@type': 'ListItem', position: i + 1, item: { '@type': 'Place', name: s.name, address: { '@type': 'PostalAddress', streetAddress: s.addr, addressLocality: s.city, addressRegion: s.uf, addressCountry: 'BR' }, geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lon } } })) },
      body: `<p><a href="${ROOT}/estacoes/">Estados</a> › <a href="${ufPath}">${UF[uf] || uf}</a> › ${esc(c)}</p><h1 style="color:var(--azul2)">Eletropostos em ${esc(c)} - ${uf}</h1><p>${cs.length} estações de recarga para carros elétricos em ${esc(c)}, ${cs.filter(s => s.dc).length} com recarga rápida. No <a href="${ROOT}/#baixar">app Eletropostos Brasil</a> você vê a distância, se está funcionando e traça a rota.</p><div class="grid">${cs.sort((a, b) => (b.maxkw || 0) - (a.maxkw || 0)).map(stationLi).join('')}</div>` });
  }
}

// ---------- dados do mercado ----------
out['dados.html'] = page({ title: 'Dados do mercado de recarga de carros elétricos no Brasil – Eletropostos Brasil', desc: 'Quantos eletropostos existem por estado, quais tomadas dominam, participação de recarga rápida e principais operadores, a partir de bases abertas.', path: '/dados.html',
  body: `<h1 style="color:var(--azul2)">Dados do mercado de recarga</h1><p>Números da base aberta do Eletropostos Brasil em ${data.generated} (Open Charge Map + OpenStreetMap + cadastros no app). Relatórios de demanda anônima (áreas com falta de recarga, picos e rotas) estão disponíveis para empresas de energia, operadores e prefeituras: <a href="mailto:admin@spartanti.com.br">fale com a Spartan TI</a>.</p>
<section class="stats"><div class="stat"><b>${fmt(stations.length)}</b>eletropostos</div><div class="stat"><b>${(100 * dc / stations.length).toFixed(0)}%</b>com recarga rápida</div><div class="stat"><b>${fmt(Object.values(connCount).reduce((a, b) => a + b, 0))}</b>tomadas</div><div class="stat"><b>${fmt(cities)}</b>cidades</div></section>
<h2>Por estado</h2><table><tr><th>Estado</th><th>Eletropostos</th><th>Com DC</th><th>% DC</th></tr>${Object.keys(byUf).sort((a, b) => byUf[b].length - byUf[a].length).map(uf => `<tr><td><a href="${ROOT}/estacoes/${uf.toLowerCase()}/">${UF[uf] || uf}</a></td><td>${fmt(byUf[uf].length)}</td><td>${fmt(byUf[uf].filter(s => s.dc).length)}</td><td>${(100 * byUf[uf].filter(s => s.dc).length / byUf[uf].length).toFixed(0)}%</td></tr>`).join('')}</table>
<h2>Tomadas</h2><table><tr><th>Tipo</th><th>Quantidade</th></tr>${Object.entries(connCount).sort((a, b) => b[1] - a[1]).map(([t, n]) => `<tr><td>${esc(t)}</td><td>${fmt(n)}</td></tr>`).join('')}</table>
<h2>Operadores com mais pontos</h2><table><tr><th>Operador</th><th>Eletropostos</th></tr>${Object.entries(opCount).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([o, n]) => `<tr><td>${esc(o)}</td><td>${fmt(n)}</td></tr>`).join('')}</table>` });

// ---------- cadastrar ----------
out['cadastrar.html'] = page({ title: 'Cadastre seu eletroposto – Eletropostos Brasil', desc: 'Donos e operadores de pontos de recarga: cadastre gratuitamente e apareça no app e no site.', path: '/cadastrar.html',
  body: `<h1 style="color:var(--azul2)">Cadastre seu eletroposto</h1><p>Gratuito. Após uma revisão rápida da Spartan TI, o ponto aparece no app para todos os usuários e nas páginas por cidade deste site.</p>
<form id="f" class="card" style="max-width:720px"><label>Nome do local *<br><input name="name" required style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><br><br>
<label>Endereço<br><input name="addr" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><br><br>
<div style="display:grid;grid-template-columns:2fr 1fr;gap:10px"><label>Cidade<br><input name="city" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><label>UF<br><input name="uf" maxlength="2" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label></div><br>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>Latitude *<br><input name="lat" required placeholder="-20.3155" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><label>Longitude *<br><input name="lon" required placeholder="-40.2986" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label></div><small>No Google Maps, toque e segure no local e copie as coordenadas.</small><br><br>
<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:10px"><label>Tomada *<br><select name="t" style="width:100%;padding:10px;border-radius:8px"><option>CCS2</option><option>Tipo 2</option><option>CHAdeMO</option><option>GB/T</option><option>Tipo 1</option><option>Tesla</option><option>Industrial</option><option>Tomada</option></select></label><label>kW<br><input name="kw" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><label>Quantidade<br><input name="q" value="1" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label></div><br>
<label>Operador / rede<br><input name="op" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><br><br>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label>Preço (ex.: R$ 2,49/kWh)<br><input name="cost" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><label>Horário (ex.: 24/7)<br><input name="hours" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label></div><br>
<label>Seu contato (opcional)<br><input name="contact" style="width:100%;padding:10px;border:1px solid #C9D3E0;border-radius:8px"></label><br><br>
<button class="btn" type="submit">Enviar cadastro</button> <span id="msg" style="margin-left:10px"></span></form>
<p>Prefere o app? Em <b>Mais → Cadastrar eletroposto</b> você usa a localização do celular. Ou fale no WhatsApp <a href="https://wa.me/5527992557140">+55 27 99255-7140</a>.</p>
<script>document.getElementById('f').addEventListener('submit', async e => { e.preventDefault(); const f = new FormData(e.target); const b = { name: f.get('name'), addr: f.get('addr'), city: f.get('city'), uf: (f.get('uf')||'').toUpperCase(), lat: parseFloat(String(f.get('lat')).replace(',', '.')), lon: parseFloat(String(f.get('lon')).replace(',', '.')), conns: [{ t: f.get('t'), kw: parseFloat(String(f.get('kw')).replace(',', '.')) || null, q: parseInt(f.get('q')) || 1 }], op: f.get('op'), cost: f.get('cost'), hours: f.get('hours'), contact: f.get('contact'), device: 'site' }; const m = document.getElementById('msg'); m.textContent = 'Enviando…'; try { const r = await fetch('https://eletropostos-api-production.up.railway.app/api/submissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json(); m.textContent = r.ok ? '✅ ' + j.message : '⚠️ ' + (j.error || 'erro'); if (r.ok) e.target.reset(); } catch (err) { m.textContent = '⚠️ Não foi possível enviar. Tente pelo app ou WhatsApp.'; } });</script>` });

// ---------- sitemap / robots / CNAME ----------
out['sitemap.xml'] = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u => `<url><loc>${BASE}${u}</loc><lastmod>${today}</lastmod></url>`).join('')}</urlset>`;
out['robots.txt'] = `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`;
if (DOMAIN) out['CNAME'] = DOMAIN + '\n'; else if (fs.existsSync('CNAME')) fs.unlinkSync('CNAME');
for (const [f, c] of Object.entries(out)) { fs.mkdirSync(f.includes('/') ? f.slice(0, f.lastIndexOf('/')) : '.', { recursive: true }); fs.writeFileSync(f, c); }
console.log(`site gerado: ${Object.keys(out).length} arquivos, ${urls.length} URLs no sitemap, domínio ${DOMAIN}`);

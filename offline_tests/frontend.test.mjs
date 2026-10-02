import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const base = new URL('../custom_components/stremio/frontend/', import.meta.url);
const read = name => readFileSync(new URL(name, base), 'utf8');
const sorting = await import('data:text/javascript;base64,' + Buffer.from(read('stremio-catalog-sorting.js')).toString('base64'));
const registry = new Map();
class LitElement { requestUpdate() {} dispatchEvent() {} }
const context = vm.createContext({ LitElement, html: () => '', css: () => '',
  customElements: { get: name => registry.get(name), define: (name, value) => registry.set(name, value) },
  console: { ...console, error() {}, log() {} }, setTimeout, clearTimeout,
  CustomEvent: class { constructor(name, data) { this.name = name; this.detail = data?.detail; } },
  renderManagementActions() {}, ...sorting });
let source = read('stremio-browse-card.js').replace(/^import .*;\s*$/gm, '');
source = source.replace(/const \{ LitElement, html, css \} = await loadCardHelpers\(\);/, '');
vm.runInContext(source, context, { filename: fileURLToPath(new URL('stremio-browse-card.js', base)) });
const Browse = registry.get('stremio-browse-card');
function card() {
  const result = new Browse();
  result.setConfig({ management_mode: true, max_items: 24 });
  result._hass = {};
  return result;
}
function page(start, count = 50) {
  return { items: Array.from({ length: count }, (_, n) => ({ id: `tt${start + n}`, type: 'movie', title: `Fixture ${start + n}` })), next_skip: start + 50, has_more: count > 0 };
}

test('numeric scores, stable ties, unrated last, and immutable provider order', () => {
  const data = [{ id: 'a', rating: '8.8' }, { id: 'b', rating: 9.3 }, { id: 'c', rating: '8.8' }, { id: 'd', rating: '' }, { id: 'e', rating: '9oops' }];
  assert.deepEqual(sorting.sortCatalogItems(data, 'imdb_desc').map(x => x.id), ['b', 'a', 'c', 'd', 'e']);
  assert.deepEqual(sorting.sortCatalogItems(data, 'imdb_asc').map(x => x.id), ['a', 'c', 'b', 'd', 'e']);
  assert.deepEqual(data.map(x => x.id), ['a', 'b', 'c', 'd', 'e']);
  for (const raw of [null, undefined, true, {}, ' ', 'NaN', '11', -1, Infinity]) assert.equal(sorting.imdbScore({ rating: raw }), null);
});

test('native 50-item page is drained in 24-item display batches without loss', async () => {
  const c = card(); const skips = [];
  c._callStremioService = async (_, data) => { skips.push(data.skip); return page(data.skip); };
  await c._loadCatalog(); assert.equal(c._catalogItems.length, 24); assert.equal(c._catalogPending.length, 26);
  await c._loadMoreCatalogResults(); assert.equal(c._catalogItems.length, 48); assert.deepEqual(skips, [0]);
  await c._loadMoreCatalogResults(); assert.equal(c._catalogItems.length, 72); assert.deepEqual(skips, [0, 50]);
  assert.equal(new Set(c._catalogItems.map(x => x.id)).size, 72);
  assert.equal(c._catalogItems[48].id, 'tt48');
});

test('duplicate provider IDs are skipped without duplicating displayed entries', async () => {
  const c = card(); c.config.max_items = 50;
  c._callStremioService = async (_, data) => data.skip === 0 ? page(0) : { ...page(50), items: [{ id: 'tt0', type: 'movie' }, ...page(50).items] };
  await c._loadCatalog(); await c._loadMoreCatalogResults();
  assert.equal(c._catalogItems.length, 100); assert.equal(new Set(c._catalogItems.map(x => x.id)).size, 100);
});

test('sparse filtered pages are bounded to three requests per click', async () => {
  const c = card(); let requests = 0;
  c._callStremioService = async (_, data) => { requests++; return { items: [], next_skip: data.skip + 50, has_more: true }; };
  await c._loadCatalog(); assert.equal(requests, 3); assert.equal(c._catalogNextSkip, 150); assert.equal(c._catalogHasMore, true);
});

test('failed append preserves buffer/cursor and can retry', async () => {
  const c = card(); c._callStremioService = async (_, data) => page(data.skip);
  await c._loadCatalog(); await c._loadMoreCatalogResults();
  const before = c._catalogItems.map(x => x.id);
  c._callStremioService = async () => { throw new Error('fixture failure'); };
  await c._loadMoreCatalogResults();
  assert.deepEqual(c._catalogItems.map(x => x.id), before); assert.equal(c._catalogPending.length, 2); assert.equal(c._catalogNextSkip, 50);
  c._callStremioService = async (_, data) => page(data.skip);
  await c._loadMoreCatalogResults(); assert.equal(c._catalogItems.length, 72); assert.equal(c._catalogError, '');
});

test('feed switch suppresses stale response and loading state', async () => {
  const c = card(); let release;
  c._callStremioService = () => new Promise(resolve => { release = resolve; });
  const old = c._loadCatalog();
  c._viewMode = 'new'; c._callStremioService = async () => page(100);
  await c._loadCatalog(); release(page(0)); await old;
  assert.equal(c._catalogItems[0].id, 'tt100'); assert.equal(c._loading, false);
});

test('busy load-more clicks do not create duplicate requests', async () => {
  const c = card(); let release; let calls = 0;
  c._callStremioService = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const loading = c._loadCatalog(); await c._loadMoreCatalogResults(); assert.equal(calls, 1); release(page(0)); await loading;
});

test('empty native page terminates normal catalog continuation', async () => {
  const c = card(); c._callStremioService = async () => ({ items: [], next_skip: 0, has_more: false });
  await c._loadCatalog(); assert.equal(c._catalogHasMore, false); assert.equal(c._catalogPending.length, 0);
});

test('Title Info sanitizes image protocols and missing fields', () => {
  const modelContext = vm.createContext({ URL });
  vm.runInContext(read('stremio-title-info-dialog.js').split('class StremioTitleInfoDialog')[0].replaceAll('export function', 'function') + '\nthis.model = titleInfoModel; this.image = imageURL;', modelContext);
  for (const url of ['javascript:alert(1)', 'data:image/png;base64,abc', '//example.com/image']) assert.equal(modelContext.image(url), null);
  assert.equal(modelContext.image('https://example.com/image'), 'https://example.com/image');
  const result = modelContext.model({ title: 'Demo', rating: '11', type: 'series' });
  assert.equal(result.rating, 'Not available'); assert.equal(result.type, 'TV Series'); assert.equal(result.poster, null);
});

for (const name of ['stremio-library-card', 'stremio-continue-watching-card', 'stremio-recommendations-card']) {
  const code = read(name + '.js').replace(/^import .*;\s*$/gm, '').replace(/const \{ LitElement, html, css \} = await loadCardHelpers\(\);/, '');
  vm.runInContext('{\n' + code + '\n}', context, { filename: name + '.js' });
}
for (const name of ['stremio-browse-card', 'stremio-library-card', 'stremio-continue-watching-card', 'stremio-recommendations-card']) {
  test(name + ': first series click opens details without an episode request', () => {
    const Card = registry.get(name); const c = new Card();
    c.setConfig({ management_mode: true });
    let pickerCalls = 0; c._showEpisodePicker = () => pickerCalls++;
    const item = { id: 'tt0903747', type: 'series', title: 'Breaking Bad' };
    c._handleItemClick(item);
    assert.equal(c._selectedItem, item); assert.equal(pickerCalls, 0);
  });
}
for (const name of ['stremio-browse-card', 'stremio-library-card', 'stremio-continue-watching-card']) {
  test(name + ': legacy series click still selects an episode first', () => {
    const Card = registry.get(name); const c = new Card();
    c.setConfig({ management_mode: false });
    let pickerCalls = 0; c._showEpisodePicker = (_, mode) => { assert.equal(mode, 'detail'); pickerCalls++; };
    c._handleItemClick({ id: 'tt0903747', type: 'series', title: 'Breaking Bad' });
    assert.equal(pickerCalls, 1); assert.equal(c._selectedItem, null);
  });
  test(name + ': Get Streams still requires an episode when none is selected', () => {
    const Card = registry.get(name); const c = new Card(); c.setConfig({ management_mode: true });
    let pickerCalls = 0; c._showEpisodePicker = (_, mode) => { assert.equal(mode, 'streams'); pickerCalls++; };
    c._getStreamsForDetailItem({ id: 'tt0903747', type: 'series', title: 'Breaking Bad' });
    assert.equal(pickerCalls, 1);
  });
}

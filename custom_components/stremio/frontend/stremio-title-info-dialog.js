/** Read-only, on-demand title metadata popup. Dynamic text is never inserted as HTML. */
const STYLE = `
  :host { font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif); }
  dialog { width: min(880px, calc(100vw - 32px)); max-width: none; max-height: 90dvh;
    box-sizing: border-box; padding: 0; overflow: auto; color: #f3efff;
    background: #121019; border: 1px solid rgba(183,157,232,.27); border-radius: 24px;
    box-shadow: 0 28px 100px rgba(0,0,0,.6); }
  dialog::backdrop { background: rgba(0,0,0,.72); backdrop-filter: blur(6px); }
  * { box-sizing: border-box; }
  .toolbar { position: sticky; top: 0; z-index: 2; display: flex; align-items: center;
    justify-content: space-between; padding: 12px 22px; background: rgba(18,16,25,.96);
    border-bottom: 1px solid rgba(183,157,232,.12); }
  .kicker { color: #c2a4ff; font-size: 10px; font-weight: 800; letter-spacing: .18em; }
  button { border: 1px solid rgba(183,157,232,.26); border-radius: 10px; padding: 9px 14px;
    font: inherit; font-size: 12px; color: #e6dbff; background: #292037; cursor: pointer; }
  button:hover { background: #3b2b52; }
  button:focus-visible { outline: 2px solid #c2a4ff; outline-offset: 3px; }
  .hero { padding: 30px; display: grid; grid-template-columns: 145px minmax(0,1fr);
    gap: 26px; align-items: center; background: linear-gradient(120deg,#1b152b,#302040); }
  .poster { width: 145px; aspect-ratio: 2/3; object-fit: cover; border-radius: 13px;
    background: #292335; box-shadow: 0 12px 30px rgba(0,0,0,.4); }
  .hero.no-poster { grid-template-columns: minmax(0,1fr); }
  .type { color: #b9a2da; font-size: 10px; text-transform: uppercase; letter-spacing: .13em; }
  h2 { font-size: clamp(24px,3vw,36px); font-weight: 800; letter-spacing: -.9px;
    line-height: 1.14; margin: 10px 0 18px; overflow-wrap: anywhere; }
  .metrics,.genres,.cast { display: flex; flex-wrap: wrap; gap: 8px; }
  .metric { border: 1px solid rgba(209,190,245,.17); background: rgba(0,0,0,.2);
    border-radius: 12px; padding: 9px 13px; min-width: 88px; }
  .metric-label { display: block; color: #b6a9c8; font-size: 9px; letter-spacing: .08em;
    text-transform: uppercase; margin-bottom: 5px; }
  .metric-value { font-size: 14px; font-weight: 700; }
  .metric.score .metric-value { color: #efcf83; }
  .genres { margin-top: 14px; }
  .genre,.cast-name { border-radius: 9px; padding: 6px 10px; font-size: 11px;
    color: #d5c4ec; background: rgba(167,122,255,.12); border: 1px solid rgba(167,122,255,.12); }
  .body { padding: 25px 30px 30px; }
  h3 { color: #c2a4ff; font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
    margin: 0 0 13px; }
  section + section { margin-top: 26px; }
  .description { margin: 0; font-size: 14px; line-height: 1.8; color: #d4cede;
    white-space: pre-line; overflow-wrap: anywhere; }
  .director { margin: 0; color: #d4cede; line-height: 1.6; font-size: 13px; }
  .source { margin: 26px 0 0; color: #897f99; font-size: 10px; }
  .status { min-height: 170px; padding: 38px 30px; color: #c3b8d4; }
  .status p { line-height: 1.7; }
  .missing { color: #a59aaf; }
  @media(max-width:600px) {
    button { min-height: 44px; min-width: 44px; }
    dialog { width: calc(100vw - 16px); max-height: 94dvh; border-radius: 18px; }
    .toolbar { padding: 10px 16px; }
    .hero { padding: 20px 16px; grid-template-columns: 84px minmax(0,1fr); gap: 16px; }
    .poster { width: 84px; align-self: start; margin-top: 20px; }
    h2 { font-size: 24px; margin-bottom: 14px; }
    .metrics { gap: 6px; } .metric { padding: 8px; min-width: 0; }
    .metric-value { font-size: 12px; } .body { padding: 22px 18px; }
  }
`;

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text != null) element.textContent = String(text);
  return element;
}

export function imageURL(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export function titleInfoModel(metadata) {
  const value = (input, fallback = 'Not available') =>
    typeof input === 'string' && input.trim() ? input.trim() : fallback;
  const names = input => Array.isArray(input)
    ? input.filter(name => typeof name === 'string' && name.trim()) : [];
  const rating = Number.parseFloat(metadata.rating);
  return {
    title: value(metadata.title, 'Title Info'),
    type: metadata.type === 'series' ? 'TV Series' : 'Movie',
    year: value(metadata.year), runtime: value(metadata.runtime),
    rating: Number.isFinite(rating) && rating >= 0 && rating <= 10 ? `${rating.toFixed(1)} / 10` : 'Not available',
    description: value(metadata.description, 'No synopsis is available for this title.'),
    cast: names(metadata.cast), genres: names(metadata.genres), director: names(metadata.director),
    poster: imageURL(metadata.poster), background: imageURL(metadata.background),
  };
}

class StremioTitleInfoDialog extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    const style = node('style');
    style.textContent = STYLE;
    this._dialog = node('dialog');
    this._dialog.setAttribute('aria-label', 'Title information');
    const toolbar = node('div', 'toolbar');
    toolbar.append(node('span', 'kicker', 'TITLE INFO / CINEMETA'));
    this._close = node('button', '', 'Close');
    this._close.type = 'button';
    this._close.addEventListener('click', () => this._dialog.close());
    toolbar.append(this._close);
    this._content = node('div');
    this._dialog.append(toolbar, this._content);
    this.shadowRoot.append(style, this._dialog);
    this._generation = 0;
    this._dialog.addEventListener('close', () => { this._generation += 1; });
    this._dialog.addEventListener('click', event => {
      if (event.target !== this._dialog) return;
      const rect = this._dialog.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right
          || event.clientY < rect.top || event.clientY > rect.bottom) this._dialog.close();
    });
  }

  async show(hass, selection, fallbackTitle) {
    const generation = ++this._generation;
    this._dialog.setAttribute('aria-label', `Title information: ${fallbackTitle || 'selected title'}`);
    const loading = node('div', 'status');
    loading.setAttribute('role', 'status');
    loading.append(node('h2', '', fallbackTitle || 'Title Info'), node('p', '', 'Loading title details…'));
    this._content.replaceChildren(loading);
    if (!this._dialog.open) this._dialog.showModal();
    this._close.focus();
    try {
      const response = await hass.callWS({
        type: 'call_service', domain: 'stremio', service: 'get_title_metadata',
        service_data: { media_id: selection.media_id, media_type: selection.media_type },
        return_response: true,
      });
      if (generation !== this._generation || !this._dialog.open) return;
      const metadata = response?.response?.metadata || response?.metadata;
      if (!metadata || !metadata.title) throw new Error('No title details were returned.');
      this._render(metadata);
    } catch (error) {
      if (generation !== this._generation || !this._dialog.open) return;
      const status = node('div', 'status');
      status.setAttribute('role', 'alert');
      status.append(node('h2', '', fallbackTitle || 'Title Info'),
        node('p', '', error.message || 'Title information could not be loaded.'));
      const retry = node('button', '', 'Try again');
      retry.type = 'button';
      retry.addEventListener('click', () => this.show(hass, selection, fallbackTitle));
      status.append(retry);
      this._content.replaceChildren(status);
    }
  }

  _render(metadata) {
    const info = titleInfoModel(metadata);
    this._dialog.setAttribute('aria-label', `Title information: ${info.title}`);
    const hero = node('div', `hero${info.poster ? '' : ' no-poster'}`);
    if (info.background) hero.style.backgroundImage =
      `linear-gradient(100deg,rgba(20,14,33,.97),rgba(35,22,52,.82)),url(${JSON.stringify(info.background)})`;
    hero.style.backgroundSize = 'cover';
    hero.style.backgroundPosition = 'center';
    if (info.poster) {
      const poster = node('img', 'poster');
      poster.src = info.poster;
      poster.alt = `${info.title} poster`;
      poster.addEventListener('error', () => { poster.remove(); hero.classList.add('no-poster'); }, { once: true });
      hero.append(poster);
    }
    const summary = node('div');
    summary.append(node('div', 'type', info.type), node('h2', '', info.title));
    const metrics = node('div', 'metrics');
    for (const [label, value] of [['Year', info.year], ['Runtime', info.runtime], ['IMDb', info.rating]]) {
      const metric = node('div', `metric${label === 'IMDb' ? ' score' : ''}`);
      metric.append(node('span', 'metric-label', label), node('span', 'metric-value', value));
      metrics.append(metric);
    }
    summary.append(metrics);
    const genres = node('div', 'genres');
    for (const genre of info.genres) genres.append(node('span', 'genre', genre));
    summary.append(genres);
    hero.append(summary);
    const body = node('div', 'body');
    const synopsis = node('section');
    synopsis.append(node('h3', '', 'Synopsis'), node('p', 'description', info.description));
    body.append(synopsis);
    const cast = node('section');
    cast.append(node('h3', '', 'Cast'));
    const castNames = node('div', 'cast');
    for (const name of info.cast) castNames.append(node('span', 'cast-name', name));
    if (!info.cast.length) castNames.append(node('p', 'description missing', 'Cast information is not available.'));
    cast.append(castNames);
    body.append(cast);
    if (info.director.length) {
      const director = node('section');
      director.append(node('h3', '', 'Director'), node('p', 'director', info.director.join(', ')));
      body.append(director);
    }
    body.append(node('p', 'source', 'Metadata supplied by Cinemeta · Runtime and rating are title-level information.'));
    this._content.replaceChildren(hero, body);
    this._dialog.scrollTop = 0;
  }
}

if (!customElements.get('stremio-title-info-dialog')) {
  customElements.define('stremio-title-info-dialog', StremioTitleInfoDialog);
}

export function showTitleInfo(hass, selection, fallbackTitle) {
  if (!hass || !selection.media_id || !['movie', 'series'].includes(selection.media_type)) {
    throw new Error('Cannot identify this movie or series.');
  }
  let dialog = document.querySelector('stremio-title-info-dialog');
  if (!dialog) {
    dialog = document.createElement('stremio-title-info-dialog');
    document.body.append(dialog);
  }
  return dialog.show(hass, selection, fallbackTitle);
}

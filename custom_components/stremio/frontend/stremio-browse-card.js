/**
 * Stremio Browse Card
 *
 * Browse popular movies, TV shows, and new content from Stremio catalogs.
 * Features inline detail view (like library cards) and episode selection for TV shows.
 *
 * @customElement stremio-browse-card
 * @extends LitElement
 * @version 0.5.33
 * @cacheBust 2026021223
 */

import { renderManagementActions } from './stremio-management.js?v=0.6.0';
import { imdbScore, sortCatalogItems } from './stremio-catalog-sorting.js?v=0.6.0';

// Safe LitElement access - wait for HA frontend to be ready
const loadCardHelpers = async () => {
  if (customElements.get("ha-panel-lovelace")) {
    return {
      LitElement: Object.getPrototypeOf(customElements.get("ha-panel-lovelace")),
      html: Object.getPrototypeOf(customElements.get("ha-panel-lovelace")).prototype.html,
      css: Object.getPrototypeOf(customElements.get("ha-panel-lovelace")).prototype.css,
    };
  }

  await customElements.whenDefined("ha-panel-lovelace");
  const Lit = Object.getPrototypeOf(customElements.get("ha-panel-lovelace"));
  return { LitElement: Lit, html: Lit.prototype.html, css: Lit.prototype.css };
};

const { LitElement, html, css } = await loadCardHelpers();

class StremioBrowseCard extends LitElement {
  // Class constants
  static SEARCH_DEBOUNCE_DELAY = 500; // milliseconds

  static get properties() {
    return {
      hass: { type: Object },
      config: { type: Object },
      _viewMode: { type: String },
      _sortBy: { type: String },
      _catalogError: { type: String },
      _catalogHasMore: { type: Boolean },
      _mediaType: { type: String },
      _selectedGenre: { type: String },
      _catalogItems: { type: Array },
      _loading: { type: Boolean },
      _selectedItem: { type: Object },
      _similarItems: { type: Array },
      _similarSourceItem: { type: Object },
      _loadingSimilar: { type: Boolean },
      _searchQuery: { type: String },
      _loadingMore: { type: Boolean },
      _searchHasMore: { type: Boolean },
    };
  }

  static get styles() {
    return css`
      :host { min-width: 0; max-width: 100%; }

      :host {
        display: block;
        height: 100%;
      }

      ha-card {
        overflow: hidden;
        height: 100%;
        display: flex;
        flex-direction: column;
      }

      .header {
        padding: 16px;
        border-bottom: 1px solid var(--divider-color);
        flex-shrink: 0;
      }

      .header.detail-mode {
        padding: 0;
      }

      .header-title {
        font-size: 1.2em;
        font-weight: 500;
        margin: 0 0 12px 0;
        color: var(--primary-text-color);
      }

      .control-row {
        display: flex;
        gap: 8px;
        margin-bottom: 8px;
      }

      .control-button {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        font-size: 0.9em;
        transition: all 0.2s;
      }

      .control-button:hover {
        background: var(--secondary-background-color);
      }

      .control-button.active {
        background: var(--primary-color);
        color: var(--text-primary-color);
        border-color: var(--primary-color);
      }

      .imdb-badge {
        position: absolute;
        right: 6px;
        bottom: 6px;
        z-index: 1;
        padding: 5px 7px;
        border-radius: 8px;
        background: rgba(16, 13, 22, .9);
        border: 1px solid rgba(239, 207, 131, .32);
        color: #efcf83;
        font-size: 11px;
        font-weight: 700;
        pointer-events: none;
      }

      .sort-hint {
        margin: 4px 0 10px;
        color: var(--secondary-text-color);
        font-size: 10px;
        line-height: 1.5;
      }

      .search-container {
        position: relative;
        margin-bottom: 8px;
      }

      .search-input {
        width: 100%;
        padding: 8px 12px;
        padding-left: 36px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 0.9em;
        box-sizing: border-box;
        transition: border-color 0.2s;
      }

      .search-input:focus {
        outline: none;
        border-color: var(--primary-color);
      }

      .search-input::placeholder {
        color: var(--secondary-text-color);
        opacity: 0.7;
      }

      .search-icon {
        position: absolute;
        left: 10px;
        top: 50%;
        transform: translateY(-50%);
        color: var(--secondary-text-color);
        pointer-events: none;
      }

      .catalog-grid {
        display: grid;
        grid-template-columns: repeat(var(--grid-columns, 4), 1fr);
        align-content: start;
        align-items: start;
        grid-auto-rows: max-content;
        gap: 12px;
        padding: 16px;
        overflow-y: auto;
        flex: 1;
        min-height: 0;
      }

      .catalog-results {
        overflow-y: auto;
        flex: 1;
        min-height: 0;
        max-height: var(--card-max-height, none);
      }

      .catalog-results > .catalog-grid:not(.horizontal) {
        overflow-y: visible;
        flex: none;
      }

      .catalog-grid.horizontal {
        display: flex;
        flex-wrap: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        scroll-snap-type: x mandatory;
        -webkit-overflow-scrolling: touch;
      }

      .catalog-grid.horizontal .catalog-item {
        flex: 0 0 auto;
        width: calc(100% / var(--grid-columns, 4) - 10px);
        min-width: 100px;
        scroll-snap-align: start;
      }

      @media (max-width: 768px) {
        .catalog-grid {
          grid-template-columns: repeat(var(--grid-columns, 3), 1fr);
          gap: 8px;
          padding: 12px;
        }
      }

      .catalog-item {
        cursor: pointer;
        transition: transform 0.2s ease;
        position: relative;
        min-width: 0; /* Allow grid item to shrink smaller than content */
      }

      .catalog-item:hover {
        transform: scale(1.05);
      }

      .catalog-item:focus {
        outline: 2px solid var(--primary-color);
        outline-offset: 2px;
        transform: scale(1.05);
      }

      .catalog-poster-container {
        width: 100%;
        /* Use padding-bottom technique for consistent aspect ratio across all browsers */
        /* --poster-height-ratio is height/width as percentage, e.g., 150 for 2:3 */
        padding-bottom: calc(var(--poster-height-ratio, 150) * 1%);
        position: relative;
        overflow: hidden;
        border-radius: 6px;
        background: var(--secondary-background-color);
        height: 0; /* Required for padding-bottom technique to work */
      }

      .catalog-poster {
        width: 100%;
        height: 100%;
        object-fit: cover;
        position: absolute;
        top: 0;
        left: 0;
      }

      .catalog-poster-placeholder {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--secondary-background-color);
      }

      .catalog-poster-placeholder ha-icon {
        --mdc-icon-size: 32px;
        color: var(--secondary-text-color);
      }

      .catalog-title {
        padding: 8px;
        font-size: 0.85em;
        color: var(--primary-text-color);
        text-align: center;
        background: var(--card-background-color);
        line-height: 1.2;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .item-title {
        padding: 8px 8px 2px;
        font-size: 0.85em;
        color: var(--primary-text-color);
        text-align: center;
        background: var(--card-background-color);
        line-height: 1.2;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .item-year {
        padding: 0 8px 8px;
        font-size: 0.75em;
        color: var(--secondary-text-color);
        text-align: center;
        background: var(--card-background-color);
      }

      .item-poster-container {
        width: 100%;
        /* Use padding-bottom technique for consistent aspect ratio across all browsers */
        padding-bottom: calc(var(--poster-height-ratio, 150) * 1%);
        position: relative;
        overflow: hidden;
        border-radius: 6px;
        background: var(--secondary-background-color);
        height: 0; /* Required for padding-bottom technique to work */
      }

      .item-poster {
        width: 100%;
        height: 100%;
        object-fit: cover;
        position: absolute;
        top: 0;
        left: 0;
      }

      .item-poster-placeholder {
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--secondary-background-color);
      }

      .item-poster-placeholder ha-icon {
        --mdc-icon-size: 32px;
        color: var(--secondary-text-color);
      }

      .count-badge {
        font-size: 0.7em;
        font-weight: normal;
        color: var(--secondary-text-color);
      }

      .media-type-badge {
        position: absolute;
        top: 6px;
        left: 6px;
        background: rgba(0, 0, 0, 0.7);
        color: #fff;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 0.65em;
        text-transform: uppercase;
        font-weight: 600;
      }

      .loading-spinner {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 40px;
        color: var(--primary-color);
      }

      .empty-state {
        padding: 40px;
        text-align: center;
        color: var(--secondary-text-color);
      }

      .load-more-container {
        display: flex;
        justify-content: center;
        padding: 12px 16px 20px;
      }

      .load-more-button {
        padding: 8px 16px;
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9em;
        transition: background-color 0.2s, border-color 0.2s;
      }

      .load-more-button:hover:not(:disabled) {
        background: var(--primary-color);
        color: var(--text-primary-color);
        border-color: var(--primary-color);
      }

      .load-more-button:disabled {
        opacity: 0.6;
        cursor: default;
      }

      /* Back button */
      .back-button {
        background: transparent;
        border: none;
        color: var(--primary-color);
        cursor: pointer;
        padding: 8px 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.85em;
        font-weight: 500;
        transition: background-color 0.2s;
      }

      .back-button:hover {
        background-color: var(--secondary-background-color);
      }

      /* Inline detail view */
      .item-detail-view {
        padding: 12px;
        flex: 1;
        overflow-y: auto;
        min-height: 0;
      }

      .detail-header {
        display: flex;
        gap: 12px;
        margin-bottom: 12px;
      }

      .detail-poster {
        width: 80px;
        height: 120px;
        object-fit: cover;
        border-radius: 6px;
        flex-shrink: 0;
      }

      .detail-poster-placeholder {
        width: 80px;
        height: 120px;
        background: var(--secondary-background-color);
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .detail-poster-placeholder ha-icon {
        width: 32px;
        height: 32px;
        color: var(--disabled-text-color);
      }

      .detail-info {
        flex: 1;
      }

      .detail-info h3 {
        margin: 0 0 4px 0;
        color: var(--primary-text-color);
        font-size: 1.1em;
      }

      .detail-type {
        margin: 2px 0;
        font-size: 0.85em;
        color: var(--primary-color);
        font-weight: 500;
      }

      .detail-meta {
        margin: 2px 0;
        font-size: 0.8em;
        color: var(--secondary-text-color);
      }

      .detail-episode {
        color: var(--primary-color);
        font-weight: 500;
        font-size: 0.85em;
        margin: 2px 0;
      }

      .detail-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
      }

      .detail-button {
        flex: 1;
        min-width: 0;
        padding: 8px 10px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        transition: opacity 0.2s;
      }

      .detail-button:hover {
        opacity: 0.9;
      }

      .detail-button.primary {
        background: var(--primary-color);
        color: var(--text-primary-color);
      }

      .detail-button.secondary {
        background: var(--secondary-background-color);
        color: var(--primary-text-color);
      }

      .detail-button.tertiary {
        background: transparent;
        color: var(--primary-color);
        border: 1px solid var(--primary-color);
      }

      .detail-button.tertiary:hover {
        background: var(--primary-color);
        color: var(--text-primary-color);
      }

      /* Phone layouts keep posters readable even with six desktop columns. */
      @media (max-width: 600px) {
        button { min-height: 44px; min-width: 44px; }
        select, input { min-height: 44px; box-sizing: border-box; }
        .catalog-grid:not(.horizontal) {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          padding: 12px;
        }
        .catalog-grid.horizontal .catalog-item {
          width: calc((100% - 12px) / 2);
          min-width: 130px;
        }
        .detail-actions { flex-wrap: wrap; }
        .detail-button { min-height: 44px; }
        .item-title { font-size: 13px; line-height: 1.35; white-space: normal;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          height: auto; min-height: 2.7em; overflow: hidden; }
      }
    `;
  }

  constructor() {
    super();
    this._viewMode = 'popular';
    this._sortBy = 'catalog';
    this._catalogRequest = 0;
    this._catalogError = '';
    this._catalogPending = [];
    this._catalogNextSkip = 0;
    this._catalogHasMore = false;
    this._catalogLoaded = false;
    this._mediaType = 'movie';
    this._selectedGenre = null;
    this._catalogItems = [];
    this._loading = false;
    this._selectedItem = null;
    this._similarItems = null;
    this._similarSourceItem = null;
    this._loadingSimilar = false;
    this._searchQuery = '';
    this._searchDebounceTimer = null;
    this._loadingMore = false;
    this._searchHasMore = false;
    this._genres = [
      'Action', 'Adventure', 'Animation', 'Biography', 'Comedy', 'Crime',
      'Documentary', 'Drama', 'Family', 'Fantasy', 'History', 'Horror',
      'Mystery', 'Romance', 'Sci-Fi', 'Sport', 'Thriller', 'War', 'Western'
    ];

    // Bind methods that are used as event handlers
    this._closeSimilarView = this._closeSimilarView.bind(this);
    this._closeDetail = this._closeDetail.bind(this);
  }

  setConfig(config) {
    if (!config) {
      throw new Error('Invalid configuration');
    }
    this.config = {
      // Stremio account (for multi-account support)
      entity: undefined, // Stremio media player entity

      // Display options
      title: 'Browse Stremio',
      show_view_controls: true,
      show_type_controls: true,
      show_genre_filter: true,
      show_title: true, // Show titles below posters
      show_rating: true, // Show rating badge
      show_sort_controls: Boolean(config.management_mode),
      show_load_more: Boolean(config.management_mode),
      show_media_type_badge: false, // Show movie/series badge on poster
      show_similar_button: true, // Show "Find Similar" button in detail view

      // Layout options
      columns: 4,
      max_items: 50,
      card_height: 500, // Max height in pixels (0 for auto)
      poster_aspect_ratio: '2/3', // 2/3, 16/9, 1/1, 4/3
      horizontal_scroll: false, // Horizontal carousel mode

      // Behavior options
      default_view: 'popular',
      default_type: 'movie',
      default_sort: 'catalog',
      tap_action: 'details', // details, play, streams

      // Device integration
      apple_tv_entity: undefined, // For Apple TV handover

      ...config,
    };
    this._viewMode = this.config.default_view;
    this._mediaType = this.config.default_type;
    this._sortBy = this.config.default_sort;
  }

  // Define card type for UI editor
  static getConfigElement() {
    return document.createElement('stremio-browse-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:stremio-browse-card',
      entity: undefined,
      title: 'Browse Stremio',
      default_view: 'popular',
      default_type: 'movie',
      show_view_controls: true,
      show_type_controls: true,
      show_genre_filter: true,
      show_title: true,
      show_rating: true,
      show_media_type_badge: false,
      show_similar_button: true,
      columns: 4,
      max_items: 50,
      card_height: 500,
      poster_aspect_ratio: '2/3',
      horizontal_scroll: false,
      tap_action: 'details',
    };
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;

    // Load catalog on first hass set
    if (!oldHass && hass) {
      this._loadCatalog();
    }
  }

  get hass() {
    return this._hass;
  }

  async _loadCatalog(options = {}) {
    if (!this._hass) return;
    const append = options.append === true;
    if (append && (this._loading || this._loadingMore
        || (!this._catalogPending.length && !this._catalogHasMore))) return;

    const request = ++this._catalogRequest;
    if (append) {
      this._loadingMore = true;
    } else {
      this._loading = true;
      this._loadingMore = false;
      this._catalogPending = [];
      this._catalogNextSkip = 0;
      this._catalogHasMore = false;
      this._catalogLoaded = false;
    }
    this._catalogError = '';
    this.requestUpdate();

    try {
      const batchSize = Math.max(1, Math.min(100, Number(this.config.max_items) || 50));
      const data = { media_type: this._mediaType, catalog_type: this._viewMode, limit: 50, paginate: true };
      if (this._selectedGenre) data.genre = this._selectedGenre;
      // Buffer provider pages so 24-title UI batches never discard the remaining
      // titles from Cinemeta's native 50-position page.
      let pending = append ? [...this._catalogPending] : [];
      let nextSkip = append ? this._catalogNextSkip : 0;
      let hasMore = append ? this._catalogHasMore : true;
      const previous = append ? this._catalogItems : [];
      const seen = new Set(previous.map(item => this._catalogItemKey(item)));
      const batch = [];
      let fetchedPages = 0;
      while (batch.length < batchSize) {
        if (pending.length) {
          const item = pending.shift();
          const key = this._catalogItemKey(item);
          if (!key || seen.has(key)) continue;
          seen.add(key);
          batch.push(item);
          continue;
        }
        // Bound a click to three provider requests, including sparse New+genre pages.
        if (!hasMore || fetchedPages >= 3) break;
        const response = await this._callStremioService('browse_catalog', { ...data, skip: nextSkip });
        if (request !== this._catalogRequest) return;
        if (typeof response?.has_more !== 'boolean' || !Number.isInteger(response?.next_skip)
            || (response.has_more && response.next_skip <= nextSkip)) {
          throw new Error('Catalog pagination is not ready. Please refresh after Home Assistant starts.');
        }
        pending = (Array.isArray(response.items) ? response.items : [])
          .map(item => this._transformCatalogItem(item));
        nextSkip = response.next_skip;
        hasMore = response.has_more;
        fetchedPages += 1;
      }
      if (request !== this._catalogRequest) return;
      this._catalogItems = [...previous, ...batch];
      this._catalogPending = pending;
      this._catalogNextSkip = nextSkip;
      this._catalogHasMore = hasMore;
      this._catalogLoaded = true;
    } catch (err) {
      if (request !== this._catalogRequest) return;
      console.error('Failed to load catalog:', err);
      if (!append) this._catalogItems = [];
      this._catalogError = err.message || 'Catalog could not be loaded';
    } finally {
      if (request === this._catalogRequest) {
        this._loading = false;
        this._loadingMore = false;
        this.requestUpdate();
      }
    }
  }

  _catalogItemKey(item) {
    const id = item.imdb_id || item.id || item.media_content_id;
    return id ? `${item.type || this._mediaType}:${id}` : null;
  }

  _loadMoreCatalogResults() {
    return this._loadCatalog({ append: true });
  }

  _renderLoadMore(html) {
    const searching = Boolean(this._searchQuery && this._searchQuery.trim());
    const hasMore = searching ? this._searchHasMore
      : this._catalogPending.length > 0 || this._catalogHasMore;
    const enabled = searching || this.config.show_load_more;
    if (!enabled) return '';
    return html`
      <div class="load-more-container">
        ${this._catalogError ? html`<p class="sort-hint" role="alert">${this._catalogError}</p>` : ''}
        ${hasMore || this._catalogError ? html`
          <button class="load-more-button" ?disabled=${this._loadingMore || this._loading}
            aria-label="${searching ? 'Load more search results' : 'Load more catalog titles'}"
            @click=${() => searching
              ? this._performSearch({ append: this._catalogItems.length > 0 })
              : this._loadCatalog({ append: this._catalogLoaded })}>
            ${this._loadingMore ? 'Loading...' : this._catalogError ? 'Try again' : 'Load More'}
          </button>
        ` : this._catalogItems.length ? html`<p class="sort-hint" role="status">No more titles</p>` : ''}
      </div>
    `;
  }

  _handleSortChange(event) {
    this._sortBy = event.target.value;
    this.requestUpdate();
  }

  _getCatalogId() {
    // Build catalog identifier from current view, media type, and optional genre
    const mediaTypeSuffix = this._mediaType === 'movie' ? 'movies' : 'series';

    // If genre is selected, use genre-based browsing
    if (this._selectedGenre) {
      const genrePrefix = this._mediaType === 'movie' ? 'movie_genres' : 'series_genres';
      return `${genrePrefix}/${this._selectedGenre}`;
    }

    // Otherwise use view-based browsing (popular/new)
    return `${this._viewMode}_${mediaTypeSuffix}`;
  }

  _handleGenreChange(e) {
    const genre = e.target.value;
    this._selectedGenre = genre === 'all' ? null : genre;
    this._resetSearchState();
    this._loadCatalog();
  }

  _handleViewChange(view) {
    this._viewMode = view;
    this._resetSearchState();
    this._loadCatalog();
  }

  _handleTypeChange(type) {
    this._mediaType = type;
    // Preserve any active search when toggling movie/series so the user can
    // see the same query applied to the other type, matching the Stremio
    // webapp behaviour where switching tabs re-runs the search.
    if (this._searchQuery && this._searchQuery.trim() !== '') {
      this._searchHasMore = false;
      this._performSearch();
    } else {
      this._loadCatalog();
    }
  }

  _resetSearchState() {
    this._searchQuery = '';
    this._searchHasMore = false;
    if (this._searchDebounceTimer) {
      clearTimeout(this._searchDebounceTimer);
      this._searchDebounceTimer = null;
    }
  }

  _handleSearchInput(e) {
    this._searchQuery = e.target.value;
    // Debounce search to avoid excessive API calls
    clearTimeout(this._searchDebounceTimer);
    this._searchDebounceTimer = setTimeout(() => {
      this._performSearch();
    }, StremioBrowseCard.SEARCH_DEBOUNCE_DELAY);
  }

  _transformCatalogItem(item) {
    /**
     * Transform Cinemeta API response item to internal format.
     * Handles both media_source responses and direct API responses.
     */
    // If already in the right format (from media_source), return as-is
    if (item.thumbnail && item.media_content_id) {
      return item;
    }

    // Transform from Cinemeta API format
    return {
      ...item,
      title: item.name || item.title,
      thumbnail: item.poster,
      media_content_id: `${item.type}/${item.id}`,
      media_content_type: item.type === 'movie' ? 'video/mp4' : 'application/x-mpegURL',
    };
  }

  /**
   * Call a Stremio backend service that returns a response, using the
   * Home Assistant websocket API directly.
   *
   * `hass.callService(domain, service, data, target)` cannot return a
   * response: its 4th argument is a *target descriptor* and the websocket
   * schema rejects unknown keys such as `return_response`, which was the
   * cause of the previous "extra keys not allowed @ data['target']
   * ['return_response']" error from the search bar.
   *
   * @param {string} service - Stremio service name (e.g. 'search_catalog')
   * @param {object} data - Service data payload
   * @returns {Promise<object>} Unwrapped response payload (`response.response`
   *   if present, otherwise the top-level object).
   */
  async _callStremioService(service, data) {
    const response = await this._hass.callWS({
      type: 'call_service',
      domain: 'stremio',
      service,
      service_data: data,
      return_response: true,
    });
    // HA wraps service responses in a `response` envelope; some HA versions
    // omit the wrapper when the call goes through internal helpers, so be
    // defensive and unwrap consistently.
    if (response && typeof response === 'object' && 'response' in response) {
      return response.response;
    }
    return response;
  }

  async _performSearch(options = {}) {
    const append = options.append === true;

    if (!this._searchQuery || this._searchQuery.trim() === '') {
      // If search is empty, reload the normal catalog
      this._searchHasMore = false;
      await this._loadCatalog();
      return;
    }

    if (append) {
      this._loadingMore = true;
    } else {
      this._loading = true;
      this._loadingMore = false;
      this._searchHasMore = false;
    }
    this.requestUpdate();

    const pageSize = this.config.max_items || 50;
    const skip = append ? this._catalogItems.length : 0;
    const request = ++this._catalogRequest;
    this._catalogError = '';

    try {
      const result = await this._callStremioService('search_catalog', {
        query: this._searchQuery,
        media_type: this._mediaType,
        limit: pageSize,
        skip,
      });
      if (request !== this._catalogRequest) return;

      const items = (result && Array.isArray(result.items)) ? result.items : [];
      const transformed = items.map(item => this._transformCatalogItem(item));

      if (append) {
        this._catalogItems = [...this._catalogItems, ...transformed];
      } else {
        this._catalogItems = transformed;
      }
      // If the page came back full, there may be more results to fetch.
      this._searchHasMore = transformed.length >= pageSize;
    } catch (err) {
      if (request !== this._catalogRequest) return;
      console.error('Failed to search catalog:', err);
      if (!append) {
        this._catalogItems = [];
        this._searchHasMore = false;
      }
      this._catalogError = err.message || 'Search could not be loaded';
    } finally {
      if (request === this._catalogRequest) {
        this._loading = false;
        this._loadingMore = false;
        this.requestUpdate();
      }
    }
  }

  _loadMoreSearchResults() {
    if (this._loadingMore || this._loading || !this._searchHasMore) return;
    this._performSearch({ append: true });
  }

  _handleItemClick(item) {
    // Extract media type from content ID or use current media type filter
    const mediaType = this._getItemMediaType(item);

    // Management details and Title Info are title-level; choose episodes on demand.
    if (mediaType === 'series' && !this.config.management_mode) {
      console.log('[Browse Card] TV Series clicked, showing episode picker first');
      this._showEpisodePicker(item, 'detail');
      return;
    }

    // Movies and management-mode series open title details immediately.
    this._showDetailView(item);
  }

  _getItemMediaType(item) {
    // Try to determine media type from item or content ID
    // Check direct type property first (from similar content API)
    if (item.type) {
      return item.type === 'tvshow' ? 'series' : item.type;
    }
    if (item.media_content_type) {
      // Handle Home Assistant MediaType values (e.g., "video/movie", "video/tvshow")
      if (item.media_content_type.includes('movie')) {
        return 'movie';
      }
      if (item.media_content_type.includes('tvshow') || item.media_content_type.includes('series')) {
        return 'series';
      }
      return item.media_content_type === 'tvshow' ? 'series' : item.media_content_type;
    }
    if (item.media_content_id) {
      // Handle media-source:// URLs
      let path = item.media_content_id;
      if (path.includes('media-source://stremio/')) {
        path = path.replace('media-source://stremio/', '');
      }
      const parts = path.split('/');
      if (parts.length > 0) {
        const typeFromId = parts[0];
        if (typeFromId === 'series' || typeFromId === 'movie') {
          return typeFromId;
        }
      }
    }
    // Fallback to current filter
    return this._mediaType;
  }

  _showDetailView(item) {
    this._selectedItem = item;

    // Fire event for external listeners
    this.dispatchEvent(
      new CustomEvent('stremio-catalog-item-selected', {
        bubbles: true,
        composed: true,
        detail: {
          item,
          mediaId: item.media_content_id,
          title: item.title,
          type: this._getItemMediaType(item),
        },
      })
    );
  }

  _closeDetail() {
    this._selectedItem = null;
    this.requestUpdate();

    // Fire event for external listeners
    this.dispatchEvent(
      new CustomEvent('stremio-detail-closed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  _showEpisodePicker(item, mode = 'streams') {
    const onEpisodeSelected = (season, episode) => {
      console.log('[Browse Card] Episode selected:', { season, episode, mode });
      if (mode === 'detail') {
        // Create a modified item with selected episode info and show detail
        const itemWithEpisode = {
          ...item,
          selectedSeason: season,
          selectedEpisode: episode,
        };
        this._showDetailView(itemWithEpisode);
      } else {
        // Default: fetch streams for the selected episode
        this._fetchStreams(item, season, episode);
      }
    };

    // Extract media ID from item
    const mediaId = this._extractMediaId(item);

    // Use the global helper if available
    if (window.StremioEpisodePicker) {
      window.StremioEpisodePicker.show(
        this._hass,
        {
          title: item.title,
          type: 'series',
          poster: item.thumbnail,
          imdb_id: mediaId,
        },
        (selection) => {
          onEpisodeSelected(selection.season, selection.episode);
        }
      );
    } else {
      // Fallback: Create picker directly
      let picker = document.querySelector('stremio-episode-picker');
      if (!picker) {
        picker = document.createElement('stremio-episode-picker');
        document.body.appendChild(picker);
      }
      picker.hass = this._hass;
      picker.mediaItem = {
        title: item.title,
        type: 'series',
        imdb_id: mediaId,
      };
      picker.open = true;

      // Listen for selection
      const handler = (e) => {
        picker.removeEventListener('episode-selected', handler);
        onEpisodeSelected(e.detail.season, e.detail.episode);
      };
      picker.addEventListener('episode-selected', handler);
    }
  }

  _extractMediaId(item) {
    console.log('[Browse Card] _extractMediaId called with item:', item);
    // Extract IMDb ID from item - check direct properties first (from similar content API)
    if (item.imdb_id) {
      console.log('[Browse Card] Found imdb_id:', item.imdb_id);
      return item.imdb_id;
    }
    if (item.id && item.id.startsWith('tt')) {
      console.log('[Browse Card] Found id starting with tt:', item.id);
      return item.id;
    }
    // Try to extract from media_content_id
    // Format can be:
    // - "media-source://stremio/movie/tt1234567" (from browse_media)
    // - "movie/tt1234567" (simple format)
    if (item.media_content_id) {
      console.log('[Browse Card] Processing media_content_id:', item.media_content_id);
      // Handle media-source:// URLs
      if (item.media_content_id.includes('media-source://stremio/')) {
        const path = item.media_content_id.replace('media-source://stremio/', '');
        const parts = path.split('/');
        // Path is now "movie/tt1234567" or "series/tt1234567"
        if (parts.length > 1) {
          console.log('[Browse Card] Extracted ID from media-source URL:', parts[1]);
          return parts[1]; // Return the IMDB ID
        }
        return parts[0];
      }
      // Simple format: "type/id"
      const parts = item.media_content_id.split('/');
      if (parts.length > 1) {
        console.log('[Browse Card] Extracted ID from simple format:', parts[1]);
        return parts[1];
      }
      return parts[0];
    }
    console.log('[Browse Card] Falling back to item.id:', item.id);
    return item.id;
  }

  _openInStremio(item) {
    const type = this._getItemMediaType(item);
    const id = this._extractMediaId(item);

    // Validate ID format to prevent protocol injection
    if (id && typeof id === 'string') {
      const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');
      if (sanitizedId && sanitizedId.length > 0) {
        window.open(`stremio://detail/${type}/${sanitizedId}`, '_blank');
      } else {
        console.warn('Stremio Browse Card: Invalid media ID format', id);
      }
    }
  }

  _getStreams(item) {
    const mediaType = this._getItemMediaType(item);

    // For series, show episode picker first
    if (mediaType === 'series') {
      console.log('[Browse Card] TV Show detected, opening episode picker');
      this._showEpisodePicker(item, 'streams');
      return;
    }

    // For movies, fetch streams directly
    this._fetchStreams(item, null, null);
  }

  _fetchStreams(item, season, episode) {
    const id = this._extractMediaId(item);
    const mediaType = this._getItemMediaType(item);

    console.log('[Browse Card] Getting streams for:', id, mediaType, season ? `S${season}E${episode}` : '');
    this._showToast('Fetching streams...');

    const serviceData = {
      media_id: id,
      media_type: mediaType,
    };

    // Add season/episode for series
    if (mediaType === 'series' && season && episode) {
      serviceData.season = season;
      serviceData.episode = episode;
    }

    // Call service via shared helper (uses callWS so return_response works)
    this._callStremioService('get_streams', serviceData)
      .then((response) => {
        console.log('[Browse Card] Streams response:', response);

        const streams = response?.streams || null;

        if (streams && streams.length > 0) {
          console.log('[Browse Card] Found', streams.length, 'streams');
          const displayItem = { ...item };
          if (season && episode) {
            displayItem.title = `${item.title} - S${season}E${episode}`;
          }
          this._showStreamDialog(displayItem, streams);
        } else {
          console.log('[Browse Card] No streams in response:', response);
          this._showToast('No streams found for this title');
        }
      })
      .catch((error) => {
        console.error('[Browse Card] Failed to get streams:', error);
        this._showToast(`Failed to get streams: ${error.message}`, 'error');
      });
  }

  _showStreamDialog(item, streams) {
    console.log('[Browse Card] Opening stream dialog with', streams.length, 'streams');

    // Use the global helper if available
    if (window.StremioStreamDialog) {
      window.StremioStreamDialog.show(
        this._hass,
        {
          title: item.title,
          type: this._getItemMediaType(item),
          poster: item.thumbnail,
          imdb_id: this._extractMediaId(item),
        },
        streams,
        this.config.apple_tv_entity,
        { inspectOnly: Boolean(this.config.management_mode) }
      );
    } else {
      // Fallback: Create dialog directly
      let dialog = document.querySelector('stremio-stream-dialog');
      if (!dialog) {
        dialog = document.createElement('stremio-stream-dialog');
        document.body.appendChild(dialog);
      }
      dialog.hass = this._hass;
      dialog.mediaItem = {
        title: item.title,
        type: this._getItemMediaType(item),
        poster: item.thumbnail,
      };
      dialog.streams = streams;
      dialog.appleTvEntity = this.config.apple_tv_entity;
      dialog.inspectOnly = Boolean(this.config.management_mode);
      dialog.open = true;
    }
  }

  _addToLibrary(item) {
    const mediaType = this._getItemMediaType(item);
    const mediaId = this._extractMediaId(item);

    if (mediaId && this._hass) {
      this._hass.callService('stremio', 'add_to_library', {
        media_id: mediaId,
        media_type: mediaType,
      }).then(() => {
        this._showToast(`Added "${item.title}" to library`);
      }).catch((error) => {
        console.error('[Browse Card] Failed to add to library:', error);
        this._showToast(`Failed to add to library: ${error.message}`, 'error');
      });
    }
  }

  _getSimilarContent(item) {
    const mediaId = this._extractMediaId(item);
    if (!mediaId || !this._hass) {
      console.error('[Browse Card] Cannot get similar: missing ID or hass');
      return;
    }

    this._loadingSimilar = true;

    this._callStremioService('get_similar_content', {
      media_id: mediaId,
      limit: 20,
    })
      .then((response) => {
        console.log('[Browse Card] Similar content response:', response);
        this._loadingSimilar = false;

        const similarItems = response?.similar || null;

        if (similarItems && similarItems.length > 0) {
          console.log('[Browse Card] Found', similarItems.length, 'similar items');
          this._similarSourceItem = item;
          this._similarItems = similarItems;
          this._selectedItem = null; // Close detail view to show similar grid
        } else {
          console.log('[Browse Card] No similar content found');
          this._showToast('No similar content found');
        }
      })
      .catch((error) => {
        console.error('[Browse Card] Failed to get similar content:', error);
        this._loadingSimilar = false;
        this._showToast(`Failed to get similar content: ${error.message}`, 'error');
      });
  }

  /**
   * Close the similar items view and return to the catalog.
   */
  _closeSimilarView() {
    this._similarItems = null;
    this._similarSourceItem = null;
    this.requestUpdate();
  }

  /**
   * Handle click on a similar item - show its detail view.
   */
  _handleSimilarItemClick(item) {
    // Clear similar view and show detail for this item
    this._similarItems = null;
    this._similarSourceItem = null;

    // Normalize item properties for consistent handling
    // Similar items have poster/name/type/imdb_id, catalog items have thumbnail/title/media_content_id
    const normalizedItem = {
      ...item,
      title: item.title || item.name,
      thumbnail: item.thumbnail || item.poster,
      // Ensure media_content_id is set if not present (for _extractMediaId fallback)
      media_content_id: item.media_content_id || `${item.type || 'movie'}/${item.imdb_id || item.id}`,
    };

    this._selectedItem = normalizedItem;
  }

  /**
   * Render a similar item in the grid.
   */
  _renderSimilarItem(item) {
    const title = item.title || item.name || 'Unknown';
    const year = item.year || item.releaseInfo || '';

    return html`
      <div
        class="catalog-item"
        role="listitem"
        tabindex="0"
        @click=${() => this._handleSimilarItemClick(item)}
        @keydown=${(e) => e.key === 'Enter' && this._handleSimilarItemClick(item)}
        aria-label="${title}${year ? ` (${year})` : ''}"
        style="--poster-aspect-ratio: ${this.config.poster_aspect_ratio || '2/3'}"
      >
        <div class="item-poster-container">
          ${item.poster ? html`
            <img class="item-poster" src="${item.poster}" alt="" loading="lazy" />
          ` : html`
            <div class="item-poster-placeholder">
              <ha-icon icon="mdi:movie-outline"></ha-icon>
            </div>
          `}
        </div>
        ${item.type ? html`
          <span class="media-type-badge ${item.type}">${item.type === 'series' ? 'TV' : 'Movie'}</span>
        ` : ''}
        ${this.config.show_title !== false ? html`
          <div class="item-title" title="${title}">${title}</div>
        ` : ''}
        ${year ? html`
          <div class="item-year">${year}</div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Get streams for the item shown in detail view.
   * For series with a selected episode, use that. Otherwise, prompt for episode.
   */
  _getStreamsForDetailItem(item) {
    const mediaType = this._getItemMediaType(item);

    if (mediaType === 'series') {
      if (item.selectedSeason && item.selectedEpisode) {
        // Episode already selected, fetch streams directly
        this._fetchStreams(item, item.selectedSeason, item.selectedEpisode);
      } else {
        // No episode selected, show picker
        this._showEpisodePicker(item, 'streams');
      }
    } else {
      // Movie - fetch directly
      this._fetchStreams(item, null, null);
    }
  }

  _showToast(message, type = 'info') {
    const event = new CustomEvent('hass-notification', {
      detail: { message: message },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
    console.log(`[Browse Card] Toast: ${message}`);
  }

  render() {
    const columns = Number(this.config.columns || 5);
    const posterAspectRatio = this.config.poster_aspect_ratio || '2/3';
    const cardHeight = this.config.card_height > 0 ? `${this.config.card_height}px` : 'none';

    // Calculate height ratio for padding-bottom technique
    // For aspect ratio "w/h" (width/height), padding-bottom needs height/width * 100
    // e.g., "2/3" -> height/width = 3/2 = 1.5 -> 150%
    let posterHeightRatio = 150; // default 2:3 -> 150%
    if (posterAspectRatio.includes('/')) {
      const [w, h] = posterAspectRatio.split('/').map(Number);
      if (w > 0 && h > 0) {
        posterHeightRatio = (h / w) * 100;
      }
    }

    const gridStyle = `--card-max-height: ${cardHeight}; --grid-columns: ${columns}; --poster-height-ratio: ${posterHeightRatio};`;

    // If showing similar items, show that view
    if (this._similarItems && this._similarItems.length > 0) {
      const sourceTitle = this._similarSourceItem?.title || this._similarSourceItem?.name || 'Unknown';
      return html`
        <ha-card>
          <div class="header">
            <button class="back-button" @click=${this._closeSimilarView} aria-label="Back to browse">
              <ha-icon icon="mdi:arrow-left"></ha-icon>
              Back to Browse
            </button>
            <h2 class="header-title" style="margin-top: 12px;">
              Similar to "${sourceTitle}"
              <span class="count-badge">(${this._similarItems.length})</span>
            </h2>
          </div>
          <div
            class="catalog-grid ${this.config.horizontal_scroll ? 'horizontal' : ''}"
            role="list"
            aria-label="Similar items"
            style="${gridStyle}"
          >
            ${this._similarItems.map(item => this._renderSimilarItem(item))}
          </div>
        </ha-card>
      `;
    }

    // If an item is selected, show detail view instead of grid
    if (this._selectedItem) {
      return html`
        <ha-card>
          <div class="header detail-mode">
            <button class="back-button" @click=${this._closeDetail} aria-label="Back to browse">
              <ha-icon icon="mdi:arrow-left"></ha-icon>
              Back to Browse
            </button>
          </div>
          ${this._renderDetailView()}
        </ha-card>
      `;
    }

    // Normal grid view
    return html`
      <ha-card>
        <div class="header">
          <div class="header-title">${this.config.title}</div>

          ${this.config.show_view_controls ? html`
            <div class="control-row">
              <button
                class="control-button ${this._viewMode === 'popular' ? 'active' : ''}"
                aria-label="Show popular content"
                aria-pressed="${this._viewMode === 'popular'}"
                @click=${() => this._handleViewChange('popular')}
              >
                🔥 Popular
              </button>
              <button
                class="control-button ${this._viewMode === 'new' ? 'active' : ''}"
                aria-label="Show new content"
                aria-pressed="${this._viewMode === 'new'}"
                @click=${() => this._handleViewChange('new')}
              >
                🆕 New
              </button>
            </div>
          ` : ''}

          ${this.config.show_type_controls ? html`
            <div class="control-row">
              <button
                class="control-button ${this._mediaType === 'movie' ? 'active' : ''}"
                aria-label="Show movies"
                aria-pressed="${this._mediaType === 'movie'}"
                @click=${() => this._handleTypeChange('movie')}
              >
                🎬 Movies
              </button>
              <button
                class="control-button ${this._mediaType === 'series' ? 'active' : ''}"
                aria-label="Show TV shows"
                aria-pressed="${this._mediaType === 'series'}"
                @click=${() => this._handleTypeChange('series')}
              >
                📺 TV Shows
              </button>
            </div>
          ` : ''}

          ${this.config.show_genre_filter ? html`
            <div class="control-row">
              <select
                class="control-button"
                style="width: 100%; cursor: pointer;"
                aria-label="Filter by genre"
                @change=${this._handleGenreChange}
                .value=${this._selectedGenre || 'all'}
              >
                <option value="all">🎭 All Genres</option>
                ${this._genres.map(genre => html`
                  <option value="${genre}">${genre}</option>
                `)}
              </select>
            </div>
          ` : ''}

          ${this.config.show_sort_controls ? html`
            <div class="control-row">
              <select class="control-button" style="width:100%;cursor:pointer"
                aria-label="Sort catalog" .value=${this._sortBy}
                @change=${event => this._handleSortChange(event)}>
                <option value="catalog">Catalog order</option>
                <option value="imdb_desc">IMDb: highest first</option>
                <option value="imdb_asc">IMDb: lowest first</option>
              </select>
            </div>
            <p class="sort-hint">
              ${this._viewMode === 'new' && !this._searchQuery ? `New: ${new Date().getFullYear()} releases. ` : ''}
              IMDb sorting applies to loaded results; unrated titles stay last.
            </p>
          ` : ''}

          <div class="search-container">
            <ha-icon class="search-icon" icon="mdi:magnify"></ha-icon>
            <input
              type="text"
              class="search-input"
              placeholder="Search catalog..."
              aria-label="Search catalog"
              .value=${this._searchQuery}
              @input=${this._handleSearchInput}
            />
          </div>
        </div>

        ${this._loading ? html`
          <div class="loading-spinner">
            <ha-circular-progress active></ha-circular-progress>
          </div>
        ` : html`
          <div class="catalog-results" style="${gridStyle}">
            ${this._catalogItems.length ? html`
              <div class="catalog-grid ${this.config.horizontal_scroll ? 'horizontal' : ''}"
                role="list" aria-label="Catalog items">
                ${sortCatalogItems(this._catalogItems, this._sortBy).map(item => this._renderCatalogItem(item))}
              </div>
            ` : html`
              <div class="empty-state">
                ${this._catalogError || (this._searchQuery ? `No results for "${this._searchQuery}"`
                  : this._catalogHasMore ? 'No matching titles in this batch. Load More to continue.'
                  : `No ${this._viewMode} ${this._mediaType === 'movie' ? 'movies' : 'TV shows'} found`)}
              </div>
            `}
            ${this._renderLoadMore(html)}
          </div>
        `}
      </ha-card>
    `;
  }

  _renderCatalogItem(item) {
    const mediaType = this._getItemMediaType(item);
    const score = imdbScore(item);

    return html`
      <div
        class="catalog-item"
        role="listitem"
        tabindex="0"
        aria-label="${item.title}${score !== null ? `, IMDb ${score.toFixed(1)}` : ''}"
        @click=${() => this._handleItemClick(item)}
        @keydown=${(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this._handleItemClick(item);
          }
        }}
      >
        <div class="catalog-poster-container">
          ${item.thumbnail ? html`
            <img
              class="catalog-poster"
              src="${item.thumbnail}"
              alt=""
              loading="lazy"
            />
          ` : html`
            <div class="catalog-poster-placeholder">
              <ha-icon icon="mdi:movie-outline"></ha-icon>
            </div>
          `}
          ${this.config.show_rating !== false && score !== null ? html`
            <span class="imdb-badge" aria-label="IMDb score ${score.toFixed(1)}">★ ${score.toFixed(1)}</span>
          ` : ''}
        </div>
        ${this.config.show_media_type_badge ? html`
          <span class="media-type-badge ${mediaType}">${mediaType === 'series' ? 'TV' : 'Movie'}</span>
        ` : ''}
        ${this.config.show_title !== false ? html`
          <div class="catalog-title">${item.title}</div>
        ` : ''}
      </div>
    `;
  }

  _renderDetailView() {
    const item = this._selectedItem;
    const title = item.title || 'Unknown';
    const mediaType = this._getItemMediaType(item);
    const hasSelectedEpisode = mediaType === 'series' && item.selectedSeason && item.selectedEpisode;
    const episodeLabel = hasSelectedEpisode
      ? `S${String(item.selectedSeason).padStart(2, '0')}E${String(item.selectedEpisode).padStart(2, '0')}`
      : null;

    return html`
      <div class="item-detail-view">
        <div class="detail-header">
          ${item.thumbnail ? html`
            <img class="detail-poster" src="${item.thumbnail}" alt="${title}" />
          ` : html`
            <div class="detail-poster-placeholder">
              <ha-icon icon="mdi:movie-outline"></ha-icon>
            </div>
          `}
          <div class="detail-info">
            <h3>${title}</h3>
            <p class="detail-type">${mediaType === 'series' ? 'TV Series' : 'Movie'}</p>
            ${episodeLabel ? html`<p class="detail-episode">Episode: ${episodeLabel}</p>` : ''}
            ${item.year ? html`<p class="detail-meta">Year: ${item.year}</p>` : ''}
          </div>
        </div>

        <div class="detail-actions">
          ${mediaType === 'series' ? html`
            <button class="detail-button tertiary" @click=${() => this._showEpisodePicker(item, 'detail')}>
              <ha-icon icon="mdi:playlist-play"></ha-icon>
              ${hasSelectedEpisode ? 'Change Episode' : 'Select Episode'}
            </button>
          ` : ''}
          ${this.config.show_similar_button !== false ? html`
            <button class="detail-button tertiary" @click=${() => this._getSimilarContent(item)} ?disabled=${this._loadingSimilar}>
              <ha-icon icon="mdi:movie-search"></ha-icon>
              ${this._loadingSimilar ? 'Loading...' : 'Find Similar'}
            </button>
          ` : ''}
          ${!this.config.management_mode ? html`<button class="detail-button tertiary" @click=${() => this._addToLibrary(item)}>
            <ha-icon icon="mdi:plus"></ha-icon>
            Add to Library
          </button>` : ''}
        </div>

        <div class="detail-actions">
          ${!this.config.management_mode ? html`<button class="detail-button primary" @click=${() => this._openInStremio(item)}>
            <ha-icon icon="mdi:play"></ha-icon>
            Open in Stremio
          </button>` : ''}
          <button class="detail-button secondary" @click=${() => this._getStreamsForDetailItem(item)}>
            <ha-icon icon="mdi:format-list-bulleted"></ha-icon>
            Get Streams
          </button>
        </div>
        ${renderManagementActions(this, item, html)}
      </div>
    `;
  }

  // For UI card editor support
  getCardSize() {
    return 3;
  }

  getGridOptions() {
    const defaults = {
      rows: 6,
      columns: 6,
      min_rows: 4,
      min_columns: 3,
    };

    if (this.config?.layout && typeof this.config.layout === 'object') {
      return { ...defaults, ...this.config.layout };
    }

    return defaults;
  }
}

// Guard against duplicate registration
if (!customElements.get('stremio-browse-card')) {
  customElements.define('stremio-browse-card', StremioBrowseCard);
}

// Editor for Browse Card
class StremioBrowseCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { type: Object },
      _config: { type: Object },
      _stremioEntities: { type: Array },
      _appleTvEntities: { type: Array },
      _expandedSections: { type: Object },
    };
  }

  constructor() {
    super();
    this._stremioEntities = [];
    this._appleTvEntities = [];
    this._expandedSections = {
      account: true,
      display: false,
      layout: false,
      behavior: false,
      device: false,
    };
  }

  setConfig(config) {
    this._config = config;
  }

  updated(changedProps) {
    if (changedProps.has('hass') && this.hass) {
      this._updateEntities();
    }
  }

  _updateEntities() {
    // Find Stremio media player entities (represent each account)
    this._stremioEntities = Object.keys(this.hass.states)
      .filter(entityId =>
        entityId.startsWith('media_player.') &&
        entityId.toLowerCase().includes('stremio')
      )
      .map(entityId => ({
        entity_id: entityId,
        friendly_name: this.hass.states[entityId].attributes.friendly_name || entityId,
      }));

    // Find Apple TV media_player entities
    this._appleTvEntities = Object.keys(this.hass.states)
      .filter(entityId => {
        if (!entityId.startsWith('media_player.')) return false;
        const state = this.hass.states[entityId];
        const friendlyName = (state.attributes.friendly_name || '').toLowerCase();
        const entityLower = entityId.toLowerCase();
        // Match Apple TV by entity ID or friendly name
        return entityLower.includes('apple_tv') ||
               entityLower.includes('appletv') ||
               friendlyName.includes('apple tv') ||
               friendlyName.includes('appletv');
      })
      .map(entityId => ({
        entity_id: entityId,
        friendly_name: this.hass.states[entityId].attributes.friendly_name || entityId,
      }));
  }

  _selectEntity(entityId) {
    this._config = { ...this._config, entity: entityId };
    this.dispatchEvent(new CustomEvent('config-changed', {
      bubbles: true,
      composed: true,
      detail: { config: this._config },
    }));
  }

  _selectAppleTv(entityId) {
    this._config = { ...this._config, apple_tv_entity: entityId || undefined };
    this.dispatchEvent(new CustomEvent('config-changed', {
      bubbles: true,
      composed: true,
      detail: { config: this._config },
    }));
  }

  _toggleSection(section) {
    this._expandedSections = {
      ...this._expandedSections,
      [section]: !this._expandedSections[section],
    };
  }

  render() {
    if (!this.hass || !this._config) {
      return html``;
    }

    return html`
      <div class="card-config">
        <!-- Stremio Account Section -->
        <div class="config-section">
          <div class="section-header" @click=${() => this._toggleSection('account')}>
            <ha-icon icon="mdi:account"></ha-icon>
            <span>Stremio Account</span>
            <ha-icon class="expand-icon ${this._expandedSections.account ? 'expanded' : ''}" icon="mdi:chevron-down"></ha-icon>
          </div>
          ${this._expandedSections.account ? html`
            <div class="section-content">
              ${this._stremioEntities?.length > 0 ? html`
                <div class="entity-buttons">
                  ${this._stremioEntities.map(entity => html`
                    <button
                      class="entity-btn ${this._config.entity === entity.entity_id ? 'selected' : ''}"
                      @click=${() => this._selectEntity(entity.entity_id)}
                    >
                      <ha-icon icon="mdi:account-circle"></ha-icon>
                      <span>${entity.friendly_name}</span>
                    </button>
                  `)}
                </div>
              ` : html`
                <div class="no-entities">
                  <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
                  <span>No Stremio accounts found.</span>
                </div>
              `}

              <ha-entity-picker
                .hass=${this.hass}
                .value=${this._config.entity || ''}
                .configValue=${'entity'}
                .includeDomains=${['media_player']}
                label="Or select manually"
                allow-custom-entity
                @value-changed=${this._valueChanged}
              ></ha-entity-picker>
              <p class="helper-text">Select a Stremio account to browse catalogs from that user's library.</p>
            </div>
          ` : ''}
        </div>

        <!-- Display Section -->
        <div class="config-section">
          <div class="section-header" @click=${() => this._toggleSection('display')}>
            <ha-icon icon="mdi:palette"></ha-icon>
            <span>Display Options</span>
            <ha-icon class="expand-icon ${this._expandedSections.display ? 'expanded' : ''}" icon="mdi:chevron-down"></ha-icon>
          </div>
          ${this._expandedSections.display ? html`
            <div class="section-content">
              <ha-textfield
                label="Card Title"
                .value=${this._config.title || 'Browse Stremio'}
                .configValue=${'title'}
                @input=${this._valueChanged}
              ></ha-textfield>

              <div class="toggle-group">
                <ha-formfield label="Show View Controls (Popular/New)">
                  <ha-switch
                    .checked=${this._config.show_view_controls !== false}
                    .configValue=${'show_view_controls'}
                    @change=${this._valueChanged}
                  ></ha-switch>
                </ha-formfield>

                <ha-formfield label="Show Type Controls (Movie/Series)">
                  <ha-switch
                    .checked=${this._config.show_type_controls !== false}
                    .configValue=${'show_type_controls'}
                    @change=${this._valueChanged}
                  ></ha-switch>
                </ha-formfield>

                <ha-formfield label="Show Genre Filter">
                  <ha-switch
                    .checked=${this._config.show_genre_filter !== false}
                    .configValue=${'show_genre_filter'}
                    @change=${this._valueChanged}
                  ></ha-switch>
                </ha-formfield>

                <ha-formfield label="Show Title Below Poster">
                  <ha-switch
                    .checked=${this._config.show_title !== false}
                    .configValue=${'show_title'}
                    @change=${this._valueChanged}
                  ></ha-switch>
                </ha-formfield>

                <ha-formfield label="Show Media Type Badge">
                  <ha-switch
                    .checked=${this._config.show_media_type_badge === true}
                    .configValue=${'show_media_type_badge'}
                    @change=${this._valueChanged}
                  ></ha-switch>
                </ha-formfield>

                <ha-formfield label="Show Find Similar Button">
                  <ha-switch
                    .checked=${this._config.show_similar_button !== false}
                    .configValue=${'show_similar_button'}
                    @change=${this._valueChanged}
                  ></ha-switch>
                </ha-formfield>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Layout Section -->
        <div class="config-section">
          <div class="section-header" @click=${() => this._toggleSection('layout')}>
            <ha-icon icon="mdi:view-grid"></ha-icon>
            <span>Layout</span>
            <ha-icon class="expand-icon ${this._expandedSections.layout ? 'expanded' : ''}" icon="mdi:chevron-down"></ha-icon>
          </div>
          ${this._expandedSections.layout ? html`
            <div class="section-content">
              <div class="input-row">
                <ha-textfield
                  label="Columns"
                  .value=${this._config.columns || 4}
                  .configValue=${'columns'}
                  type="number"
                  min="2"
                  max="8"
                  @input=${this._valueChanged}
                ></ha-textfield>

                <ha-textfield
                  label="Max Items"
                  .value=${this._config.max_items || 50}
                  .configValue=${'max_items'}
                  type="number"
                  min="1"
                  max="100"
                  @input=${this._valueChanged}
                ></ha-textfield>
              </div>

              <div class="input-row">
                <ha-textfield
                  label="Card Height (px, 0 for auto)"
                  .value=${this._config.card_height || 0}
                  .configValue=${'card_height'}
                  type="number"
                  min="0"
                  max="1000"
                  @input=${this._valueChanged}
                ></ha-textfield>
              </div>

              <ha-select
                label="Poster Aspect Ratio"
                .value=${this._config.poster_aspect_ratio || '2/3'}
                .configValue=${'poster_aspect_ratio'}
                @selected=${this._selectChanged}
                @closed=${(e) => e.stopPropagation()}
              >
                <mwc-list-item value="2/3">2:3 (Movie Poster)</mwc-list-item>
                <mwc-list-item value="16/9">16:9 (Widescreen)</mwc-list-item>
                <mwc-list-item value="1/1">1:1 (Square)</mwc-list-item>
                <mwc-list-item value="4/3">4:3 (Classic)</mwc-list-item>
              </ha-select>

              <ha-formfield label="Horizontal Scroll Mode">
                <ha-switch
                  .checked=${this._config.horizontal_scroll === true}
                  .configValue=${'horizontal_scroll'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
            </div>
          ` : ''}
        </div>

        <!-- Behavior Section -->
        <div class="config-section">
          <div class="section-header" @click=${() => this._toggleSection('behavior')}>
            <ha-icon icon="mdi:gesture-tap"></ha-icon>
            <span>Behavior</span>
            <ha-icon class="expand-icon ${this._expandedSections.behavior ? 'expanded' : ''}" icon="mdi:chevron-down"></ha-icon>
          </div>
          ${this._expandedSections.behavior ? html`
            <div class="section-content">
              <ha-select
                label="Default View"
                .value=${this._config.default_view || 'popular'}
                .configValue=${'default_view'}
                @selected=${this._selectChanged}
                @closed=${(e) => e.stopPropagation()}
              >
                <mwc-list-item value="popular">Popular</mwc-list-item>
                <mwc-list-item value="new">New</mwc-list-item>
              </ha-select>

              <ha-select
                label="Default Media Type"
                .value=${this._config.default_type || 'movie'}
                .configValue=${'default_type'}
                @selected=${this._selectChanged}
                @closed=${(e) => e.stopPropagation()}
              >
                <mwc-list-item value="movie">Movies</mwc-list-item>
                <mwc-list-item value="series">TV Series</mwc-list-item>
              </ha-select>

              <ha-select
                label="Tap Action"
                .value=${this._config.tap_action || 'details'}
                .configValue=${'tap_action'}
                @selected=${this._selectChanged}
                @closed=${(e) => e.stopPropagation()}
              >
                <mwc-list-item value="details">Show Details</mwc-list-item>
                <mwc-list-item value="play">Play Directly</mwc-list-item>
                <mwc-list-item value="streams">Get Streams</mwc-list-item>
              </ha-select>
            </div>
          ` : ''}
        </div>

        <!-- Device Section -->
        <div class="config-section">
          <div class="section-header" @click=${() => this._toggleSection('device')}>
            <ha-icon icon="mdi:devices"></ha-icon>
            <span>Device Integration</span>
            <ha-icon class="expand-icon ${this._expandedSections.device ? 'expanded' : ''}" icon="mdi:chevron-down"></ha-icon>
          </div>
          ${this._expandedSections.device ? html`
            <div class="section-content">
              <p class="helper-text">Select an Apple TV to enable handover functionality.</p>

              ${this._appleTvEntities?.length > 0 ? html`
                <div class="entity-buttons">
                  ${this._appleTvEntities.map(entity => html`
                    <button
                      class="entity-btn ${this._config.apple_tv_entity === entity.entity_id ? 'selected' : ''}"
                      @click=${() => this._selectAppleTv(entity.entity_id)}
                    >
                      <ha-icon icon="mdi:apple"></ha-icon>
                      <span>${entity.friendly_name}</span>
                    </button>
                  `)}
                  <button
                    class="entity-btn ${!this._config.apple_tv_entity ? 'selected' : ''}"
                    @click=${() => this._selectAppleTv('')}
                  >
                    <ha-icon icon="mdi:close"></ha-icon>
                    <span>None</span>
                  </button>
                </div>
              ` : ''}

              <ha-entity-picker
                .hass=${this.hass}
                .value=${this._config.apple_tv_entity || ''}
                .configValue=${'apple_tv_entity'}
                .includeDomains=${['media_player']}
                label="Apple TV Entity"
                allow-custom-entity
                @value-changed=${this._valueChanged}
              ></ha-entity-picker>
            </div>
          </div>
        ` : ''}
      </ha-card>
    `;
  }

  _selectChanged(ev) {
    const target = ev.target;
    if (target.configValue) {
      this._updateConfig(target.configValue, ev.detail.value || target.value);
    }
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;

    const target = ev.target;
    let value;

    if (target.configValue) {
      if (target.checked !== undefined) {
        value = target.checked;
      } else if (target.value !== undefined) {
        value = target.value;
        if (target.type === 'number') {
          value = Number(value);
        }
      }
      this._updateConfig(target.configValue, value);
    }
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    }));
  }

  static get styles() {
    return css`
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px;
      }

      .config-section {
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        overflow: hidden;
      }

      .section-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: var(--secondary-background-color);
        cursor: pointer;
        user-select: none;
      }

      .section-header:hover {
        background: var(--primary-background-color);
      }

      .section-header span {
        flex: 1;
        font-weight: 500;
      }

      .expand-icon {
        transition: transform 0.2s;
      }

      .expand-icon.expanded {
        transform: rotate(180deg);
      }

      .section-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 16px;
      }

      .toggle-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .input-row {
        display: flex;
        gap: 12px;
      }

      .input-row > * {
        flex: 1;
      }

      .helper-text {
        color: var(--secondary-text-color);
        font-size: 0.9em;
        margin: 0;
      }

      ha-entity-picker,
      ha-textfield,
      ha-select {
        width: 100%;
      }

      .entity-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 12px;
      }

      .entity-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background: var(--secondary-background-color);
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        color: var(--primary-text-color);
        transition: all 0.2s ease;
      }

      .entity-btn:hover {
        background: var(--primary-background-color);
        border-color: var(--primary-color);
      }

      .entity-btn.selected {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: var(--text-primary-color);
      }

      .entity-btn span {
        flex: 1;
        text-align: left;
      }

      .no-entities {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        background: var(--warning-color, #ffc107);
        border-radius: 8px;
        color: var(--primary-text-color);
        margin-bottom: 12px;
      }
    `;
  }
}

// Guard against duplicate registration
if (!customElements.get('stremio-browse-card-editor')) {
  customElements.define('stremio-browse-card-editor', StremioBrowseCardEditor);
}

// Note: Card registration with window.customCards is handled in stremio-card-bundle.js
// to prevent duplicate entries

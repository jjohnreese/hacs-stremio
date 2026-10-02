# Stremio cards





Phone layouts use two poster columns with readable titles and larger carousel items. Desktop column settings remain available; the library respects its configured scrolling height.

Series now open title details on the first click in management mode. Title Info does not require an episode; select an episode only for episode-specific watched status or streams.

The integration automatically registers one bundle resource for storage-mode dashboards. [Dashboard setup](dashboard.md) covers YAML resources and the complete Cinema example.

| Card | Purpose | Detail tap action |
| --- | --- | --- |
| `custom:stremio-library-card` | Search/filter/sort library, grid or carousel, inline details and Find Similar. | `show_detail` |
| `custom:stremio-continue-watching-card` | Resume items, progress and episodes, grid or carousel. | `details` |
| `custom:stremio-browse-card` | Popular/New movie/series catalogs, genre, search, IMDb sort, Load More. | `details` |
| `custom:stremio-recommendations-card` | Preference-based suggestions, movie/series filter, reason labels and Find Similar. | `details` |
| `custom:stremio-player-card` | Existing player state, metadata and playback controls. | Card-specific controls |
| `custom:stremio-media-details-card` | Standalone title details and inherited actions. | Card-specific controls |

Stream Dialog and Episode Picker are embedded helper components, not separate dashboard cards. Title Info is a native modal. The four collection cards support opt-in management mode; Player and standalone Media Details retain their inherited playback behavior.

## Common management options

| Option | Meaning |
| --- | --- |
| `management_mode` | Opt in to library/watch controls and hide launch/forward controls. Default false. |
| `library_entity` | Library Count sensor for the matching account; membership comes from `attributes.items`. |
| `config_entry_id` | Explicit account selection for mutations; recommended with multiple accounts. |
| `columns`, `max_items`, `card_height` | Layout, visible items/batch size and scroll-area height. |
| `horizontal_scroll` | Carousel layout on library, Continue Watching and recommendations. |

## Browse options

| Option | Default / values |
| --- | --- |
| `default_type` | `movie` / `series` |
| `default_view` | `popular` / `new` |
| `show_rating` | IMDb badges; true by default. |
| `show_sort_controls` | True in management mode; enables catalog order / IMDb highest / IMDb lowest. |
| `default_sort` | `catalog`, `imdb_desc`, `imdb_asc` |
| `show_load_more` | True in management mode; normal and search results have separate continuation. |
| `max_items` | 1â€“100; displayed batch size, not the provider cursor increment. |

IMDb sorting uses all currently loaded items without altering original provider order. Equal scores keep their order; unrated entries remain last in both directions. New uses the current-year feed. Native provider pages advance by 50 positions even if fewer valid items are returned. Buffered items are shown before another network request; a click makes at most three provider requests for sparse genre matches. Empty provider pages signal exhaustion; errors offer retry without discarding the cursor. Switching feeds cancels stale results. Search results share the same scroll area and compact natural-height rows.

See [watch management](watch-management.md), [Title Info](title-info.md), [the screenshot gallery](screenshots/README.md), and each card's visual editor for additional inherited display options.

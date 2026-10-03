# Fork release 0.6.3 — 2026-10-03

- Fix Picked for you Load More updating its internal batch count without rendering additional posters. The render filter now accepts visible-count changes.
- Replace the bottom Load More button with a matching poster tile at the end of the carousel or grid, with native keyboard and touch access.
- Add a render-gate regression for All, Movies and TV Series.

# Fork release 0.6.2 — 2026-10-03



- Correct the recommendation service limit from 50 to 100 in both the registered Python validator and service UI metadata. This fixes the `value must be at most 50` error introduced by the 0.6.1 card request.

- Retain typed recommendations and buffered Load More.

- Add actual Voluptuous service-schema regressions for all filters, defaults, boundaries and metadata agreement.



# Fork release 0.6.1 — 2026-10-03

- Fix Top Picks TV Series filtering by requesting recommendations for the selected media type. All now interleaves movies and shows, including the popular fallback when library genre metadata is absent.
- Add Load More to Top Picks. The card buffers up to 100 recommendations per selected filter and reveals them in `max_items` batches, preserving order and removing duplicates.
- Fetch additional popular catalog pages when library exclusions drain the first page, and replace the misleading "add more items" empty message.
- Ignore stale recommendation responses after a filter change, including a return to the cached All tab.
- Keep the media-player title, poster, episode and progress synchronized with coordinator data even while its state remains playing. Identical polling results do not trigger a state write.
- Add 14 regression tests. No personal account, library, entity or dashboard data is included in fixtures.

# Fork release 0.6.0 — 2026-10-02





Phone layouts use two poster columns with readable titles and larger carousel items. Desktop column settings remain available; the library respects its configured scrolling height.

Series now open title details on the first click in management mode. Title Info does not require an episode; select an episode only for episode-specific watched status or streams.

- Add opt-in library/watch management, episode-aware watched/unwatched, resume clearing and read-back verification.
- Preserve history on membership changes and serialize local mutations with a per-client lock.
- Add native Title Info with bounded public metadata and loading/retry states.
- Correct Popular/New routing, add numeric IMDb loaded-result sorting and badges.
- Add native-page buffered Load More, retry/feed-switch guards and compact search rows.
- Include a complete account-neutral Cinema dashboard, setup substitutions, feature/reference documentation and offline regression tests.
- Point fork metadata/support links to jjohnreese/hacs-stremio and retain upstream credits/history.

See docs/validation.md for current checks and limitations. Live account mutations and external-device playback are not established by offline tests.

---

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-01-XX

### Added

- **Comprehensive UI Editor Support** for all cards
  - Collapsible sections (Entity, Display, Layout, Behavior, Device)
  - All configuration options now accessible via visual editor
  - Entity quick-select buttons for Stremio sensors

- **New Configuration Options** for Library and Continue Watching cards:
  - `poster_aspect_ratio`: 2:3, 16:9, 1:1, 4:3 options
  - `horizontal_scroll`: Carousel mode for compact layouts
  - `card_height`: Custom card height (px) or auto
  - `show_title`: Toggle titles below posters
  - `show_media_type_badge`: Movie/TV badge overlay
  - `tap_action`: details, play, or streams on tap
  - `default_sort`: recent, title, or progress
  - `apple_tv_entity`: Device integration for handover

- **New Configuration Options** for Browse Card:
  - Layout options: columns, poster_aspect_ratio, horizontal_scroll
  - Display toggles: show_title, show_rating
  - Behavior options: default_view, default_type, tap_action

- **New Configuration Options** for Media Details Card:
  - `show_description`, `show_progress` toggles
  - `expand_description`: Start expanded
  - `max_description_lines`: Collapsed line limit
  - `apple_tv_entity`: Device handover support

- **New Configuration Options** for Player Card:
  - `show_browse_button`, `show_backdrop`
  - `compact_mode`: Smaller layout option
  - `apple_tv_entity`: Device handover support

### Changed

- **Breaking**: Replaced `stremio-api` dependency with native aiohttp implementation
  - Resolves pydantic v2 dependency conflict with Home Assistant's pydantic v1
  - Improves compatibility and reduces external dependencies
  - All API calls now use aiohttp directly with proper error handling

- Card editors now use modern collapsible section design consistent with HA style
- Improved CSS variables for dynamic grid columns and poster aspect ratios
- Version bumped to 0.4.0 for automatic cache busting

## [0.3.6] - Previous Release

## [1.0.0] - 2026-01-17

### Added

- **Initial Release** 🎉

#### Core Features

- Config flow for easy setup with Stremio credentials
- Options flow for customizing update intervals and features
- DataUpdateCoordinator for efficient API polling

#### Entities

- **Sensors**
  - Current media sensor (shows currently playing content)
  - Last watched sensor
  - Library count sensor
  - Continue watching count sensor
- **Binary Sensors**
  - Is playing binary sensor
  - Has new content binary sensor
- **Media Player**
  - Read-only media player entity with playback state

#### Services

- `stremio.search_library` - Search your library
- `stremio.get_stream_url` - Get playable stream URLs
- `stremio.add_to_library` - Add media to library
- `stremio.remove_from_library` - Remove media from library
- `stremio.refresh_library` - Force library refresh
- `stremio.handover_to_apple_tv` - Apple TV handover service

#### Events

- `stremio_playback_started` - Fired when playback begins
- `stremio_playback_stopped` - Fired when playback stops
- `stremio_new_content` - Fired when new library content detected

#### Apple TV Handover

- AirPlay handover for HLS streams
- VLC deep link fallback for other formats
- Configurable handover method (Auto/AirPlay/VLC)

#### Custom Lovelace Cards

- `stremio-player-card` - Current playback display
- `stremio-library-card` - Library browser with search
- `stremio-media-details-card` - Detailed media info
- `stremio-stream-dialog` - Stream selector dialog
- Auto-registration of cards (no manual resource setup)

#### Media Source Integration

- Browse Stremio library in HA Media Browser
- Navigate: Library → Movies/Series → Seasons → Episodes
- Direct playback from Media Browser

#### Documentation

- Comprehensive setup guide
- Configuration reference
- Services documentation
- UI/Cards guide
- Events documentation
- Example automations
- API reference
- Development guide

### Dependencies

- Home Assistant 2025.1+
- Python 3.11+
- stremio-api>=0.1.0
- pyatv>=0.16.0 (optional, for AirPlay)

---

## Future Releases

### Planned for v1.1.0

- Real-time playback control (requires Stremio API updates)
- Chromecast handover support
- Multi-account support
- Statistics dashboard card

### Planned for v1.2.0

- Jellyfin library sync
- Plex cross-platform library
- IFTTT-style recipes
- Additional language translations

---

[Unreleased]: https://github.com/tamaygz/hacs-stremio/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/tamaygz/hacs-stremio/releases/tag/v1.0.0

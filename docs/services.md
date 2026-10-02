# Stremio actions

The canonical schemas and field descriptions are [services.yaml](../custom_components/stremio/services.yaml). The Home Assistant action picker exposes those fields. Use `action: stremio.<name>` in automation/script YAML; response-only actions need `response_variable` in a sequence.

| Action | Purpose | Response |
| --- | --- | --- |
| `search_library` | Search stored titles, genre or cast with limit. | Structured result |
| `get_streams` | List streams for a movie or selected series episode. | Structured result |
| `get_series_metadata` | Get seasons and episodes by title ID. | Structured result |
| `get_title_metadata` | Exact-ID public title details. | Structured result |
| `add_to_library` | Add/restore a movie or series preserving history. | No response |
| `remove_from_library` | Soft-remove a title preserving history. | No response |
| `mark_watched` | Movie or selected episode watched. | No response |
| `mark_unwatched` | Movie or selected episode unwatched. | No response |
| `clear_resume_progress` | Clear the current resume offset only. | No response |
| `refresh_library` | Refresh coordinator data. | No response |
| `handover_to_apple_tv` | Send a stream/media ID to the selected device entity. | No response |
| `browse_catalog` | Popular/New/genre public catalog; optional native pagination. | Structured result |
| `search_catalog` | Search public movie/series catalog with skip/limit. | Structured result |
| `get_upcoming_episodes` | Request upcoming library episodes. | Structured result |
| `get_recommendations` | Preference-based recommendations. | Structured result |
| `get_similar_content` | Find titles similar to a media ID. | Structured result |
| `get_addons` | Inspect installed Stremio add-ons. | Structured result |

The action is **`get_streams`**, not `get_stream_url`. Apple TV uses `device_id` containing a Home Assistant media-player entity ID, not `device_name`. Stream URLs can contain private access tokens; never publish the response or raw links.

```yaml
sequence:
  - action: stremio.get_streams
    data:
      media_id: tt1375666
      media_type: movie
    response_variable: available_streams
```

```yaml
sequence:
  - action: stremio.browse_catalog
    data:
      media_type: movie
      catalog_type: popular
      paginate: true
      skip: 0
      limit: 50
    response_variable: catalog_page
```

Native pagination requires `limit: 50` and returns `items`, `next_skip`, and `has_more` alongside the service's documented response fields. Advance with `next_skip`, not the number of returned items. Without `paginate`, existing callers retain a limited list response. New + genre filters each current-year page locally, so an empty filtered batch can still have more provider pages.

For account-changing actions set `config_entry_id` when more than one account is configured. Card routing does not guarantee that inherited read/playback services are account-selectable. See [watch management](watch-management.md) and [Title Info](title-info.md) for precise semantics and additional examples.

# Library and watch management





Series now open title details on the first click in management mode. Title Info does not require an episode; select an episode only for episode-specific watched status or streams.

Set `management_mode: true` on Library, Continue Watching, Browse, or Recommendations. Supply `library_entity` with the account's Library Count sensor; its `items` attribute is used to check membership. Add a title to the library before changing watch status. Missing library data keeps account-changing controls disabled.

Management mode hides Open Stremio, Resume, and Apple TV forwarding in these cards. It retains Get Streams, stream URL copying, Find Similar, season/episode selection, and Title Info. Other playback cards and backend actions remain available.

| Action | Movie | Series |
| --- | --- | --- |
| `mark_watched` | Set watched flags without increasing an already-positive play count; clear resume offset. | Set only the selected episode's bitmap bit; season/episode required. |
| `mark_unwatched` | Reset watched flags/count and current watched time; retain accumulated lifetime time. | Clear only the selected episode's bitmap bit. |
| `clear_resume_progress` | Clear only `state.timeOffset`. | Clear the item's current resume offset, without selecting or rewriting episode history. |
| `add_to_library` | Restore membership and preserve existing state/history. | Same, including series without a default video ID. |
| `remove_from_library` | Soft-remove membership, preserve state/history. | Same. |

When an episode's status changes, resume information for a different currently resumed episode is retained. Season 0 specials are supported; episode numbers start at 1. Whole-season/whole-series changes and automatic episode advancement are not provided. Continue Watching requires a positive resume offset and an active or temporary item; accumulated watch time is not resume progress.

Watch updates read the raw item, mutate a copy, write it, and verify the changed fields by reading back. A per-client lock serializes local add/remove/watch actions. This is not an upstream compare-and-swap transaction; another Stremio client can still race with an update. Invalid, oversized, duplicate, or unalignable episode history is rejected to avoid destroying history.

```yaml
action: stremio.clear_resume_progress
data:
  config_entry_id: REPLACE_WITH_STREMIO_CONFIG_ENTRY_ID
  media_id: tt0903747
  media_type: series
```

Single-account calls can omit `config_entry_id`. Multiple accounts require an explicit matching entry ID for mutations. The card derives it from the entity registry when available, but setting it explicitly is recommended for multiple accounts. A confirmation or successful toast does not independently prove playback-device state.

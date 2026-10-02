# Visual guide for Stremio Cinema 0.6.0

## Live Home Assistant captures

These views were captured from the installed release on October 2, 2026. They show public catalog or Cinemeta metadata; Home Assistant navigation and account details are excluded.

| View | What was checked |
| --- | --- |
| [Desktop catalogs](cinema-desktop-catalogs.jpg) | Popular movie and current-year New series feeds; loaded titles ordered by IMDb. |
| [First-click series menu](cinema-series-first-click.jpg) | A series immediately exposes Title Info without selecting an episode. Only the public part of the menu is included. |
| [Title Info](cinema-title-info.jpg) | Public series synopsis, cast, genres, year and runtime; a missing IMDb score displays as unavailable. |
| [Search](cinema-search.jpg) | Public movie search returns provider results. Providers determine relevance and may omit posters or ratings. |
| [Episode picker](cinema-episodes.jpg) | Public season tabs and episode choices. The capture shows the upper part of the picker. |

## Actual cards with demonstration data

These images use the unchanged integration JavaScript in the [local preview](../../tools/visual-preview/README.md). The preview has no Home Assistant connection or Stremio account. Public movie posters identify the example titles; library membership, counts, watch progress, recommendations, episode fixtures, and streams are fictional.

| View | Screenshot |
| --- | --- |
| Continue Watching and recommendations | [Desktop overview](cinema-demo-overview.jpg) |
| Library and retained player | [Desktop library/player](cinema-demo-library-player.jpg) |
| Movie watch and library controls | [Management menu](cinema-demo-management.jpg) |
| Inspect and copy sources | [Fictional streams](cinema-demo-streams.jpg) |
| Similar-title results | [Find Similar fixture](cinema-demo-similar.jpg) |
| Two-column phone discovery | [390-pixel catalog frame](cinema-demo-mobile-catalog.jpg) |
| Two-column phone library with internal scrolling | [390-pixel library frame](cinema-demo-mobile-library.jpg) |
| Larger phone carousel posters | [390-pixel Continue Watching frame](cinema-demo-mobile-resume.jpg) |

The [main README](../../README.md#see-it-in-action) embeds all thirteen current screenshots. Phone frames at 320, 390 and 430 pixels were checked in the browser; they are layout demonstrations, not captures of a Home Assistant phone app. Temporary browser viewport overrides were ineffective on the live tab, so no live phone-app validation is claimed.

## Privacy and verification

Every saved crop was inspected individually before presentation and publication. Live crops exclude the Home Assistant sidebar/top bar, account names, entity IDs, library/history/progress/counts, network addresses, device names and private add-on URLs. The selected series was opened from a public catalog, rather than a personal library. No raw screenshots or private dashboard exports are included.

Read-only live browsing verified public search, sorting, first-click title details, Title Info and season/episode selection. No live watch/library changes, stream-link copying, device playback or Apple TV handover were performed. Demonstration screenshots illustrate the controls; they do not establish backend writes, real add-on responses or external-device compatibility. See [validation](../validation.md).

The remaining [upstream media-browser image](media_browser_support.png) depicts the earlier upstream interface and is retained only as a historical reference for inherited media-source support. It is not a current-release capture. Superseded upstream collection-card screenshots have been removed.

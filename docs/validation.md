# Validation for 0.6.2

The installed 0.6.1 screenshot exposed a missing service-contract check: the card requested 100 recommendations while the registered validator and service UI allowed 50. Both now allow 100. Three new tests execute the actual schema assignment using Voluptuous, checking all filters, defaults, rejection outside the bounds, and agreement with service metadata. **37 backend and 23 frontend tests pass (60 total).** Installed validation of 0.6.2 remains pending an update and Home Assistant restart.

# Validation for 0.6.1

The 0.6.1 regressions cover mixed recommendations without library genres, typed series results, library exclusions across catalog pages, Load More order/duplicates/exhaustion, stale filter responses, and media-player title/poster/episode/progress changes while still playing. There are **34 backend** and **23 frontend** offline tests (57 total). Player tests execute the actual properties and update callback with an offline coordinator fixture; they do not simulate the full Home Assistant lifecycle.

A read-only live comparison established that the old mixed recommendation request returned only movies, while a series-specific request returned shows. The current-watching sensor was also newer than the media-player title and poster. Live verification of the installed 0.6.1 fixes follows updating Home Assistant; the previous screenshots show 0.6.0.

## Previous 0.6.0 validation

## Completed locally

- **24 backend offline tests** pass against the actual client and watch-state modules: bitmaps and anchor alignment, episode preservation, movie idempotence, resume clearing, membership/write verification, catalog routing/pagination/errors, and bounded public metadata.
- **19 frontend offline tests** pass against actual card code: sorting, buffering, duplicate/stale requests, retry/exhaustion, Title Info input handling, first-click series details across all four collection cards, and retained episode selection for legacy/stream actions.
- Black and Flake8 pass for the modified Python modules. Python compilation, frontend JavaScript syntax, JSON/YAML parsing and dashboard entity substitutions are checked.
- The actual updated cards were rendered in an isolated browser with fictional library/progress and public posters. Phone viewport widths of **320, 390 and 430 pixels** have no horizontal page overflow; collection grids use two columns. At 390 pixels, library posters are approximately 150 pixels wide. Filters and action buttons have a 44-pixel minimum height. Desktop column settings remain in effect, and the library respects its configured scroll height.
- Gitleaks found no secrets in the candidate repository or its **413 inherited commits**. Text examples and metadata were separately reviewed for account-specific details. A secret scanner cannot establish screenshot privacy.

The same 43 regressions and modified-module static checks also passed on GitHub Actions before release.

The reproducible offline workflow is [Cinema offline regressions](../.github/workflows/cinema-regressions.yml). The isolated browser fixture is [tools/visual-preview](../tools/visual-preview/README.md); it does not contact a Home Assistant or Stremio account.

## Not established by these checks

The full Home Assistant lifecycle suite was not run locally: the available host Python does not meet the integration's Home Assistant test environment requirements. The broader inherited codebase also has formatting/lint issues outside the modified modules. Offline tests do not establish live account-write behavior, device playback, Apple TV handover, every mobile app/webview, or external add-on compatibility.

After installation, read-only live Home Assistant review verified distinct Popular/New catalog views, IMDb sorting, public search, first-click series details with Title Info, loaded title metadata, and season/episode choices. Saved images were inspected individually and shown before publication. The phone screenshots use the actual cards in isolated 320/390/430-pixel browser frames with fictional account data; the live browser viewport override did not take effect, so these do not establish behavior in a Home Assistant phone app. The [visual guide](screenshots/README.md) identifies the provenance of each image. No account-changing actions or device playback were performed during the browser review. Public metadata can omit fields, and add-on stream links can contain credentials; never post them in an issue or screenshot.

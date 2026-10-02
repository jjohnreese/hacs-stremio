# Build your Stremio Cinema dashboard





Phone layouts use two poster columns with readable titles and larger carousel items. Desktop column settings remain available; the library respects its configured scrolling height.

## Prerequisites

Install and configure Stremio Cinema first. In HACS install [Button Card](https://github.com/custom-cards/button-card), [Layout Card](https://github.com/thomasloven/lovelace-layout-card), and [Card Mod](https://github.com/thomasloven/lovelace-card-mod). Layout Card includes `custom:grid-layout`. Their resources must be loaded as JavaScript modules. Browser Mod is not required.

## Replace the examples

Open [stremio-cinema-dashboard.yaml](../examples/stremio-cinema-dashboard.yaml). Replace every occurrence of the five `stremio_account` entity IDs listed in the [README](../README.md#your-cinema-dashboard), including inside JavaScript templates. Account names can affect entity IDs, so copying the examples unchanged will show missing entities. Do not put your email, password, auth key, add-on credentials, or private network address into this file.

For multiple accounts, add `config_entry_id: REPLACE_WITH_STREMIO_CONFIG_ENTRY_ID` to each of the four management card types after replacing the placeholder. Obtain the Stremio config-entry ID locally from the integration details URL or entity registry; do not publish it. This ID selects the backend account. All cards' `entity` and `library_entity` must belong to that account. The backend rejects ambiguous account-changing calls; some inherited read/playback actions still use the first configured account.

## Install a complete view

1. Open **Settings â†’ Dashboards**, add an empty dashboard, and open it.
2. Open the dashboard edit menu and its **Raw configuration editor**. UI labels vary by Home Assistant version.
3. Paste the entire example, starting with `views:`, into this newly created dashboard.
4. Save, exit editing, and hard-refresh the browser.

To add Cinema to an existing dashboard, retain its existing configuration and append only the example's `- title: Stremio Cinema` view at the same indentation as the other views. Do not create a second `views:` key or replace your existing views. [Home Assistant's dashboard documentation](https://www.home-assistant.io/dashboards/dashboards/) explains storage and YAML dashboards.

The hero reflects the integration's API-derived state and resume progress. It is not independent proof that a television or external player is currently playing. The Has New Episodes indicator retains upstream behavior.

## Start with a minimal card

```yaml
type: custom:stremio-browse-card
title: Discover movies
entity: media_player.stremio_account_stremio
library_entity: sensor.stremio_account_library_count
management_mode: true
show_rating: true
show_sort_controls: true
show_load_more: true
default_type: movie
default_view: popular
columns: 4
max_items: 24
card_height: 640
tap_action: details
```

For series set `default_type: series` and `default_view: new`. For your library use `custom:stremio-library-card`, set `entity` to your Library Count sensor, and use `tap_action: show_detail`. For Continue Watching use `custom:stremio-continue-watching-card`, its corresponding count sensor, and `tap_action: details`.

## Resources and updates

Storage-mode dashboards automatically receive the Stremio bundle resource. If you use YAML dashboard resources or registration is unavailable, add:

```yaml
resources:
  - url: /stremio/stremio-card-bundle.js?v=0.6.0
    type: module
```

Keep only one Stremio bundle entry. The bundle imports its helpers; do not register individual helpers as separate cards. After changing integration code, restart Home Assistant; after updating JavaScript, hard-refresh every browser/device. If a card is unknown, check the resources, installed component, and browser console. If management is disabled, verify the library sensor's `items` attribute, services, and account routing. If data is unavailable, confirm all five entity replacements and custom-card dependencies before changing dashboard structure.

# Privacy-safe card preview

From the repository root run `python tools/visual-preview/serve.py`, then open `http://127.0.0.1:8765/tools/visual-preview/`.

This page renders the actual integration JavaScript using Lit from a versioned CDN. Its transport is a fictional in-memory fixture: no Home Assistant connection, Stremio credentials, account mutation, real stream URL or device handover. Public posters are loaded directly from their provider. Counts, progress, membership, recommendations, episode entries, and stream examples are demonstration data. The top label makes that explicit.

Use real signed-in Home Assistant captures only for public catalog and metadata views, with dashboard chrome and account data cropped out. This preview supports repeatable screenshots of otherwise private library/resume controls; it does not validate Home Assistant lifecycle, backend writes, add-on streams or device playback. Stop the local server when finished.

For repeatable phone layouts, open `http://127.0.0.1:8765/tools/visual-preview/device.html?width=390`. The frame supports widths of 320, 390, and 430 pixels, using the same actual cards and demonstration transport. Browser scrollbars can reduce the available content width slightly. The frame does not emulate a phone app or operating system.

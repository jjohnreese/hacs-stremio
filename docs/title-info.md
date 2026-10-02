# Title Info

In a management-mode detail panel, select **Title Info**. The native dialog requests Cinemeta metadata for the exact movie/series ID, displays loading/retry states, and can be dismissed with its close control, Escape, or outside click. A newer request supersedes stale responses.

The response contains only public `id`, `type`, `title`, `year`, `runtime`, `rating`, `description`, `cast`, `genres`, `director`, `poster`, and `background`. Missing fields remain unavailable rather than being invented. Text fields are bounded and inserted as text; images accept safe HTTP(S) URLs. The network request has a 15-second timeout. No Browser Mod, library update, playback command, credentials, or watch-history export is involved.

```yaml
sequence:
  - action: stremio.get_title_metadata
    data:
      media_id: tt1375666
      media_type: movie
    response_variable: title_info
```

`title_info` receives the action response in a script or automation. It is not a template variable that can be used before the action executes. Exact-ID mismatch, missing title metadata, or provider failure raises an error instead of showing information for a different film.

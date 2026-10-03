"""Run the real player properties and callback without an HA installation."""

import ast
from pathlib import Path
from types import SimpleNamespace
from typing import Any
import unittest
from unittest.mock import Mock

source = (
    Path(__file__).resolve().parents[1] / "custom_components/stremio/media_player.py"
)
tree = ast.parse(source.read_text(encoding="utf-8"))
original = next(
    n
    for n in tree.body
    if isinstance(n, ast.ClassDef) and n.name == "StremioMediaPlayer"
)
methods = {
    "_handle_coordinator_update",
    "_get_current_media_id",
    "state",
    "media_title",
    "media_image_url",
    "media_position",
    "media_duration",
    "extra_state_attributes",
}
node = ast.ClassDef(
    name="PlayerUnderTest",
    bases=[],
    keywords=[],
    decorator_list=[],
    body=[
        n for n in original.body if isinstance(n, ast.FunctionDef) and n.name in methods
    ],
)
namespace = {
    "Any": Any,
    "callback": lambda f: f,
    "MediaPlayerState": SimpleNamespace(PLAYING="playing", IDLE="idle"),
}
exec(
    compile(
        ast.fix_missing_locations(ast.Module(body=[node], type_ignores=[])),
        str(source),
        "exec",
    ),
    namespace,
)


class MediaPlayerUpdateTests(unittest.TestCase):
    def setUp(self):
        self.player = namespace["PlayerUnderTest"]()
        self.current = {
            "imdb_id": "demo-a",
            "title": "Demo A",
            "type": "series",
            "poster": "https://example.com/a.jpg",
            "season": 1,
            "episode": 1,
            "time_offset": 60,
            "duration": 1800,
            "progress_percent": 3.3,
        }
        self.player.coordinator = SimpleNamespace(
            data={"current_watching": self.current}
        )
        self.player._previous_media_snapshot = None
        self.player._pending_state_update = False
        self.player.async_write_ha_state = Mock()
        self.player._handle_coordinator_update()

    def test_title_and_poster_update_while_still_playing(self):
        self.current.update(
            imdb_id="demo-b", title="Demo B", poster="https://example.com/b.jpg"
        )
        self.player._handle_coordinator_update()
        self.assertEqual(self.player.state, "playing")
        self.assertEqual(self.player.async_write_ha_state.call_count, 2)

    def test_episode_and_progress_update_with_same_title(self):
        self.current.update(episode=2, progress_percent=20, time_offset=360)
        self.player._handle_coordinator_update()
        self.assertEqual(self.player.async_write_ha_state.call_count, 2)

    def test_poster_only_change_is_published(self):
        self.current["poster"] = "https://example.com/replaced.jpg"
        self.player._handle_coordinator_update()
        self.assertEqual(self.player.async_write_ha_state.call_count, 2)

    def test_identical_poll_does_not_reset_media_browser(self):
        self.player._handle_coordinator_update()
        self.assertEqual(self.player.async_write_ha_state.call_count, 1)

    def test_pending_refresh_publishes_even_unchanged_media(self):
        self.player._pending_state_update = True
        self.player._handle_coordinator_update()
        self.assertEqual(self.player.async_write_ha_state.call_count, 2)
        self.assertFalse(self.player._pending_state_update)

    def test_stopping_clears_title_and_poster(self):
        self.player.coordinator.data["current_watching"] = None
        self.player._handle_coordinator_update()
        self.assertEqual(self.player.state, "idle")
        self.assertIsNone(self.player.media_title)
        self.assertIsNone(self.player.media_image_url)
        self.assertEqual(self.player.extra_state_attributes, {})
        self.assertEqual(self.player.async_write_ha_state.call_count, 2)

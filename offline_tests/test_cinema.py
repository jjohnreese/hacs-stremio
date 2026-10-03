"""Offline regressions using actual source and a fake transport, never an account.

Only HA's exception base is shimmed; this is not an HA lifecycle test.
Run: python -m unittest discover -s offline_tests -v
"""

from __future__ import annotations

import base64
import importlib.util
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import AsyncMock
import zlib

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "custom_components" / "stremio"
PACKAGE = "cinema_offline"
package = types.ModuleType(PACKAGE)
package.__path__ = [str(SOURCE)]
sys.modules[PACKAGE] = package
try:
    import homeassistant.exceptions
except ImportError:
    ha = types.ModuleType("homeassistant")
    exceptions = types.ModuleType("homeassistant.exceptions")
    exceptions.HomeAssistantError = type("HomeAssistantError", (Exception,), {})
    sys.modules.setdefault("homeassistant", ha)
    sys.modules.setdefault("homeassistant.exceptions", exceptions)


def load(name):
    spec = importlib.util.spec_from_file_location(
        f"{PACKAGE}.{name}", SOURCE / f"{name}.py"
    )
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


watch = load("watch_state")
client_module = load("stremio_client")
Client = client_module.StremioClient
ConnectionError = client_module.StremioConnectionError


def metadata():
    return {
        "seasons": [
            {
                "number": 1,
                "episodes": [
                    {"number": n, "id": f"tt0903747:1:{n}"} for n in (1, 2, 3)
                ],
            }
        ]
    }


class WatchTests(unittest.TestCase):
    def test_bitfield_roundtrip_across_byte_boundaries(self):
        ids = [f"series:1:{n}" for n in range(20)]
        bits = [n in (0, 7, 8, 19) for n in range(20)]
        self.assertEqual(
            watch.decode_watched(watch.encode_watched(bits, ids), ids), bits
        )

    def test_anchor_alignment_when_episode_is_inserted(self):
        old = ["series:1:1", "series:1:2", "series:1:3"]
        new = ["series:0:1", *old]
        self.assertEqual(
            watch.decode_watched(watch.encode_watched([True, False, True], old), new),
            [False, True, False, True],
        )

    def test_nonempty_missing_anchor_rejected(self):
        with self.assertRaises(ValueError):
            watch.decode_watched(watch.encode_watched([True], ["missing"]), ["other"])

    def test_malformed_and_oversized_bitmap_rejected(self):
        for value in (
            "bad",
            "id:0:bad",
            "id:1:!!!",
            "id:1:" + base64.b64encode(zlib.compress(b"\xff" * 65537)).decode(),
        ):
            with self.subTest(value=value[:12]), self.assertRaises(ValueError):
                watch.decode_watched(value, ["id"])

    def test_empty_missing_anchor_is_safe(self):
        self.assertEqual(
            watch.decode_watched(watch.encode_watched([False], ["missing"]), ["other"]),
            [False],
        )

    def test_duplicate_metadata_rejected(self):
        meta = metadata()
        meta["seasons"][0]["episodes"][1]["id"] = meta["seasons"][0]["episodes"][0][
            "id"
        ]
        with self.assertRaises(ValueError):
            watch.episode_videos(meta)

    def test_movie_watch_is_idempotent_and_input_unchanged(self):
        item = {
            "type": "movie",
            "state": {"timesWatched": 3, "timeOffset": 600, "overallTimeWatched": 1000},
        }
        result = watch.update_watch_state(item, "mark_watched", "now")
        self.assertEqual(result["state"]["timesWatched"], 3)
        self.assertEqual(result["state"]["timeOffset"], 0)
        self.assertEqual(item["state"]["timeOffset"], 600)
        self.assertEqual(result["state"]["overallTimeWatched"], 1000)

    def test_movie_unwatch_preserves_lifetime_time(self):
        result = watch.update_watch_state(
            {
                "type": "movie",
                "state": {
                    "timesWatched": 2,
                    "timeWatched": 500,
                    "overallTimeWatched": 999,
                },
            },
            "mark_unwatched",
            "now",
        )
        self.assertEqual(
            result["state"],
            {
                "timesWatched": 0,
                "timeWatched": 0,
                "overallTimeWatched": 999,
                "flaggedWatched": 0,
                "timeOffset": 0,
            },
        )

    def test_clear_resume_only(self):
        item = {
            "type": "series",
            "state": {
                "timeOffset": 123,
                "watched": "opaque",
                "video_id": "other",
                "timesWatched": 2,
            },
        }
        result = watch.update_watch_state(item, "clear_resume_progress", "now")
        expected = dict(item["state"], timeOffset=0)
        self.assertEqual(result["state"], expected)

    def test_episode_update_preserves_other_bits_and_resume(self):
        ids = [e["id"] for e in metadata()["seasons"][0]["episodes"]]
        item = {
            "type": "series",
            "state": {
                "watched": watch.encode_watched([True, False, True], ids),
                "video_id": ids[1],
                "timeOffset": 700,
            },
        }
        result = watch.update_watch_state(
            item, "mark_unwatched", "now", metadata(), 1, 1
        )
        self.assertEqual(
            watch.decode_watched(result["state"]["watched"], ids), [False, False, True]
        )
        self.assertEqual(result["state"]["timeOffset"], 700)

    def test_missing_episode_selection_rejected(self):
        with self.assertRaises(ValueError):
            watch.update_watch_state(
                {"type": "series"}, "mark_watched", "now", metadata()
            )

    def test_specials_supported(self):
        meta = {
            "seasons": [{"number": 0, "episodes": [{"number": 1, "id": "series:0:1"}]}]
        }
        result = watch.update_watch_state(
            {"type": "series"}, "mark_watched", "now", meta, 0, 1
        )
        self.assertEqual(
            watch.decode_watched(result["state"]["watched"], ["series:0:1"]), [True]
        )


class Response:
    def __init__(self, data, status=200):
        self.data, self.status = data, status

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_):
        return False

    async def json(self):
        return self.data


class Session:
    closed = False

    def __init__(self, data, status=200):
        self.response = Response(data, status)
        self.calls = []

    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response

    def post(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.response


class ClientTests(unittest.IsolatedAsyncioTestCase):
    def client(self, data, status=200):
        session = Session(data, status)
        return Client("test@example.com", "fictional", session), session

    def recommendation_client(self, library):
        client, _ = self.client({})
        client.async_get_library = AsyncMock(return_value=library)

        async def catalog(media_type, catalog_id, skip=0, limit=50, **kwargs):
            if skip >= 200:
                return []
            return [
                {"id": f"{media_type}-{i}", "type": media_type, "title": f"Demo {i}"}
                for i in range(skip, skip + min(limit, 50))
            ]

        client.async_get_catalog = AsyncMock(side_effect=catalog)
        return client

    async def test_mixed_recommendations_include_series_without_library_genres(self):
        client = self.recommendation_client([{"id": "library", "type": "series"}])
        items = await client.async_get_recommendations(limit=6)
        self.assertEqual([x["type"] for x in items], ["movie", "series"] * 3)

    async def test_mixed_genre_recommendations_are_not_movie_first_truncated(self):
        client = self.recommendation_client(
            [{"id": "library", "type": "movie", "genres": ["Drama"]}]
        )
        items = await client.async_get_recommendations(limit=5)
        self.assertEqual(
            [x["type"] for x in items], ["movie", "series", "movie", "series", "movie"]
        )

    async def test_typed_recommendations_fill_after_excluding_library(self):
        library = [{"id": f"series-{i}", "type": "series"} for i in range(50)]
        client = self.recommendation_client(library)
        items = await client.async_get_recommendations("series", limit=100)
        self.assertEqual(len(items), 100)
        self.assertTrue(all(x["type"] == "series" for x in items))
        self.assertEqual(items[0]["id"], "series-50")
        self.assertEqual(len({x["id"] for x in items}), 100)
        self.assertEqual(
            [x.kwargs["skip"] for x in client.async_get_catalog.call_args_list],
            [0, 50, 100],
        )

    async def test_empty_library_still_gets_a_mixed_odd_sized_pool(self):
        items = await self.recommendation_client([]).async_get_recommendations(limit=3)
        self.assertEqual([x["type"] for x in items], ["movie", "series", "movie"])

    async def test_popular_uses_top_and_preserves_score(self):
        client, session = self.client(
            {"metas": [{"id": "tt1375666", "name": "Inception", "imdbRating": "8.8"}]}
        )
        page = await client.async_browse_catalog_page("movie", "popular")
        self.assertTrue(session.calls[0][0].endswith("/catalog/movie/top.json"))
        self.assertEqual(page["items"][0]["rating"], "8.8")
        self.assertEqual(page["next_skip"], 50)

    async def test_short_native_page_does_not_terminate(self):
        client, _ = self.client(
            {"metas": [{"id": str(n), "name": str(n)} for n in range(49)]}
        )
        page = await client.async_browse_catalog_page(skip=50)
        self.assertEqual(page["next_skip"], 100)
        self.assertTrue(page["has_more"])

    async def test_empty_page_is_exhaustion(self):
        client, _ = self.client({"metas": []})
        self.assertEqual(
            await client.async_browse_catalog_page(skip=100),
            {"items": [], "next_skip": 100, "has_more": False},
        )

    async def test_provider_error_is_not_exhaustion(self):
        client, _ = self.client({}, 503)
        with self.assertRaises(ConnectionError):
            await client.async_browse_catalog_page()

    async def test_invalid_page_is_rejected(self):
        for data in ({"metas": {}}, {"metas": [None] * 101}):
            client, _ = self.client(data)
            with self.assertRaises(ConnectionError):
                await client.async_browse_catalog_page()

    async def test_new_keeps_year_route_and_filters_locally(self):
        client, session = self.client(
            {
                "metas": [
                    {"id": "a", "name": "A", "genre": ["Drama"]},
                    {"id": "b", "name": "B", "genre": ["Comedy"]},
                ]
            }
        )
        page = await client.async_browse_catalog_page("series", "new", "drama", skip=50)
        self.assertIn("/catalog/series/year/genre=", session.calls[0][0])
        self.assertIn("&skip=50.json", session.calls[0][0])
        self.assertEqual([i["id"] for i in page["items"]], ["a"])
        self.assertTrue(page["has_more"])

    async def test_legacy_browse_limit(self):
        client, _ = self.client(
            {"metas": [{"id": str(n), "name": str(n)} for n in range(50)]}
        )
        self.assertEqual(len(await client.async_browse_catalog(limit=24)), 24)

    async def test_title_metadata_allowlist_and_bounds(self):
        client, session = self.client(
            {
                "meta": {
                    "id": "tt1375666",
                    "type": "movie",
                    "name": "Inception",
                    "cast": ["Actor"] * 60,
                    "description": "x" * 21000,
                    "authKey": "fictional",
                    "streams": ["private"],
                }
            }
        )
        data = await client.async_get_title_metadata("tt1375666", "movie")
        self.assertEqual(len(data["cast"]), 50)
        self.assertEqual(len(data["description"]), 20000)
        self.assertNotIn("authKey", data)
        self.assertNotIn("streams", data)
        self.assertEqual(session.calls[0][1]["timeout"].total, 15)

    async def test_title_mismatch_rejected(self):
        client, _ = self.client({"meta": {"id": "different", "name": "Other"}})
        with self.assertRaises(ConnectionError):
            await client.async_get_title_metadata("tt1375666", "movie")

    async def test_title_missing_or_provider_error(self):
        for data, status in (({"meta": {}}, 200), ({}, 404), ({}, 503)):
            client, _ = self.client(data, status)
            with self.assertRaises(ConnectionError):
                await client.async_get_title_metadata("tt1375666", "movie")

    async def test_watch_write_is_verified(self):
        client, session = self.client({"success": True})
        client._auth_key = "fictional-test-session"
        original = {"id": "tt1375666", "type": "movie", "state": {"timeOffset": 10}}
        saved = watch.update_watch_state(original, "mark_watched", "now")
        # Ignore the dynamic timestamp; verify the substantive changed fields.
        client.async_find_existing_item = AsyncMock(side_effect=[original, saved])
        saved["state"].pop("lastWatched")
        saved["state"]["lastWatched"] = "mismatch"
        with self.assertRaises(ConnectionError):
            await client.async_update_watch_state("tt1375666", "movie", "mark_watched")
        self.assertEqual(len(session.calls), 1)

    async def test_missing_membership_does_not_write(self):
        client, session = self.client({"success": True})
        client._auth_key = "fictional-test-session"
        client.async_find_existing_item = AsyncMock(return_value=None)
        with self.assertRaises(ConnectionError):
            await client.async_update_watch_state("tt1375666", "movie", "mark_watched")
        self.assertEqual(session.calls, [])


if __name__ == "__main__":
    unittest.main()

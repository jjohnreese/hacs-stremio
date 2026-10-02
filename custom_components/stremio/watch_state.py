"""Stremio-compatible episode watched bitfields and resume-state mutations."""

from __future__ import annotations

import base64
import binascii
from copy import deepcopy
from typing import Any
import zlib


def episode_videos(metadata: dict[str, Any]) -> list[dict[str, Any]]:
    """Return the same season/episode/release ordering used by Stremio Core."""
    videos = []
    for season in metadata.get("seasons", []):
        for episode in season.get("episodes", []):
            if episode.get("id") and episode.get("number") is not None:
                videos.append({**episode, "season": int(season["number"])})
    videos.sort(
        key=lambda video: (
            video["season"],
            int(video["number"]),
            video.get("released") or "",
        )
    )
    if len({video["id"] for video in videos}) != len(videos):
        raise ValueError("Episode metadata contains duplicate video IDs")
    return videos


def decode_watched(serialized: str | None, video_ids: list[str]) -> list[bool]:
    """Decode and align Stremio's anchor:length:zlib-base64 bitmap."""
    if not serialized:
        return [False] * len(video_ids)
    try:
        anchor, length, packed = serialized.rsplit(":", 2)
        anchor_length = int(length)
        if anchor_length < 1:
            raise ValueError("Invalid watched anchor length")
        decoder = zlib.decompressobj()
        values = decoder.decompress(base64.b64decode(packed, validate=True), 65537)
        if not decoder.eof or len(values) > 65536 or decoder.unused_data:
            raise ValueError("Invalid or oversized watched bitmap")
        # An empty bitmap has no history to align, even if its anchor disappeared.
        if not any(values):
            return [False] * len(video_ids)
        if anchor not in video_ids:
            raise ValueError("Watched history cannot be aligned with episode metadata")
        offset = anchor_length - video_ids.index(anchor) - 1
        result = []
        for index in range(len(video_ids)):
            previous = index + offset
            result.append(
                previous >= 0
                and previous // 8 < len(values)
                and bool(values[previous // 8] & (1 << (previous % 8)))
            )
        return result
    except (ValueError, TypeError, binascii.Error, zlib.error) as err:
        raise ValueError(
            "Cannot safely decode existing episode watched history"
        ) from err


def encode_watched(watched: list[bool], video_ids: list[str]) -> str:
    """Serialize a bitmap without losing previously watched episodes."""
    if len(watched) != len(video_ids):
        raise ValueError("Watched bitmap and video IDs must have the same length")
    values = bytearray((len(video_ids) + 7) // 8)
    for index, value in enumerate(watched):
        if value:
            values[index // 8] |= 1 << (index % 8)
    anchor_index = max((i for i, value in enumerate(watched) if value), default=0)
    anchor = video_ids[anchor_index] if video_ids else "undefined"
    packed = base64.b64encode(zlib.compress(bytes(values), 6)).decode("ascii")
    return f"{anchor}:{anchor_index + 1}:{packed}"


def update_watch_state(
    item: dict[str, Any],
    action: str,
    now: str,
    metadata: dict[str, Any] | None = None,
    season: int | None = None,
    episode: int | None = None,
) -> dict[str, Any]:
    """Copy one item and change only the requested movie/episode and resume state."""
    if action not in ("mark_watched", "mark_unwatched", "clear_resume_progress"):
        raise ValueError("Unsupported watch-state action")
    result = deepcopy(item)
    state = result.setdefault("state", {})
    if not isinstance(state, dict):
        raise ValueError("Invalid library item state")
    result["_mtime"] = now
    if action == "clear_resume_progress":
        state["timeOffset"] = 0
        return result

    is_watched = action == "mark_watched"
    if result.get("type") == "series":
        if season is None or episode is None or metadata is None:
            raise ValueError(
                "Select a season and episode before changing watched status"
            )
        videos = episode_videos(metadata)
        video_ids = [video["id"] for video in videos]
        selected = next(
            (
                video
                for video in videos
                if video["season"] == season and int(video["number"]) == episode
            ),
            None,
        )
        if selected is None:
            raise ValueError("Selected episode was not found in Stremio metadata")
        watched = decode_watched(state.get("watched"), video_ids)
        watched[video_ids.index(selected["id"])] = is_watched
        state["watched"] = encode_watched(watched, video_ids)
        # Clearing a different episode must not discard the current episode's resume.
        if state.get("video_id") == selected["id"]:
            state["timeOffset"] = 0
            if not is_watched:
                state["timeWatched"] = 0
                state["flaggedWatched"] = 0
    elif result.get("type") == "movie":
        state["timesWatched"] = (
            max(1, int(state.get("timesWatched") or 0)) if is_watched else 0
        )
        state["flaggedWatched"] = 1 if is_watched else 0
        state["timeOffset"] = 0
        if not is_watched:
            state["timeWatched"] = 0
    else:
        raise ValueError("Watched status is supported for movies and series only")
    if is_watched:
        state["lastWatched"] = now
    return result

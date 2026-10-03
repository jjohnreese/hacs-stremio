"""Exercise the actual registered recommendation validator without importing HA."""

import ast
from pathlib import Path
import unittest

import voluptuous as vol
import yaml

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "custom_components/stremio/services.py"
assignment = next(
    node
    for node in ast.parse(SOURCE.read_text(encoding="utf-8")).body
    if isinstance(node, ast.Assign)
    and any(
        isinstance(target, ast.Name) and target.id == "GET_RECOMMENDATIONS_SCHEMA"
        for target in node.targets
    )
)
namespace = {"vol": vol, "ATTR_LIMIT": "limit", "ATTR_MEDIA_TYPE": "media_type"}
exec(
    compile(ast.Module(body=[assignment], type_ignores=[]), str(SOURCE), "exec"),
    namespace,
)
schema = namespace["GET_RECOMMENDATIONS_SCHEMA"]


class RecommendationSchemaTests(unittest.TestCase):
    def test_card_buffer_is_accepted_for_all_filters(self):
        for media_type in (None, "movie", "series"):
            with self.subTest(media_type=media_type):
                payload = {"limit": 100}
                if media_type:
                    payload["media_type"] = media_type
                self.assertEqual(schema(payload), payload)

    def test_limit_boundaries_and_default(self):
        self.assertEqual(schema({}), {"limit": 20})
        self.assertEqual(schema({"limit": 1}), {"limit": 1})
        for limit in (0, 101):
            with self.subTest(limit=limit), self.assertRaises(vol.Invalid):
                schema({"limit": limit})

    def test_service_selector_matches_runtime_limit(self):
        metadata = yaml.safe_load(
            (ROOT / "custom_components/stremio/services.yaml").read_text(
                encoding="utf-8"
            )
        )
        maximum = metadata["get_recommendations"]["fields"]["limit"]["selector"][
            "number"
        ]["max"]
        self.assertEqual(maximum, 100)
        self.assertEqual(schema({"limit": maximum}), {"limit": maximum})
        with self.assertRaises(vol.Invalid):
            schema({"limit": maximum + 1})

"""Serve the card demo on loopback with portable JavaScript MIME types."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from functools import partial


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
    }


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[2]
    handler = partial(Handler, directory=str(root))
    with ThreadingHTTPServer(("127.0.0.1", 8765), handler) as server:
        print("Demo: http://127.0.0.1:8765/tools/visual-preview/", flush=True)
        server.serve_forever()

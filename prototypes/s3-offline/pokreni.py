"""Serve the prepared prototype on loopback and open the default browser."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import webbrowser

if __name__ == "__main__":
    release = Path(__file__).resolve().parent / "release"
    handler = partial(SimpleHTTPRequestHandler, directory=release)
    with ThreadingHTTPServer(("127.0.0.1", 8765), handler) as server:
        url = "http://127.0.0.1:8765/"
        print(url, flush=True)
        webbrowser.open(url)
        server.serve_forever()

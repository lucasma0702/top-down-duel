#!/usr/bin/env python3
"""Static file server that disables all caching, so edits are always visible
immediately without hard-refresh tricks."""
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    http.server.test(HandlerClass=NoCacheHandler, port=port)

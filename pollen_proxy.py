#!/usr/bin/env python3
"""Simple local proxy for Pollen.com outlook API.

Usage:
    python pollen_proxy.py --port 8787

Then the frontend can call:
    http://localhost:8787/pollen/outlook?zip=10001
    http://localhost:8787/pollen/outlook?lat=40.7128&lon=-74.0060
    http://localhost:8787/pollen/extended?zip=10001
"""

from __future__ import annotations

import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


def build_current_upstream_url(query: dict[str, list[str]]) -> str | None:
    zip_value = (query.get("zip") or [""])[0].strip()
    lat_value = (query.get("lat") or [""])[0].strip()
    lon_value = (query.get("lon") or [""])[0].strip()

    if zip_value:
        return f"https://www.pollen.com/api/forecast/outlook/{urllib.parse.quote(zip_value)}"

    if lat_value and lon_value:
        return (
            "https://www.pollen.com/api/forecast/outlook/"
            f"{urllib.parse.quote(lat_value)}/{urllib.parse.quote(lon_value)}/"
        )

    return None


def build_extended_upstream_url(query: dict[str, list[str]]) -> str | None:
    zip_value = (query.get("zip") or [""])[0].strip()
    if not zip_value:
        return None

    return f"https://www.pollen.com/api/forecast/extended/pollen/{urllib.parse.quote(zip_value)}"


class PollenProxyHandler(BaseHTTPRequestHandler):
    server_version = "PollenProxy/1.0"

    def _send_cors_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path not in {"/pollen/outlook", "/pollen/extended"}:
            self._send_json(404, {"error": "Not found"})
            return

        query = urllib.parse.parse_qs(parsed.query)
        if parsed.path == "/pollen/outlook":
            upstream_url = build_current_upstream_url(query)
        else:
            upstream_url = build_extended_upstream_url(query)

        if not upstream_url:
            if parsed.path == "/pollen/outlook":
                self._send_json(400, {"error": "Provide zip or lat/lon query parameters"})
            else:
                self._send_json(400, {"error": "Provide zip query parameter"})
            return

        request = urllib.request.Request(
            upstream_url,
            headers={
                "Accept": "application/json",
                # Pollen.com appears to require Referer for this endpoint.
                "Referer": "https://localhost/",
                "User-Agent": "Mozilla/5.0",
            },
            method="GET",
        )

        try:
            with urllib.request.urlopen(request, timeout=15) as response:
                payload = response.read()
                status = response.getcode()
                content_type = response.headers.get("Content-Type", "application/json; charset=utf-8")
        except urllib.error.HTTPError as err:
            message = err.read().decode("utf-8", errors="replace")
            self._send_json(err.code or 502, {"error": "Upstream HTTP error", "details": message})
            return
        except Exception as err:  # noqa: BLE001
            self._send_json(502, {"error": "Upstream request failed", "details": str(err)})
            return

        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, format: str, *args) -> None:  # noqa: A003
        # Keep terminal output concise and focused.
        return


def main() -> None:
    parser = argparse.ArgumentParser(description="Local proxy for Pollen.com outlook API")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8787, help="Bind port (default: 8787)")
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), PollenProxyHandler)
    print(f"Pollen proxy listening on http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

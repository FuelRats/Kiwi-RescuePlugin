"""Stand-in for JIRAAnnouncer's POST /client in local tests: records each announce (form fields
plus Referer and Origin) as one JSON line on stdout and in /data/announces.jsonl. It never talks
to IRC, so a test run cannot raise a real r@tsignal."""
import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

LOG = os.environ.get("ANNOUNCE_LOG", "/data/announces.jsonl")


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8")
        record = {
            "path": self.path,
            "referer": self.headers.get("Referer"),
            "origin": self.headers.get("Origin"),
            "content_type": self.headers.get("Content-Type"),
            "fields": {k: v[0] for k, v in parse_qs(body).items()},
        }
        line = json.dumps(record, ensure_ascii=False)
        print(line, flush=True)
        with open(LOG, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b"null")

    def log_message(self, *args):
        pass


HTTPServer(("0.0.0.0", 8099), Handler).serve_forever()

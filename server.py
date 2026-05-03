"""JLPT Progress Dashboard - Local HTTP Server.

Zero external dependencies. Serves the dashboard UI and data API.

Usage:
    python server.py [--port 8053]
"""

import argparse
import csv
import json
import mimetypes
import os
import sys
import webbrowser
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent
JLPT_FILE = BASE_DIR / "JLPT_Vocab.json"
WORDLISTS_DIR = BASE_DIR / "wordlists"
DASHBOARD_DIR = BASE_DIR / "dashboard"

LEVELS = ["N5", "N4", "N3", "N2", "N1"]


def parse_jlpt_vocab():
    """Parse JLPT_Vocab.json into rows with level assignments."""
    with open(JLPT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    level_markers = {(lv, lv) for lv in LEVELS}
    level_markers.add(("", ""))

    rows = []  # list of (surface, reading, level)
    current_level = None

    for row in data:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        surface = str(row[0]).strip()
        reading = str(row[1]).strip()

        # Check level marker
        if surface == reading and surface in ("N5", "N4", "N3", "N2", "N1"):
            current_level = surface
            continue

        if (surface, reading) in level_markers or (not surface and not reading):
            continue

        rows.append({"surface": surface, "reading": reading, "level": current_level})

    return rows


def load_csv_terms(path):
    """Load terms from a CSV file. Returns set of all non-empty cell values from dictForm and secondary columns."""
    terms = set()
    if not path.exists():
        return terms
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            for col in ("dictForm", "secondary"):
                val = row.get(col, "").strip()
                if val:
                    terms.add(val)
    return terms


def load_extra_overrides():
    """Load category overrides from wordlists/extra.json."""
    extra_path = WORDLISTS_DIR / "extra.json"
    if not extra_path.exists():
        return {}
    with open(extra_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Build a term -> category mapping
    overrides = {}
    for category in ("known", "ignored", "learning", "unknown"):
        for term in data.get(category, []):
            t = term.strip()
            if t:
                overrides[t] = category
    return overrides


def load_all_data():
    """Load and process all data. Called on each /api/data request for freshness."""
    jlpt_rows = parse_jlpt_vocab()

    extra_overrides = load_extra_overrides()
    known_terms = load_csv_terms(WORDLISTS_DIR / "known.csv")
    learning_terms = load_csv_terms(WORDLISTS_DIR / "learning.csv")
    ignored_terms = load_csv_terms(WORDLISTS_DIR / "ignored.csv")
    tracked_terms = load_csv_terms(WORDLISTS_DIR / "tracked.csv")

    # Classify each word (extra.json overrides take priority)
    for word in jlpt_rows:
        aliases = {word["surface"], word["reading"]} - {""}
        override = None
        for alias in aliases:
            if alias in extra_overrides:
                override = extra_overrides[alias]
                break
        if override is not None:
            word["category"] = override
        elif aliases & known_terms:
            word["category"] = "known"
        elif aliases & ignored_terms:
            word["category"] = "ignored"
        elif aliases & learning_terms:
            word["category"] = "learning"
        else:
            word["category"] = "unknown"
        word["tracked"] = bool(aliases & tracked_terms)
        word["katakana"] = is_katakana(word["surface"]) or is_katakana(word["reading"])

    # Build level boundary indices for cumulative ranges
    level_start = {}
    for i, row in enumerate(jlpt_rows):
        lv = row["level"]
        if lv and lv not in level_start:
            level_start[lv] = i

    # Compute stats
    cumulative = {}
    per_level = {}

    for li, level in enumerate(LEVELS):
        # Per-level: only words tagged with this level
        level_words = [w for w in jlpt_rows if w["level"] == level]
        per_level[level] = compute_stats(level_words)

        # Cumulative: all words from N5 up to and including this level
        cum_words = []
        for j in range(li + 1):
            cum_words.extend(w for w in jlpt_rows if w["level"] == LEVELS[j])
        cumulative[level] = compute_stats(cum_words)

    # Overall summary (all words = cumulative N1)
    summary = cumulative["N1"].copy()

    return {
        "cumulative": cumulative,
        "perLevel": per_level,
        "summary": summary,
    }, jlpt_rows


def compute_stats(words):
    """Compute category counts for a list of words."""
    stats = {"total": len(words), "known": 0, "ignored": 0, "learning": 0, "unknown": 0, "tracked": 0}
    for w in words:
        stats[w["category"]] += 1
        if w["tracked"]:
            stats["tracked"] += 1
    return stats


def is_katakana(text):
    """Check if text is entirely katakana."""
    if not text:
        return False
    cleaned = text.replace(" ", "").replace("\u3000", "")
    if not cleaned:
        return False
    return all("\u30A0" <= ch <= "\u30FF" or ch == "\u30FC" for ch in cleaned)


def filter_words(jlpt_rows, params):
    """Filter words based on query parameters."""
    categories = params.get("category", ["known"])
    if isinstance(categories, str):
        categories = [categories]
    # Support comma-separated categories
    expanded = []
    for c in categories:
        expanded.extend(c.split(","))
    categories = expanded

    level = params.get("level", ["all"])
    if isinstance(level, list):
        level = level[0]
    mode = params.get("mode", ["cumulative"])
    if isinstance(mode, list):
        mode = mode[0]
    limit = params.get("limit", [None])
    if isinstance(limit, list):
        limit = limit[0]
    katakana = params.get("katakana", ["false"])
    if isinstance(katakana, list):
        katakana = katakana[0]
    tracked = params.get("tracked", ["include"])
    if isinstance(tracked, list):
        tracked = tracked[0]

    # Filter by level
    if level == "all":
        if mode == "cumulative":
            words = list(jlpt_rows)
        else:
            words = list(jlpt_rows)
    else:
        if mode == "cumulative":
            target_idx = LEVELS.index(level)
            valid_levels = set(LEVELS[: target_idx + 1])
            words = [w for w in jlpt_rows if w["level"] in valid_levels]
        else:
            words = [w for w in jlpt_rows if w["level"] == level]

    # Filter by category
    words = [w for w in words if w["category"] in categories]

    # Filter by katakana
    if katakana == "true":
        words = [w for w in words if w["katakana"]]

    # Filter by tracked
    if tracked == "only":
        words = [w for w in words if w["tracked"]]
    elif tracked == "exclude":
        words = [w for w in words if not w["tracked"]]

    # Apply limit
    if limit:
        try:
            words = words[: int(limit)]
        except ValueError:
            pass

    return words


class DashboardHandler(BaseHTTPRequestHandler):
    jlpt_rows = None

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        params = parse_qs(parsed.query)

        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/dashboard/index.html")
            self.end_headers()
        elif path == "/api/data":
            self.handle_api_data()
        elif path == "/api/words":
            self.handle_api_words(params)
        elif path.startswith("/dashboard/"):
            self.serve_static(path)
        else:
            self.send_error(404)

    def handle_api_data(self):
        stats, DashboardHandler.jlpt_rows = load_all_data()
        body = json.dumps(stats, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_api_words(self, params):
        # Ensure data is loaded
        if DashboardHandler.jlpt_rows is None:
            _, DashboardHandler.jlpt_rows = load_all_data()

        words = filter_words(DashboardHandler.jlpt_rows, params)
        fmt = params.get("format", ["json"])
        if isinstance(fmt, list):
            fmt = fmt[0]

        if fmt == "csv":
            self.send_delimited(words, ",", "text/csv")
        elif fmt == "tsv":
            self.send_delimited(words, "\t", "text/tab-separated-values")
        else:
            result = {
                "count": len(words),
                "words": [
                    {"surface": w["surface"], "reading": w["reading"],
                     "level": w["level"], "category": w["category"],
                     "tracked": w["tracked"]}
                    for w in words
                ],
            }
            body = json.dumps(result, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def send_delimited(self, words, delimiter, content_type):
        import io

        output = io.StringIO()
        writer = csv.writer(output, delimiter=delimiter)
        writer.writerow(["surface", "reading", "level", "category", "tracked"])
        for w in words:
            writer.writerow([w["surface"], w["reading"], w["level"], w["category"], w["tracked"]])
        body = output.getvalue().encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def serve_static(self, path):
        # Resolve to filesystem path safely
        rel = path.lstrip("/")
        file_path = (BASE_DIR / rel).resolve()
        if not str(file_path).startswith(str(BASE_DIR)):
            self.send_error(403)
            return
        if not file_path.is_file():
            self.send_error(404)
            return

        content_type, _ = mimetypes.guess_type(str(file_path))
        if content_type is None:
            content_type = "application/octet-stream"

        with open(file_path, "rb") as f:
            body = f.read()

        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        # Quieter logging
        pass


def main():
    parser = argparse.ArgumentParser(description="JLPT Progress Dashboard Server")
    parser.add_argument("--port", type=int, default=8053, help="Port to serve on (default: 8053)")
    parser.add_argument("--no-open", action="store_true", help="Don't auto-open browser")
    args = parser.parse_args()

    # Validate required files
    if not JLPT_FILE.exists():
        print(f"Error: {JLPT_FILE} not found")
        sys.exit(1)
    if not WORDLISTS_DIR.exists():
        print(f"Error: {WORDLISTS_DIR}/ not found")
        sys.exit(1)
    if not DASHBOARD_DIR.exists():
        print(f"Error: {DASHBOARD_DIR}/ not found")
        sys.exit(1)

    server = HTTPServer(("127.0.0.1", args.port), DashboardHandler)
    url = f"http://localhost:{args.port}"
    print(f"JLPT Progress Dashboard running at {url}")
    print("Press Ctrl+C to stop")

    # if not args.no_open:
    #     webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()


if __name__ == "__main__":
    main()

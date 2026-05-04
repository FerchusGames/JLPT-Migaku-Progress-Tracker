# JLPT-Migaku-Progress-Dashboard
<img width="720" height="458" alt="msedge_5O7q93hK9z" src="https://github.com/user-attachments/assets/f6d0e06f-12ec-42fa-851b-6baa7b5885fd" />

<img width="720" height="458" alt="msedge_Cs9JmByGO8" src="https://github.com/user-attachments/assets/a9634e6e-e856-477d-bfcd-205e4b66a895" />

A small Python tool that visualizes your Japanese vocabulary progress using data from [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter).

It compares your exported Migaku wordlists with a JLPT vocabulary file and serves a local web dashboard that shows how many words you know, are learning, or haven't learned yet across every JLPT level.

##  Pairs well with
### ⭐ [JLPT-Migaku-Frequency-List](https://github.com/FerchusGames/JLPT-Migaku-Frequency-List) ⭐
A JLPT frequency list compatible with the new Migaku extension sourced from stephenmk's meta dictionary for Yomitan.

## Features

- Local web dashboard with summary cards, progress table, donut chart, and per-level bar chart.
- Cumulative or per-level views, plus a toggle to count ignored words as known.
- Word browser with search and pagination across all JLPT levels.
- Flexible export panel: filter by category, level, katakana-only, tracked status, and limit, then copy to clipboard or download as CSV/JSON.
- Treats words in `ignored.csv` as known and respects manual category overrides via `extra.json`.
- Light/dark theme toggle.
- Zero external Python dependencies. Runs on the standard library alone.

## Folder structure

```
JLPT_Progress_NX/
│
├── JLPT_Vocab.json
├── server.py
│
├── dashboard/
│   ├── index.html
│   ├── styles.css
│   └── app.js
│
└── wordlists/
    ├── known.csv
    ├── learning.csv
    ├── ignored.csv
    ├── tracked.csv      (optional)
    └── extra.json       (optional)
```

## Installation

### 1. Install the Migaku Anki Exporter

Install the [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter) and follow its setup instructions. It generates the `known.csv`, `learning.csv`, and `ignored.csv` files that this tracker uses.

### 2. Get the tracker

Either clone the repo:

```
git clone https://github.com/FerchusGames/JLPT-Migaku-Progress-Tracker.git
```

…or download the ZIP from the [GitHub page](https://github.com/FerchusGames/JLPT-Migaku-Progress-Tracker) (**Code → Download ZIP**) and extract it anywhere.

You'll need Python 3 installed and on your PATH. No other dependencies are required.

## Usage

Export and extract your Migaku wordlists `.csv` files using [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter) and place them inside the `wordlists/` folder.

<img width="720" height="458" alt="msedge_RXSNqL497F" src="https://github.com/user-attachments/assets/353bad68-1520-4957-ad8d-dbf8a3ca6449" />

Start the dashboard server from your terminal:

```
python server.py
```

Then open <http://localhost:8053> in your browser.

On Windows you can also double-click `start_server.bat` to launch the server, and `stop_server.bat` to kill whatever process is listening on port 8053.

Optional flags:

```
python server.py --port 9000   # serve on a different port
python server.py --no-open     # don't auto-open the browser
```

The server will:
- Validate that `JLPT_Vocab.json`, `wordlists/`, and `dashboard/` exist.
- Parse your wordlists and classify every JLPT word as known, learning, ignored, or unknown.
- Serve the dashboard UI and a small JSON API (`/api/data`, `/api/words`).
- Re-read your wordlists on every refresh, so editing a CSV and clicking refresh is enough to see updated progress.

### Manual overrides (`wordlists/extra.json`)

Migaku's parser sometimes can't isolate a JLPT entry as a single hoverable token (compound words, unusual readings, fixed expressions, etc.), which means there's no way to mark that exact word as known from inside Migaku, so it never makes it into your exported `known.csv` even though you actually know it.

`wordlists/extra.json` is the escape hatch for those cases. List the surface form (or reading) under the category you want it to count as, and the dashboard will treat it that way regardless of what the Migaku CSVs say:

```json
{
  "known":    ["熟語1", "熟語2"],
  "learning": [],
  "ignored":  [],
  "unknown":  []
}
```

Entries here take priority over the CSV-derived classification, so you can also use it to fix the rare case where Migaku marked something incorrectly. The file is matched against both the surface and the reading of each JLPT entry, so either form works.

### Exporting words

Use the Export Words panel to select categories, level (with optional cumulative lower levels), katakana-only, tracked filter, max count, and clipboard randomization. Then click **Copy to Clipboard**, **Download CSV**, or **Download JSON**. The clipboard output pastes directly into Migaku Clipboard for batch sentence-card generation.

## Dependencies

None. `server.py` runs entirely on the Python standard library.

## Notes

This dashboard was generated quickly with AI assistance and may not be optimized or feature-complete.
It's mainly intended as a personal utility for Migaku users who want a simple way to visualize their JLPT progress.

If you find it useful, feel free to improve or extend it.

## Acknowledgements

- [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab) for the vocab list.
- [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter) for the export data.
- [Migaku](https://migaku.com/) for the language-learning tools that inspired this project.

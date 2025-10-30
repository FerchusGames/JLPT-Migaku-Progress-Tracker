# --- Auto-install required libraries if missing ---
import importlib.util
import subprocess
import sys

required = ["matplotlib", "pyperclip"]

for pkg in required:
    if importlib.util.find_spec(pkg) is None:
        print(f"📦 Installing missing package: {pkg}")
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

# --- Imports ---
import json
import csv
from pathlib import Path
import matplotlib.pyplot as plt
import pyperclip


# --- Helper functions ---
def load_jlpt_rows(path: Path):
    if not path.exists():
        print(f"❌ ERROR: Required file not found: {path}")
        sys.exit(1)

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    ignore_rows = {
        ("", ""),
        ("N5", "N5"),
        ("N4", "N4"),
        ("N3", "N3"),
        ("N2", "N2"),
        ("N1", "N1"),
    }
    rows = []
    for row in data:
        if not isinstance(row, (list, tuple)) or len(row) < 2:
            continue
        a = (str(row[0]).strip(), str(row[1]).strip())
        if a in ignore_rows:
            continue
        rows.append(a)
    return rows


def load_terms(path: Path, required=True):
    if not path.exists():
        if required:
            print(f"❌ ERROR: Required file not found: {path}")
            sys.exit(1)
        else:
            print(f"⚠️ Optional file not found: {path}")
            return set()

    terms = set()
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        for row in reader:
            for cell in row:
                s = cell.strip()
                if s:
                    terms.add(s)
    return terms


# --- Main logic ---
def run(
    jlpt_file="JLPT_Vocab.json",
    known_file="wordlists/known.csv",
    learning_file="wordlists/learning.csv",
    ignored_file="wordlists/ignored.csv",
    unknown_out="unknown_words.csv",
    save_chart="progress_chart.png",
):
    # Check required files
    for f in [jlpt_file, known_file, learning_file]:
        if not Path(f).exists():
            print(f"❌ ERROR: Required file not found: {f}")
            sys.exit(1)

    # Load data
    jlpt_rows = load_jlpt_rows(Path(jlpt_file))
    known_terms = load_terms(Path(known_file))
    learning_terms = load_terms(Path(learning_file))
    ignored_terms = load_terms(Path(ignored_file), required=False)

    # Treat ignored as known
    all_known_terms = known_terms.union(ignored_terms)

    known = 0
    learning = 0
    unknown_rows = []

    for surface, reading in jlpt_rows:
        aliases = {surface, reading} - {""}
        if aliases & all_known_terms:
            known += 1
        elif aliases & learning_terms:
            learning += 1
        else:
            unknown_rows.append((surface, reading))

    total = len(jlpt_rows)
    unknown = total - known - learning

    # Save all unknown words
    with open(unknown_out, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["surface", "reading"])
        w.writerows(unknown_rows)

    # Copy only the first 100 unknown words to clipboard
    try:
        preview = unknown_rows[:500]
        text = "\n".join([f"{surface}\t{reading}" for surface, reading in preview])
        pyperclip.copy(text)
        print(f"📋 First {len(preview)} unknown words copied to clipboard (out of {len(unknown_rows)} total).")
    except Exception as e:
        print(f"⚠️ Could not copy to clipboard: {e}")

    # Plot and save pie chart
    labels = ["Known", "Learning", "Unknown"]
    sizes = [known, learning, unknown]
    colors = ["#4CAF50", "#2196F3", "#FFC107"]

    def fmt(pct, allvals):
        total = sum(allvals)
        count = int(round(pct * total / 100.0))
        return f"{count} ({pct:.1f}%)"

    plt.figure(figsize=(6, 6))
    plt.pie(
        sizes,
        labels=labels,
        startangle=90,
        autopct=lambda pct: fmt(pct, sizes),
        colors=colors,
    )
    plt.title("JLPT N1 Progress (Ignored count as Known)")
    plt.axis("equal")
    plt.savefig(save_chart, bbox_inches="tight", dpi=200)

    print(f"✅ Total JLPT words: {total}")
    print(f"Known (including Ignored): {known}")
    print(f"Learning: {learning}")
    print(f"Unknown: {unknown}")
    print(f"Unknown words saved to: {unknown_out}")
    print(f"Chart saved to: {save_chart}")


if __name__ == "__main__":
    run()

# migaku-memory-jlpt-n1-progress-tracker

A small Python tool that visualizes your Japanese vocabulary progress using data from [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter).  

It compares your exported Migaku wordlists with a JLPT vocabulary file and shows how many words you know, are learning, or haven’t learned yet.

## Features

• Shows your JLPT vocabulary progress as a pie chart.  
• Copies the a list of unknown words to your clipboard for quick review with Migaku Clipboard (Great for generating AI sentence cards when you haven’t hit your daily quota).
• Treats words in `ignored.csv` as known.  
• Automatically installs required libraries if missing.  
• Exports all unknown JLPT words to `unknown_words.csv`.  
• Aborts if a required file is missing.  

## Folder structure

```
migaku-memory-jlpt-progress-tracker/
│
├── JLPT_Vocab.json
├── jlpt_progress.py
│
├── wordlists/
│   ├── known.csv
│   ├── learning.csv
│   └── ignored.csv
│
├── unknown_words.csv
└── progress_chart.png
```

## Installation

### 1. Install the Migaku Anki Exporter

You must have [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter) installed and configured.  
This exporter generates the `known.csv`, `learning.csv`, and `ignored.csv` files that this tracker uses.  
Follow the setup instructions on that repository before running this tool.

### 2. Download the tracker

Download and extract your desired JLPT Level [Progress Tracker.zip](https://github.com/FerchusGames/migaku-memory-jlpt-n1-progress-tracker/releases/tag/Release).

## Usage

Export your Migaku wordlists using [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter) and place them inside the `wordlists/` folder.

Run the script from your terminal:

```
python app.py
```

It will:
- Install the necessary libraries.
- Check that the required files exist.  
- Generate a pie chart (`progress_chart.png`).  
- Save your unknown words to `unknown_words.csv`.  
- Copy the first 500 unknown words to your clipboard. 

Example output:

```
📋 First 500 unknown words copied to clipboard (out of 3765 total).
✅ Total JLPT words: 8127
Known (including Ignored): 4048
Learning: 314
Unknown: 3765
Unknown words saved to: unknown_words.csv
Chart saved to: progress_chart.png
```

<img width="594" height="510" alt="progress_chart" src="https://github.com/user-attachments/assets/c6813a83-798d-42b8-a546-b7029a92d261" />

## Dependencies

- matplotlib: chart generation  
- pyperclip: clipboard support  

Both will be installed automatically if missing.

## Notes

This script was generated quickly using ChatGPT and may not be optimized or feature-complete.  
It’s mainly intended as a personal utility for Migaku users who want a simple way to visualize their JLPT N1 progress.

If you find it useful, feel free to improve or extend it.  

## Acknowledgements

- [stephenmk/yomitan-jlpt-vocab](https://github.com/stephenmk/yomitan-jlpt-vocab) for the vocab list.
- [SirOlaf/migaku-anki-exporter](https://github.com/SirOlaf/migaku-anki-exporter) for the export data. 
- [Migaku](https://migaku.com/) for the language-learning tools that inspired this project.

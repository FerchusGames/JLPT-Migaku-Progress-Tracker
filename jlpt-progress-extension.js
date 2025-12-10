// ==UserScript==
// @name         Migaku JLPT Progress Tracker
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @author       FerchusGames
// @description  Track your JLPT progress across all levels (N5-N1) in Migaku
// @license      GPL-3.0
// @icon         https://study.migaku.com/favicon.ico
// @match        https://study.migaku.com/*
// @require      https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.js
// @resource     sql_wasm https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/sql-wasm.wasm
// @grant        GM_getResourceURL
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // State
    let isVisible = false;
    let jlptProgressContainer = null;
    let jlptButton = null;

    // Add styles
    GM_addStyle(`
        /* Bottom bar button – clean gradient, NO GLOW */
        .jlpt-bottom-button {
            position: fixed;
            bottom: 24px;
            left: 168px;
            z-index: 1000;
            width: 40px;
            height: 40px;
            border-radius: 999px;

            /* FORCE gradient */
            background: linear-gradient(to bottom, #ff8b29, #f42768) !important;

            border: none !important;
            box-shadow: none !important;              /* remove outer glow */
            outline: none !important;

            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;

            color: #ffffff !important;                /* for currentColor-based icons */
            transition: transform 0.2s ease, filter 0.2s ease;
        }

        /* Hover: NO glow, just subtle scale */
        .jlpt-bottom-button:hover {
            transform: scale(1.06);
            filter: brightness(1.05);
        }

        /* Active: NO glow, just scale */
        .jlpt-bottom-button.active {
            transform: scale(1.08);
        }

        /* Make SURE the icon stays white */
        .jlpt-bottom-button svg,
        .jlpt-bottom-button svg path {
            fill: #ffffff !important;
            stroke: #ffffff !important;
        }

        /* Main container */
        .jlpt-progress-container {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: var(--background, #1a1a1a);
            z-index: 999;
            overflow-y: auto;
            padding: 80px 24px 24px 24px;
            display: none;
        }

        .jlpt-progress-container.visible {
            display: block;
        }

        .jlpt-progress-inner {
            max-width: 1080px;
            margin: 0 auto;
        }

        .jlpt-progress-card {
            background: var(--background-elevation-1, #2a2a2a);
            border-radius: 16px;
            padding: 32px;
            margin-bottom: 24px;
        }

        .jlpt-progress-title {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 8px;
            color: var(--text-color, #ffffff);
        }

        .jlpt-progress-subtitle {
            font-size: 16px;
            color: var(--text-color-secondary, #aaa);
            margin-bottom: 32px;
        }

        .jlpt-close-button {
            position: fixed;
            top: 24px;
            right: 24px;
            z-index: 1001;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: var(--background-elevation-1, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .jlpt-close-button:hover {
            background: var(--background-elevation-2, #333);
            transform: rotate(90deg);
        }

        .jlpt-close-button svg {
            width: 24px;
            height: 24px;
            stroke: var(--text-color, #ffffff);
        }

        /* Summary cards */
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }

        .summary-card {
            background: var(--background-elevation-2, #333);
            border-radius: 12px;
            padding: 24px;
            text-align: center;
            transition: transform 0.2s ease;
        }

        .summary-card:hover {
            transform: translateY(-2px);
        }

        .summary-value {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 8px;
            line-height: 1;
        }

        .summary-label {
            font-size: 14px;
            color: var(--text-color-secondary, #aaa);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        /* Table */
        .jlpt-table {
            width: 100%;
            border-collapse: collapse;
        }

        .jlpt-table th,
        .jlpt-table td {
            padding: 20px 16px;
            text-align: left;
            border-bottom: 1px solid var(--border-color, #444);
        }

        .jlpt-table th {
            font-weight: 600;
            color: var(--text-color-secondary, #aaa);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .jlpt-table td {
            color: var(--text-color, #ffffff);
            font-size: 16px;
        }

        .jlpt-table tbody tr {
            transition: background 0.2s ease;
        }

        .jlpt-table tbody tr:hover {
            background: var(--background-elevation-2, #333);
        }

        .jlpt-level-badge {
            display: inline-block;
            padding: 6px 16px;
            border-radius: 20px;
            font-weight: 700;
            font-size: 14px;
            letter-spacing: 0.5px;
        }

        .jlpt-level-n5 { background: #4CAF50; color: white; }
        .jlpt-level-n4 { background: #2196F3; color: white; }
        .jlpt-level-n3 { background: #FF9800; color: white; }
        .jlpt-level-n2 { background: #F44336; color: white; }
        .jlpt-level-n1 { background: #9C27B0; color: white; }

        /* Solid green progress bar */
        .progress-bar-container {
            width: 100%;
            max-width: 200px;
            height: 8px;
            background: rgba(255, 255, 255, 0.08);
            border-radius: 999px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            background: #4CAF50 !important;   /* SOLID GREEN */
            border-radius: 999px;
            transition: width 0.3s ease;
            box-shadow: none !important;       /* Make sure no glow appears */
        }


        .progress-text {
            font-size: 14px;
            color: var(--text-color, #fff);
            font-weight: 600;
            margin-top: 4px;
        }

        .stat-number {
            font-weight: 600;
            font-size: 16px;
        }

        .stat-known { color: #4CAF50; }
        .stat-learning { color: #2196F3; }
        .stat-unknown { color: #FFC107; }

        .loading-spinner {
            text-align: center;
            padding: 60px;
            color: var(--text-color-secondary, #aaa);
            font-size: 18px;
        }

        .error-message {
            padding: 24px;
            background: rgba(244, 67, 54, 0.1);
            border: 1px solid #F44336;
            border-radius: 12px;
            color: #F44336;
            line-height: 1.6;
        }

        .error-message strong {
            display: block;
            margin-bottom: 12px;
            font-size: 18px;
        }

        /* Controls section */
        .jlpt-controls {
            background: var(--background-elevation-2, #333);
            border-radius: 12px;
            padding: 20px;
            margin-top: 24px;
        }

        .jlpt-control-row {
            display: flex;
            gap: 12px;
            align-items: center;
            margin-bottom: 12px;
        }

        .jlpt-control-row:last-child {
            margin-bottom: 0;
        }

        .jlpt-control-row > .jlpt-button:only-child {
            width: 100%;
        }

        .jlpt-input {
            flex: 1;
            background: var(--background-elevation-1, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            border-radius: 8px;
            padding: 10px 14px;
            color: var(--text-color, #ffffff);
            font-size: 14px;
        }

        .jlpt-input:focus {
            outline: none;
            border-color: #ff8b29;
        }

        .jlpt-button {
            background: linear-gradient(to bottom, #ff8b29, #f42768);
            border: none;
            border-radius: 8px;
            padding: 10px 20px;
            color: white;
            font-weight: 600;
            cursor: pointer;
            font-size: 14px;
            transition: transform 0.2s ease, filter 0.2s ease;
            white-space: nowrap;
        }

        .jlpt-button:hover {
            transform: translateY(-1px);
            filter: brightness(1.1);
        }

        .jlpt-button:active {
            transform: translateY(0);
        }

        .jlpt-label {
            font-size: 14px;
            color: var(--text-color-secondary, #aaa);
            min-width: 120px;
        }

        .jlpt-status-message {
            font-size: 13px;
            color: var(--text-color-secondary, #aaa);
            margin-top: 8px;
        }

        .jlpt-status-message.success {
            color: #4CAF50;
        }

        .jlpt-status-message.error {
            color: #F44336;
        }
    `);

    // Database functions
    const decompress = async (blob) => {
        const ds = new DecompressionStream("gzip");
        const decompressedStream = blob.stream().pipeThrough(ds);
        const reader = decompressedStream.getReader();
        const chunks = [];
        let totalSize = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            chunks.push(value);
            totalSize += value.byteLength;
        }
        const res = new Uint8Array(totalSize);
        let offset = 0;
        for (const chunk of chunks) {
            res.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return res;
    };

    const fetchRawSrsDb = () => {
        return new Promise((resolve, reject) => {
            const dbRequest = indexedDB.open('srs', 1);
            dbRequest.onsuccess = function (event) {
                const idb = dbRequest.result;
                const transaction = idb.transaction('data', 'readonly');
                const objectStore = transaction.objectStore('data');
                const cursorRequest = objectStore.openCursor();
                cursorRequest.onsuccess = function (ev) {
                    if (cursorRequest.result) {
                        const cursor = cursorRequest.result;
                        const data = cursor.value.data;
                        const blob = new Blob([data], { type: "application/octet-stream" });
                        decompress(blob).then(resolve).catch(reject);
                        cursor.continue();
                    }
                };
                cursorRequest.onerror = reject;
                idb.close();
            };
            dbRequest.onerror = reject;
        });
    };

    const openSrsDb = async (SQL) => {
        const raw = await fetchRawSrsDb();
        return new SQL.Database(raw);
    };

    const fetchWordListForLang = (db, lang) => {
        const query = "SELECT dictForm, secondary, knownStatus, del, tracked FROM WordList WHERE language=?";
        const result = db.exec(query, [lang]);
        if (!result || result.length === 0) return [];

        const words = [];
        for (const row of result[0].values) {
            words.push({
                dictForm: row[0],
                secondary: row[1],
                knownStatus: row[2],
                del: row[3] !== 0,
                tracked: row[4] !== 0
            });
        }
        return words;
    };

    // Load JLPT vocab (matches app.py logic)
    const loadJlptVocab = async () => {
        try {
            const storedData = localStorage.getItem('jlpt_vocab_data');
            if (storedData) {
                return JSON.parse(storedData);
            }

            const response = await fetch('https://raw.githubusercontent.com/FerchusGames/JLPT-Migaku-Frequency-List/refs/heads/main/JLPT.json');
            if (!response.ok) throw new Error('Failed to load from GitHub');

            const data = await response.json();
            try {
                localStorage.setItem('jlpt_vocab_data', JSON.stringify(data));
            } catch (e) {
                console.warn('Could not save to localStorage:', e);
            }
            return data;
        } catch (error) {
            console.error('Error loading JLPT vocab:', error);
            return null;
        }
    };

    // Load additional words from jsonbin.io
    const loadAdditionalWordsFromJsonbin = async (jsonbinUrl) => {
        if (!jsonbinUrl || jsonbinUrl.trim() === '') {
            return { known: new Set(), ignored: new Set() };
        }

        try {
            const response = await fetch(jsonbinUrl);
            if (!response.ok) throw new Error('Failed to load from jsonbin.io');

            let data = await response.json();

            // Handle JSONBin.io v3 API response format (has a "record" wrapper)
            if (data.record) {
                data = data.record;
            }

            const knownSet = new Set();
            const ignoredSet = new Set();

            // Handle different JSON formats:
            if (Array.isArray(data)) {
                // Format 1: Simple array ["word1", "word2", "word3"] - treat all as known
                data.forEach(word => {
                    if (typeof word === 'string' && word.trim()) {
                        knownSet.add(word.trim());
                    }
                });
            } else if (typeof data === 'object') {
                // Format 2: Object with "known" and/or "ignored" arrays
                if (data.known && Array.isArray(data.known)) {
                    data.known.forEach(word => {
                        if (typeof word === 'string' && word.trim()) {
                            knownSet.add(word.trim());
                        }
                    });
                }
                if (data.ignored && Array.isArray(data.ignored)) {
                    data.ignored.forEach(word => {
                        if (typeof word === 'string' && word.trim()) {
                            ignoredSet.add(word.trim());
                        }
                    });
                }

                // Format 3: Object with just "words" array - treat all as known
                if (data.words && Array.isArray(data.words)) {
                    data.words.forEach(word => {
                        if (typeof word === 'string' && word.trim()) {
                            knownSet.add(word.trim());
                        }
                    });
                }
            }

            console.log(`✅ Loaded ${knownSet.size} additional known words and ${ignoredSet.size} ignored words from JSONBin`);
            return { known: knownSet, ignored: ignoredSet };
        } catch (error) {
            console.error('❌ Error loading additional words from jsonbin.io:', error);
            return { known: new Set(), ignored: new Set() };
        }
    };

    // Parse JLPT vocab (matches app.py logic)
    const parseJlptVocabByLevel = (vocabData) => {
        const ignoreRows = new Set([
            '',
            'N5,N5',
            'N4,N4',
            'N3,N3',
            'N2,N2',
            'N1,N1'
        ]);

        const levelIndices = { N5: -1, N4: -1, N3: -1, N2: -1, N1: -1 };
        const rows = [];

        for (let i = 0; i < vocabData.length; i++) {
            const row = vocabData[i];
            if (!Array.isArray(row) || row.length < 2) continue;

            const surface = String(row[0] || '').trim();
            const reading = String(row[1] || '').trim();

            // Check if this is a level marker
            if (surface === reading && /^N[1-5]$/.test(surface)) {
                levelIndices[surface] = rows.length;
                continue;
            }

            // Skip empty rows
            const key = `${surface},${reading}`;
            if (ignoreRows.has(key) || (!surface && !reading)) continue;

            rows.push({ surface, reading });
        }

        return { rows, levelIndices };
    };

    // Calculate progress (matches app.py logic)
    const calculateProgress = (jlptRows, levelIndices, wordList, additionalWords = null) => {
        // Build term sets
        const knownTerms = new Set();
        const learningTerms = new Set();
        const ignoredTerms = new Set();

        for (const word of wordList) {
            if (word.del) continue;

            const terms = [word.dictForm, word.secondary].filter(t => t && t.trim());

            switch (word.knownStatus) {
                case 'KNOWN':
                    terms.forEach(t => knownTerms.add(t));
                    break;
                case 'LEARNING':
                    terms.forEach(t => learningTerms.add(t));
                    break;
                case 'IGNORED':
                    terms.forEach(t => ignoredTerms.add(t));
                    break;
            }
        }

        // Add additional words from jsonbin.io if provided
        if (additionalWords) {
            additionalWords.known.forEach(t => knownTerms.add(t));
            additionalWords.ignored.forEach(t => ignoredTerms.add(t));
        }

        // Treat ignored as known
        const allKnownTerms = new Set([...knownTerms, ...ignoredTerms]);

        // Calculate for each level (additive)
        const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
        const results = {};

        for (let i = 0; i < levels.length; i++) {
            const level = levels[i];
            const nextLevel = levels[i + 1];

            // Determine the range of rows for this level
            const startIdx = 0; // Always start from beginning (additive)
            const endIdx = nextLevel ? levelIndices[nextLevel] : jlptRows.length;

            const levelRows = jlptRows.slice(startIdx, endIdx);

            let known = 0;
            let learning = 0;
            let unknown = 0;

            for (const row of levelRows) {
                const aliases = new Set([row.surface, row.reading].filter(t => t));

                // Check if any alias matches (matches app.py line 98)
                if ([...aliases].some(alias => allKnownTerms.has(alias))) {
                    known++;
                } else if ([...aliases].some(alias => learningTerms.has(alias))) {
                    learning++;
                } else {
                    unknown++;
                }
            }

            const total = levelRows.length;
            const percentage = total > 0 ? ((known / total) * 100).toFixed(1) : 0;

            results[level] = {
                total,
                known,
                learning,
                unknown,
                percentage: parseFloat(percentage)
            };
        }

        return results;
    };

    // Get unknown words (excluding tracked words)
    const getUnknownWords = (jlptRows, wordList, additionalWords = null) => {
        // Build term sets
        const knownTerms = new Set();
        const learningTerms = new Set();
        const ignoredTerms = new Set();
        const trackedTerms = new Set();

        for (const word of wordList) {
            if (word.del) continue;

            const terms = [word.dictForm, word.secondary].filter(t => t && t.trim());

            switch (word.knownStatus) {
                case 'KNOWN':
                    terms.forEach(t => knownTerms.add(t));
                    break;
                case 'LEARNING':
                    terms.forEach(t => learningTerms.add(t));
                    break;
                case 'IGNORED':
                    terms.forEach(t => ignoredTerms.add(t));
                    break;
            }

            // Track words marked as tracked
            if (word.tracked) {
                terms.forEach(t => trackedTerms.add(t));
            }
        }

        // Add additional words from jsonbin.io if provided
        if (additionalWords) {
            additionalWords.known.forEach(t => knownTerms.add(t));
            additionalWords.ignored.forEach(t => ignoredTerms.add(t));
        }

        // Treat ignored as known
        const allKnownTerms = new Set([...knownTerms, ...ignoredTerms]);

        // Find unknown words (excluding tracked)
        const unknownWords = [];
        for (const row of jlptRows) {
            const aliases = new Set([row.surface, row.reading].filter(t => t));

            // Check if word is not known and not learning
            const isKnown = [...aliases].some(alias => allKnownTerms.has(alias));
            const isLearning = [...aliases].some(alias => learningTerms.has(alias));
            const isTracked = [...aliases].some(alias => trackedTerms.has(alias));

            if (!isKnown && !isLearning && !isTracked) {
                unknownWords.push({ surface: row.surface, reading: row.reading });
            }
        }

        return unknownWords;
    };

    // Copy unknown words to clipboard
    const copyUnknownWordsToClipboard = async (unknownWords, limit = 100) => {
        const wordsToClip = unknownWords.slice(0, limit);
        const text = wordsToClip.map(w => `${w.surface}\t${w.reading}`).join('\n');

        try {
            await navigator.clipboard.writeText(text);
            return { success: true, count: wordsToClip.length, total: unknownWords.length };
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            return { success: false, error: error.message };
        }
    };

    // Render UI
    const renderProgressTable = (progressData) => {
        const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
        const colors = {
            'N5': 'jlpt-level-n5',
            'N4': 'jlpt-level-n4',
            'N3': 'jlpt-level-n3',
            'N2': 'jlpt-level-n2',
            'N1': 'jlpt-level-n1'
        };

        let html = `
            <table class="jlpt-table">
                <thead>
                    <tr>
                        <th>Level</th>
                        <th>Total Words</th>
                        <th>Known</th>
                        <th>Learning</th>
                        <th>Unknown</th>
                        <th>Progress</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const level of levels) {
            const data = progressData[level];
            html += `
                <tr>
                    <td><span class="jlpt-level-badge ${colors[level]}">${level}</span></td>
                    <td><span class="stat-number">${data.total.toLocaleString()}</span></td>
                    <td><span class="stat-number stat-known">${data.known.toLocaleString()}</span></td>
                    <td><span class="stat-number stat-learning">${data.learning.toLocaleString()}</span></td>
                    <td><span class="stat-number stat-unknown">${data.unknown.toLocaleString()}</span></td>
                    <td>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${data.percentage}%"></div>
                        </div>
                        <div class="progress-text">${data.percentage}%</div>
                    </td>
                </tr>
            `;
        }

        html += `</tbody></table>`;
        return html;
    };

    const renderSummaryCards = (progressData) => {
        const n1Data = progressData['N1'];
        return `
            <div class="summary-grid">
                <div class="summary-card">
                    <div class="summary-value stat-known">${n1Data.known.toLocaleString()}</div>
                    <div class="summary-label">Known</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value stat-learning">${n1Data.learning.toLocaleString()}</div>
                    <div class="summary-label">Learning</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value stat-unknown">${n1Data.unknown.toLocaleString()}</div>
                    <div class="summary-label">Unknown</div>
                </div>
                <div class="summary-card">
                    <div class="summary-value">${n1Data.percentage}%</div>
                    <div class="summary-label">Progress</div>
                </div>
            </div>
        `;
    };

    // Create progress view
    const createProgressView = async () => {
        try {
            const container = document.createElement('div');
            container.className = 'jlpt-progress-container';
            container.innerHTML = `
                <div class="jlpt-progress-inner">
                    <div class="jlpt-progress-card">
                        <div class="loading-spinner">Loading JLPT vocabulary data...</div>
                    </div>
                </div>
                <button class="jlpt-close-button" id="jlptCloseBtn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            `;

            // Load vocab
            const vocabData = await loadJlptVocab();
            if (!vocabData) {
                container.querySelector('.jlpt-progress-card').innerHTML = `
                    <div class="error-message">
                        <strong>Error: Could not load JLPT vocabulary data</strong>
                        <p>Please use <code>jlpt-vocab-loader.html</code> to load the vocabulary file, or check your internet connection for automatic download from GitHub.</p>
                    </div>
                `;
                return container;
            }

            container.querySelector('.jlpt-progress-card').innerHTML = '<div class="loading-spinner">Analyzing your progress...</div>';

            // Parse vocab
            const { rows: jlptRows, levelIndices } = parseJlptVocabByLevel(vocabData);

            // Initialize SQL.js
            const SQL = await initSqlJs({ locateFile: () => GM_getResourceURL("sql_wasm") });
            const db = await openSrsDb(SQL);

            // Fetch word list
            const wordList = fetchWordListForLang(db, 'ja');

            // Load jsonbin URL from localStorage
            const savedJsonbinUrl = localStorage.getItem('jlpt_jsonbin_url') || '';

            // Calculate progress
            let additionalWords = null;
            if (savedJsonbinUrl) {
                additionalWords = await loadAdditionalWordsFromJsonbin(savedJsonbinUrl);
            }
            const progressData = calculateProgress(jlptRows, levelIndices, wordList, additionalWords);

            // Render
            container.querySelector('.jlpt-progress-inner').innerHTML = `
                <div class="jlpt-progress-card">
                    <h1 class="jlpt-progress-title">JLPT Vocabulary Progress</h1>
                    ${renderSummaryCards(progressData)}
                    ${renderProgressTable(progressData)}

                    <div class="jlpt-controls">
                        <div class="jlpt-control-row">
                            <button id="copyUnknownBtn" class="jlpt-button">Copy 100 Unknown Words</button>
                        </div>
                        <div class="jlpt-control-row">
                            <label class="jlpt-label">JSON URL:</label>
                            <input type="text" id="jsonbinUrlInput" class="jlpt-input" placeholder="https://api.jsonbin.io/v3/b/YOUR_BIN_ID/latest" value="${savedJsonbinUrl}">
                            <button id="saveJsonbinBtn" class="jlpt-button">Save & Reload</button>
                        </div>
                        <div id="statusMessage" class="jlpt-status-message"></div>
                    </div>
                </div>
            `;

            // Add close button handler
            container.querySelector('#jlptCloseBtn').addEventListener('click', toggleView);

            // Add jsonbin save handler
            container.querySelector('#saveJsonbinBtn').addEventListener('click', async () => {
                const url = container.querySelector('#jsonbinUrlInput').value.trim();
                localStorage.setItem('jlpt_jsonbin_url', url);

                const statusMsg = container.querySelector('#statusMessage');
                statusMsg.textContent = 'Reloading with new URL...';
                statusMsg.className = 'jlpt-status-message';

                // Reload the view
                const newContainer = await createProgressView();
                container.replaceWith(newContainer);
                jlptProgressContainer = newContainer;
                if (isVisible) {
                    jlptProgressContainer.classList.add('visible');
                }
            });

            // Add copy unknown words handler
            container.querySelector('#copyUnknownBtn').addEventListener('click', async () => {
                const statusMsg = container.querySelector('#statusMessage');

                // Get unknown words (tracked words are automatically excluded from the database)
                const unknownWords = getUnknownWords(jlptRows, wordList, additionalWords);

                // Copy to clipboard
                const result = await copyUnknownWordsToClipboard(unknownWords, 100);

                if (result.success) {
                    statusMsg.textContent = `📋 Copied ${result.count} unknown words to clipboard (out of ${result.total} total)`;
                    statusMsg.className = 'jlpt-status-message success';
                } else {
                    statusMsg.textContent = `❌ Error: ${result.error}`;
                    statusMsg.className = 'jlpt-status-message error';
                }
            });

            return container;

        } catch (error) {
            console.error('Error creating progress view:', error);
            const container = document.createElement('div');
            container.className = 'jlpt-progress-container';
            container.innerHTML = `
                <div class="jlpt-progress-inner">
                    <div class="jlpt-progress-card">
                        <div class="error-message">
                            <strong>Error: ${error.message}</strong>
                            <p>Please check the console for more details.</p>
                        </div>
                    </div>
                </div>
                <button class="jlpt-close-button" id="jlptCloseBtn">
                    <svg viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            `;
            container.querySelector('#jlptCloseBtn').addEventListener('click', toggleView);
            return container;
        }
    };

    // Toggle visibility
    const toggleView = () => {
        isVisible = !isVisible;

        if (jlptProgressContainer) {
            if (isVisible) {
                jlptProgressContainer.classList.add('visible');
                jlptButton.classList.add('active');
            } else {
                jlptProgressContainer.classList.remove('visible');
                jlptButton.classList.remove('active');
            }
        }
    };

    // Create bottom button
    const createBottomButton = () => {
        const button = document.createElement('button');
        button.className = 'jlpt-bottom-button';
        button.title = 'JLPT Progress';
        button.innerHTML = `
            <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
            </svg>
        `;
        button.addEventListener('click', toggleView);
        return button;
    };

    // Initialize
    const init = async () => {
        // Wait for page to load
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Create and add button
        jlptButton = createBottomButton();
        document.body.appendChild(jlptButton);

        // Create progress view
        jlptProgressContainer = await createProgressView();
        document.body.appendChild(jlptProgressContainer);

        console.log('JLPT Progress Tracker initialized');
    };

    // Wait for Migaku and initialize
    const waitForMigaku = (callback) => {
        const observer = new MutationObserver((_, obs) => {
            if (document.querySelector('main[data-mgk-lang-selected]')) {
                obs.disconnect();
                callback();
            }
        });
        observer.observe(document, { childList: true, subtree: true });
    };

    waitForMigaku(() => {
        init();
    });

})();

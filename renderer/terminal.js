const outputContainer = document.getElementById('output');
const hiddenContainer = document.getElementById('hidden-terminal');

const term = new Terminal({
    fontFamily: '"Bundled MesloLGS NF", "MesloLGS Nerd Font Mono", "MesloLGS NF", "MesloLGS Nerd Font", "Menlo", "Monaco", "Myanmar Sangam MN", "Padauk", "Noto Sans Myanmar", monospace',
    fontSize: 19,
    lineHeight: 1.25, // Better for Myanmar marks
    allowProposedApi: true,
    theme: { background: 'transparent' } // Let the blurred background show through
});

const isMyanmarMc = (cp) =>
    (cp >= 0x102b && cp <= 0x102c) ||
    cp === 0x1031 ||
    cp === 0x1038 ||
    (cp >= 0x103b && cp <= 0x103c) ||
    (cp >= 0x1056 && cp <= 0x1057) ||
    (cp >= 0x1062 && cp <= 0x1064) ||
    (cp >= 0x1067 && cp <= 0x106d) ||
    (cp >= 0x1083 && cp <= 0x1084) ||
    (cp >= 0x1087 && cp <= 0x108c) ||
    cp === 0x108f ||
    (cp >= 0x109a && cp <= 0x109c);

function applyMyanmarWidth(terminal) {
    try {
        const v11 = terminal._core?.unicodeService?._providers?.['11'];
        if (v11) {
            const origWc = v11.wcwidth.bind(v11);
            v11.wcwidth = (cp) =>
                isMyanmarMc(cp) && terminal.buffer.active.type === 'normal'
                    ? 0
                    : origWc(cp);
        }
    } catch (e) {
        console.warn('Myanmar width patch failed', e);
    }
}

const fitAddon = new FitAddon.FitAddon();
term.loadAddon(fitAddon);

// Canvas addon for better rendering performance and Burmese support
if (typeof CanvasAddon !== 'undefined') {
    const canvasAddon = new CanvasAddon.CanvasAddon();
    term.loadAddon(canvasAddon);
}

try {
    const unicode11Addon = new Unicode11Addon.Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = '11';
    applyMyanmarWidth(term);
} catch (e) {
    console.warn('Unicode config failed', e);
}

// xterm.js now sizes properly based on the CSS overlay
term.open(hiddenContainer);
fitAddon.fit();

let renderScheduled = false;
function scheduleRender() {
    if (renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(() => {
        renderScheduled = false;
        renderBuffer();
    });
}

// Every time the brain updates, we refresh the "Eyes"
term.onRender(() => {
    scheduleRender();
});

// We also refresh on a timer for safety/initial load
setInterval(scheduleRender, 500);

// Composition state (used by renderLine for the Myanmar preview underline)
let isComposing = false;
let compositionText = '';

function renderBuffer() {
    const buffer = term.buffer.active;
    const lines = [];
    
    // Total lines to render (up to viewport height)
    const viewPortHeight = term.rows;
    const startRow = buffer.viewportY;
    const cursorY = buffer.cursorY + buffer.baseY; // Absolute Y
    const cursorX = buffer.cursorX;

    for (let i = 0; i < viewPortHeight; i++) {
        const absoluteRow = startRow + i;
        const line = buffer.getLine(absoluteRow);
        if (line) {
            const isCursorRow = absoluteRow === cursorY;
            lines.push(renderLine(line, isCursorRow ? cursorX : -1));
        }
    }
    
    const html = lines.join('');
    if (outputContainer.innerHTML !== html) {
        outputContainer.innerHTML = html;
    }
}

function renderLine(line, cursorX) {
    let html = '<div class="line">';
    let currentContent = '';
    let lastFg = null;
    let lastFgMode = null;
    let lastBg = null;
    let lastBgMode = null;
    let lastBold = 0;
    let lastItalic = 0;
    let lastUnderline = 0;

    // Secret Sauce: Group characters to preserve shaping clusters
    const cell = term.buffer.active.getNullCell();
    for (let x = 0; x < term.cols; x++) {
        if (x === cursorX) {
            // Flush current group
            html += wrapWithStyle(currentContent, lastFg, lastFgMode, lastBg, lastBgMode, lastBold, lastItalic, lastUnderline);
            currentContent = '';
            
            // Draw cursor cell
            const c = line.getCell(x, cell);
            let char = ' ';
            let cursorStyle = '';
            if (c && c.getWidth() !== 0) {
                char = c.getChars() || ' ';
                // Check for the "prerender" blue underline
                // In xterm.js, underline is c.isUnderline()
                if (c.isUnderline()) {
                    cursorStyle = 'text-decoration: underline; text-decoration-color: #89b4fa;';
                }
            }
            html += `<span class="cursor" style="${cursorStyle}">${escapeHtml(char)}</span>`;
            
            // Reset styles after cursor
            lastFg = null; lastFgMode = null;
            lastBg = null; lastBgMode = null;
            lastBold = 0; lastItalic = 0; lastUnderline = 0;
            continue;
        }

        const c = line.getCell(x, cell);
        if (!c) continue;

        const fg = c.getFgColor();
        const fgMode = c.getFgColorMode();
        const bg = c.getBgColor();
        const bgMode = c.getBgColorMode();
        const bold = c.isBold();
        const italic = c.isItalic();
        const underline = c.isUnderline();

        if (fg !== lastFg || fgMode !== lastFgMode || bg !== lastBg || bgMode !== lastBgMode || bold !== lastBold || italic !== lastItalic || underline !== lastUnderline) {
            html += wrapWithStyle(currentContent, lastFg, lastFgMode, lastBg, lastBgMode, lastBold, lastItalic, lastUnderline);
            currentContent = '';
            lastFg = fg; lastFgMode = fgMode;
            lastBg = bg; lastBgMode = bgMode;
            lastBold = bold; lastItalic = italic;
            lastUnderline = underline;
        }
        
        if (c.getWidth() === 0) {
            continue;
        }

        currentContent += c.getChars() || ' '; 
    }
    

    html += wrapWithStyle(currentContent, lastFg, lastFgMode, lastBg, lastBgMode, lastBold, lastItalic, lastUnderline);
    
    // If cursor is beyond the last cell (waiting at the end)
    if (cursorX === term.cols) {
        html += `<span class="cursor"> </span>`;
    }
    
    html += '</div>';
    return html;
}

let ANSI_COLORS = [
    '#45475a', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7', '#94e2d5', '#bac2de',
    '#585b70', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7', '#94e2d5', '#a6adc8'
];

const THEMES = {
    mocha: {
        name: 'Catppuccin Mocha',
        bg: [30, 30, 46], fg: '#cdd6f4', cursor: '#f5e0dc',
        ansi: ['#45475a', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7', '#94e2d5', '#bac2de', '#585b70', '#f38ba8', '#a6e3a1', '#f9e2af', '#89b4fa', '#f5c2e7', '#94e2d5', '#a6adc8']
    },
    onedark: {
        name: 'Atom One Dark',
        bg: [40, 44, 52], fg: '#abb2bf', cursor: '#528bff',
        ansi: ['#282c34', '#e06c75', '#98c379', '#d19a66', '#61afef', '#c678dd', '#56b6c2', '#abb2bf', '#5c6370', '#e06c75', '#98c379', '#d19a66', '#61afef', '#c678dd', '#56b6c2', '#ffffff']
    },
    nord: {
        name: 'Nordic Frost',
        bg: [46, 52, 64], fg: '#d8dee9', cursor: '#88c0d0',
        ansi: ['#3b4252', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#88c0d0', '#e5e9f0', '#4c566a', '#bf616a', '#a3be8c', '#ebcb8b', '#81a1c1', '#b48ead', '#8fbcbb', '#eceff4']
    },
    dracula: {
        name: 'Dracula Vampire',
        bg: [40, 42, 54], fg: '#f8f8f2', cursor: '#f8f8f2',
        ansi: ['#21222c', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#f8f8f2', '#6272a4', '#ff5555', '#50fa7b', '#f1fa8c', '#bd93f9', '#ff79c6', '#8be9fd', '#ffffff']
    },
    solarized: {
        name: 'Solarized Dark',
        bg: [0, 43, 54], fg: '#839496', cursor: '#93a1a1',
        ansi: ['#073642', '#dc322f', '#859900', '#b58900', '#268bd2', '#d33682', '#2aa198', '#eee8d5', '#002b36', '#cb4b16', '#586e75', '#657b83', '#839496', '#6c71c4', '#93a1a1', '#fdf6e3']
    }
};

let settings = {
    theme: 'mocha',
    opacity: 0.7,
    fontSize: 19,
    fontFamily: 'Bundled MesloLGS NF'
};

function loadSettings() {
    const saved = localStorage.getItem('mterm-settings');
    if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
    }
    applySettings();
}

function saveSettings() {
    localStorage.setItem('mterm-settings', JSON.stringify(settings));
    applySettings();
}

function applySettings() {
    const theme = THEMES[settings.theme] || THEMES.mocha;
    ANSI_COLORS = theme.ansi;

    // Update Theme Name in UI
    const themeNameEl = document.getElementById('theme-name');
    if (themeNameEl) themeNameEl.innerText = theme.name;
    
    // Apply to Body (Background & Base Font)
    document.body.style.backgroundColor = `rgba(${theme.bg.join(',')}, ${settings.opacity})`;
    document.body.style.fontFamily = `'${settings.fontFamily}', 'Menlo', 'Monaco', 'Myanmar Sangam MN', 'Padauk', 'Noto Sans Myanmar', monospace`;
    document.body.style.fontSize = `${settings.fontSize}px`;
    document.body.style.color = theme.fg;

    // Apply to Xterm Brain
    term.options.fontFamily = `"${settings.fontFamily}", "MesloLGS NF", "Menlo", "Monaco", "Myanmar Sangam MN", "Padauk", "Noto Sans Myanmar", monospace`;
    term.options.fontSize = settings.fontSize;
    
    // Apply to Cursor (via stylesheet rule)
    try {
        const styleSheet = document.styleSheets[0];
        for (let rule of styleSheet.cssRules) {
            if (rule.selectorText === '.cursor') {
                rule.style.backgroundColor = theme.cursor;
                rule.style.color = `rgba(${theme.bg.join(',')}, 1)`;
            }
            if (rule.selectorText === '.settings-modal') {
                rule.style.backgroundColor = `rgb(${theme.bg.join(',')})`;
            }
        }
    } catch(e) { /* stylesheet not yet available */ }

    fitAddon.fit();
    renderBuffer();
}

function get256Color(code) {
    if (code < 16) return ANSI_COLORS[code];
    if (code >= 232) {
        const c = (code - 232) * 10 + 8;
        return `rgb(${c}, ${c}, ${c})`;
    }
    code -= 16;
    const r = Math.floor(code / 36);
    const g = Math.floor((code % 36) / 6);
    const b = code % 6;
    const calc = (val) => val === 0 ? 0 : val * 40 + 55;
    return `rgb(${calc(r)}, ${calc(g)}, ${calc(b)})`;
}

function getCssColor(color, mode) {
    if (mode === 0) return null;
    if (mode === 16777216) return ANSI_COLORS[color]; // 16 colors
    if (mode === 33554432) return get256Color(color); // 256 colors
    if (mode === 50331648) { // TrueColor
        const r = (color >> 16) & 255;
        const g = (color >> 8) & 255;
        const b = color & 255;
        return `rgb(${r}, ${g}, ${b})`;
    }
    return null;
}

function wrapWithStyle(text, fg, fgMode, bg, bgMode, bold, italic, underline) {
    if (!text) return '';
    
    const fgCss = getCssColor(fg, fgMode);
    const bgCss = getCssColor(bg, bgMode);
    
    // If no styles, just return text
    if (!fgCss && !bgCss && !bold && !italic && !underline) {
        return escapeHtml(text);
    }
    
    // Build CSS rules
    let styles = [];
    if (fgCss) styles.push(`color: ${fgCss}`);
    if (bgCss) styles.push(`background-color: ${bgCss}`);
    if (bold) styles.push(`font-weight: bold`);
    if (italic) styles.push(`font-style: italic`);
    if (underline) {
        styles.push(`text-decoration: underline`);
        styles.push(`text-decoration-color: #89b4fa`);
    }
    
    return `<span style="${styles.join(';')}">${escapeHtml(text)}</span>`;
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Forward all data from PTY to Brain
window.termAPI.onOutput(data => {
    term.write(data);
});

// Handle input
term.onData(data => {
    window.termAPI.sendInput(data);
});

// Keyboard focus management
window.addEventListener('load', async () => {
    await document.fonts.ready;
    loadSettings(); // Initialize settings
    window.termAPI.spawnPTY();
    
    // UI Event Listeners
    const overlay = document.getElementById('settings-overlay');
    const opacitySlider = document.getElementById('opacity-slider');
    const opacityVal = document.getElementById('opacity-val');
    const fontSizeSlider = document.getElementById('font-size-slider');
    const fontSizeVal = document.getElementById('font-size-val');
    const fontSelect = document.getElementById('font-select');
    const themeBtns = document.querySelectorAll('.theme-btn');

    const closeSettings = () => { overlay.style.display = 'none'; term.focus(); };
    document.getElementById('close-settings').onclick = closeSettings;

    opacitySlider.oninput = (e) => {
        settings.opacity = parseFloat(e.target.value);
        opacityVal.innerText = settings.opacity;
        saveSettings();
    };

    fontSizeSlider.oninput = (e) => {
        settings.fontSize = parseInt(e.target.value);
        fontSizeVal.innerText = settings.fontSize;
        saveSettings();
    };

    fontSelect.onchange = (e) => {
        settings.fontFamily = e.target.value;
        saveSettings();
    };

    themeBtns.forEach(btn => {
        btn.onclick = () => {
            themeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            settings.theme = btn.dataset.theme;
            saveSettings();
        };
    });

    // Update UI to match loaded settings
    opacitySlider.value = settings.opacity;
    opacityVal.innerText = settings.opacity;
    fontSizeSlider.value = settings.fontSize;
    fontSizeVal.innerText = settings.fontSize;
    fontSelect.value = settings.fontFamily;
    document.querySelector(`.theme-btn[data-theme="${settings.theme}"]`)?.classList.add('active');

    // Global Shortcut Listener (Cmd + ,)
    window.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === ',') {
            e.preventDefault();
            overlay.style.display = 'flex';
        }
        if (e.key === 'Escape' && overlay.style.display === 'flex') {
            closeSettings();
        }
    });

    // Ensure PTY knows the exact size after fonts loaded and layout settled
    setTimeout(() => {
        fitAddon.fit();
        window.termAPI.sendResize(term.cols, term.rows);
    }, 100);
    
    // Focus the hidden terminal's textarea so it can capture input
    const focusTerminal = () => {
        if (overlay.style.display === 'none') {
            term.focus();
        }
    };
    
    document.addEventListener('click', focusTerminal);
    document.addEventListener('keydown', focusTerminal);
    focusTerminal();
});

window.addEventListener('resize', () => {
    fitAddon.fit();
    window.termAPI.sendResize(term.cols, term.rows);
});

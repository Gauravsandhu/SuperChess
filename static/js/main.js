let selectedSquare = null;
let legalDestinations = [];
let gameState = null;

const gameId = typeof GAME_ID !== 'undefined' ? GAME_ID : null;

// ================= API HELPERS =================

async function fetchState() {
    if (!gameId) return null;
    const res = await fetch(`/api/state/${gameId}`);
    return res.json();
}

async function fetchLegalMoves(square) {
    if (!gameId) return [];
    const res = await fetch(`/api/legal-moves/${gameId}?square=${square}`);
    return res.json();
}

async function sendMove(from, to) {
    if (!gameId) return null;
    const res = await fetch(`/api/move/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to })
    });
    return res.json();
}

async function activatePowerup(powerupId) {
    const res = await fetch(`/api/powerup/activate/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ powerup_id: powerupId })
    });
    return res.json();
}

async function resolvePowerup(square) {
    const res = await fetch(`/api/powerup/resolve/${gameId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ square })
    });
    return res.json();
}

async function cancelPowerup() {
    const res = await fetch(`/api/powerup/cancel/${gameId}`, { method: 'POST' });
    return res.json();
}

async function rollDice() {
    const res = await fetch(`/api/roll-dice/${gameId}`, { method: 'POST' });
    return res.json();
}

async function requestAiMove() {
    const res = await fetch(`/api/ai-move/${gameId}`, { method: 'POST' });
    return res.json();
}

// ================= HELPERS =================

function getSquareName(index) {
    const files = ['a','b','c','d','e','f','g','h'];
    const rank = 8 - Math.floor(index / 8);
    const file = files[index % 8];
    return file + rank;
}

function getPieceImageSrc(pieceChar) {
    const isWhite = pieceChar === pieceChar.toUpperCase();
    const color = isWhite ? 'w' : 'b';
    const type = pieceChar.toUpperCase();
    return `/static/pieces/${color}${type}.svg`;
}

// ================= AI =================

function showAiThinking(visible) {
    let el = document.getElementById('ai-thinking');
    if (!el) {
        el = document.createElement('div');
        el.id = 'ai-thinking';
        el.className = 'ai-thinking';
        el.innerHTML = '🤖 Stockfish is thinking…';
        const statusEl = document.getElementById('status');
        statusEl.insertAdjacentElement('afterend', el);
    }
    el.style.display = visible ? 'block' : 'none';
}

async function triggerAiIfNeeded(state) {
    if (!state.vs_ai) return;
    if (state.turn !== state.ai_color) return;
    if (state.status !== 'active' && state.status !== 'check') return;

    showAiThinking(true);
    // Small delay so the human can see the board update before AI moves
    await new Promise(r => setTimeout(r, 500));

    const aiState = await requestAiMove();
    showAiThinking(false);

    if (aiState.error) {
        showNotification(`❌ ${aiState.error}`, '#e74c3c', 4000);
        return;
    }

    gameState = aiState;
    updateStatus(aiState);
    renderBoard(aiState.board, aiState);
    renderPowerupPanel(aiState);
    renderDicePanel(aiState);

    if (aiState.last_event?.type === 'ai_moved') {
        showNotification(
            `🤖 AI moved <strong>${aiState.last_event.from} → ${aiState.last_event.to}</strong>`,
            '#8e44ad', 2000
        );
    } else if (aiState.last_event?.type === 'ai_skipped') {
        showNotification(`🤖 AI has no valid moves — turn skipped!`, '#e67e22', 2500);
    }
}

// ================= STATUS =================

function updateStatus(state) {
    const statusEl = document.getElementById('status');
    let statusText = `Turn: <strong>${state.turn}</strong>`;

    // Show AI label when relevant
    if (state.vs_ai) {
        const humanColor = state.ai_color === 'black' ? 'white' : 'black';
        if (state.turn === state.ai_color) {
            statusText += ` <span class="ai-turn-label">(🤖 Computer)</span>`;
        } else {
            statusText += ` <span class="human-turn-label">(👤 You)</span>`;
        }
    }

    statusText += ' | ';

    if (state.status.includes('checkmate')) {
        statusEl.classList.add('status-checkmate');
        statusText += `<span class="status-checkmate">${state.status}</span>`;
    } else if (state.status === 'check') {
        statusEl.classList.add('status-check');
        statusEl.classList.remove('status-checkmate');
        statusText += `<span class="status-check">Check!</span>`;
    } else {
        statusEl.classList.remove('status-checkmate', 'status-check');
        statusText += state.status;
    }

    // Dice info in status bar
    const usesDice = state.mode_info?.uses_dice;
    if (usesDice) {
        if (state.dice_roll === null) {
            statusText += ` | 🎲 <em>Roll the dice to move!</em>`;
        } else {
            const pieceName = state.dice_piece_names?.[state.dice_roll] || state.dice_roll;
            statusText += ` | 🎲 Rolled <strong>${state.dice_roll}</strong> — Move a <strong>${pieceName}</strong>`;
        }
    }

    statusEl.innerHTML = statusText;

    const modeBadge = document.getElementById('mode-badge');
    if (modeBadge && state.mode_info) {
        modeBadge.textContent = state.mode_info.name;
    }
}

// ================= DICE PANEL =================

function renderDicePanel(state) {
    const usesDice = state.mode_info?.uses_dice;
    let panel = document.getElementById('dice-panel');

    if (!usesDice) {
        if (panel) panel.style.display = 'none';
        return;
    }

    if (!panel) {
        panel = document.createElement('div');
        panel.id = 'dice-panel';
        panel.className = 'dice-panel';
        const layout = document.querySelector('.game-layout');
        if (layout) layout.insertBefore(panel, layout.firstChild);
    }
    panel.style.display = 'flex';

    const roll = state.dice_roll;
    const pieceName = roll ? (state.dice_piece_names?.[roll] || roll) : null;
    const DICE_FACES = ['', '♟', '♞', '♝', '♜', '♛', '♚'];

    const needsRoll = roll === null;
    const turn = state.turn;
    const isAiTurn = state.vs_ai && state.turn === state.ai_color;

    panel.innerHTML = `
        <div class="dice-panel-title">🎲 Dice</div>
        <div class="dice-turn-label">${turn.charAt(0).toUpperCase() + turn.slice(1)}'s turn${isAiTurn ? ' 🤖' : ''}</div>
        <div class="dice-face ${needsRoll ? 'dice-waiting' : 'dice-rolled'}">${needsRoll ? '?' : DICE_FACES[roll]}</div>
        ${pieceName ? `<div class="dice-piece-label">Move a <strong>${pieceName}</strong></div>` : ''}
        ${needsRoll && !isAiTurn
            ? `<button class="dice-roll-btn" id="dice-roll-btn" onclick="doRollDice()">Roll Dice</button>`
            : needsRoll && isAiTurn
                ? `<div class="dice-hint">AI is rolling…</div>`
                : `<div class="dice-hint">${isAiTurn ? 'AI is choosing…' : `Select a ${pieceName} to move`}</div>`
        }
    `;
}

// ================= NOTIFICATION =================

function showNotification(text, color = '#f39c12', duration = 2800) {
    const existing = document.querySelector('.pu-notification');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'pu-notification';
    el.innerHTML = text;
    el.style.borderColor = color;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 400);
    }, duration);
}

function handleLastEvent(state) {
    const ev = state.last_event;
    if (!ev) return;

    const defs = state.powerup_defs || {};

    if (ev.type === 'powerup_awarded') {
        const pu = defs[ev.powerup];
        const who = ev.player.charAt(0).toUpperCase() + ev.player.slice(1);
        showNotification(`${pu?.icon || '✨'} <strong>${who}</strong> earned <strong>${pu?.name || ev.powerup}</strong>!`, pu?.color || '#f39c12');
    }
    if (ev.type === 'powerup_used') {
        const pu = defs[ev.powerup];
        const who = ev.player.charAt(0).toUpperCase() + ev.player.slice(1);
        showNotification(`${pu?.icon || '✨'} <strong>${who}</strong> used <strong>${pu?.name || ev.powerup}</strong>!`, pu?.color || '#9b59b6');
    }
}

// ================= POWERUP PANEL =================

function renderPowerupPanel(state) {
    const panel = document.getElementById('powerup-panel');
    if (!panel) return;

    const uses = state.mode_info?.uses_powerups;
    panel.style.display = uses ? 'flex' : 'none';
    if (!uses) return;

    const defs = state.powerup_defs || {};
    const turn = state.turn;
    const hand = state.powerup_hands?.[turn] || [];
    const pending = state.pending_powerup;
    const isAiTurn = state.vs_ai && state.turn === state.ai_color;

    const banner = document.getElementById('pu-banner');
    if (pending) {
        let msg = '';
        if (pending.type === 'freeze') msg = `❄️ Click an <strong>enemy piece</strong> to freeze it`;
        else if (pending.type === 'shield') msg = `🛡️ Click <strong>your piece</strong> to shield it`;
        else if (pending.type === 'bomb') msg = `💣 Click an <strong>enemy piece</strong> to destroy it`;
        else if (pending.type === 'teleport' && pending.stage === 'select_target') msg = `🌀 Click <strong>your piece</strong> to teleport`;
        else if (pending.type === 'teleport' && pending.stage === 'select_destination') msg = `🌀 Click an <strong>empty square</strong> as the destination`;
        if (banner) {
            banner.innerHTML = msg + ` <button class="pu-cancel-btn" onclick="doCancelPowerup()">Cancel</button>`;
            banner.style.display = 'block';
        }
    } else {
        if (banner) banner.style.display = 'none';
    }

    const handEl = document.getElementById('pu-hand');
    if (!handEl) return;
    handEl.innerHTML = '';

    // Update the panel title to show whose turn it is
    const titleEl = panel.querySelector('.pu-panel-title');
    if (titleEl) {
        titleEl.textContent = isAiTurn ? '⚡ AI Power-Ups' : '⚡ Power-Ups';
    }

    if (hand.length === 0) {
        handEl.innerHTML = `<div class="pu-empty">No power-ups yet.<br>Earn one every 3 moves!</div>`;
        return;
    }

    hand.forEach((puId) => {
        const pu = defs[puId] || { name: puId, icon: '?', description: '', color: '#888' };
        const card = document.createElement('div');
        card.className = 'pu-card';
        // Disable cards on AI's turn
        if (isAiTurn) card.classList.add('pu-card-disabled');
        card.style.setProperty('--pu-color', pu.color);
        card.innerHTML = `
            <div class="pu-icon">${pu.icon}</div>
            <div class="pu-name">${pu.name}</div>
            <div class="pu-desc">${pu.description}</div>
        `;
        if (!isAiTurn) {
            card.addEventListener('click', () => doActivatePowerup(puId));
        }
        handEl.appendChild(card);
    });
}

// ================= POWERUP ACTIONS =================

async function doRollDice() {
    const btn = document.getElementById('dice-roll-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Rolling…'; }
    const state = await rollDice();
    if (state.error) {
        showNotification(`❌ ${state.error}`, '#e74c3c', 2000);
        if (btn) { btn.disabled = false; btn.textContent = 'Roll Dice'; }
        return;
    }
    gameState = state;
    updateStatus(state);
    renderBoard(state.board, state);
    renderPowerupPanel(state);
    renderDicePanel(state);
    const pieceName = state.dice_piece_names?.[state.dice_roll] || state.dice_roll;
    showNotification(`🎲 Rolled <strong>${state.dice_roll}</strong> — Move a <strong>${pieceName}</strong>!`, '#e67e22', 2200);
}

async function doActivatePowerup(puId) {
    const state = await activatePowerup(puId);
    if (state.error) {
        showNotification(`❌ ${state.error}`, '#e74c3c', 2000);
        return;
    }
    gameState = state;
    updateStatus(state);
    renderBoard(state.board, state);
    renderPowerupPanel(state);
    renderDicePanel(state);
    handleLastEvent(state);
}

async function doCancelPowerup() {
    const state = await cancelPowerup();
    gameState = state;
    updateStatus(state);
    renderBoard(state.board, state);
    renderPowerupPanel(state);
    renderDicePanel(state);
}

// ================= FETCH + RENDER =================

async function fetchGameState() {
    const state = await fetchState();
    if (!state) return;
    gameState = state;
    updateStatus(state);
    renderBoard(state.board, state);
    renderPowerupPanel(state);
    renderDicePanel(state);
    await triggerAiIfNeeded(state);
}

function renderBoard(fen, state) {
    const boardDiv = document.getElementById('board');
    boardDiv.innerHTML = '';

    const ranks = fen.split(' ')[0].split('/');
    ranks.forEach((rank, rowIndex) => {
        for (let char of rank) {
            if (isNaN(char)) {
                createSquare(boardDiv, char, rowIndex, state);
            } else {
                for (let i = 0; i < parseInt(char); i++) {
                    createSquare(boardDiv, null, rowIndex, state);
                }
            }
        }
    });
}

// ================= BOARD =================

function createSquare(container, piece, rowIndex, state) {
    const square = document.createElement('div');
    square.className = 'square';

    const isBlack = (rowIndex + container.children.length) % 2 !== 0;
    square.classList.add(isBlack ? 'black-sq' : 'white-sq');

    const squareIndex = container.children.length;
    const squareName = getSquareName(squareIndex);
    square.dataset.square = squareName;

    if (state?.frozen_squares?.[squareName]) {
        square.classList.add('frozen-sq');
    }
    if (state?.shielded_squares?.[squareName]) {
        square.classList.add('shielded-sq');
    }

    if (piece) {
        const img = document.createElement('img');
        img.src = getPieceImageSrc(piece);
        img.className = 'piece';
        img.draggable = false;
        square.appendChild(img);

        if (state?.frozen_squares?.[squareName]) {
            const overlay = document.createElement('div');
            overlay.className = 'frozen-overlay';
            overlay.textContent = '❄️';
            square.appendChild(overlay);
        }
        if (state?.shielded_squares?.[squareName]) {
            const overlay = document.createElement('div');
            overlay.className = 'shield-overlay';
            overlay.textContent = '🛡️';
            square.appendChild(overlay);
        }
    }

    square.addEventListener('click', () => handleSquareClick(squareName));
    container.appendChild(square);
}

// ================= CLICK HANDLER =================

async function handleSquareClick(squareName) {
    const state = gameState;

    // Block clicks during AI's turn
    if (state?.vs_ai && state?.turn === state?.ai_color) return;

    // Block clicks when game is over
    if (state?.status && state.status !== 'active' && state.status !== 'check') return;

    // If a powerup is pending, resolve it
    if (state?.pending_powerup) {
        const result = await resolvePowerup(squareName);
        if (result.error) {
            showNotification(`❌ ${result.error}`, '#e74c3c', 2000);
            return;
        }
        gameState = result;
        updateStatus(result);
        renderBoard(result.board, result);
        renderPowerupPanel(result);
        renderDicePanel(result);
        handleLastEvent(result);
        return;
    }

    if (!selectedSquare) {
        const moves = await fetchLegalMoves(squareName);
        if (moves.length > 0) {
            selectedSquare = squareName;
            legalDestinations = moves;
            highlightSquares();
        }
    } else {
        if (legalDestinations.includes(squareName)) {
            const newState = await sendMove(selectedSquare, squareName);
            if (newState && !newState.error) {
                gameState = newState;
                updateStatus(newState);
                renderBoard(newState.board, newState);
                renderPowerupPanel(newState);
                renderDicePanel(newState);
                handleLastEvent(newState);
                selectedSquare = null;
                legalDestinations = [];
                removeHighlights();
                await triggerAiIfNeeded(newState);
            } else {
                selectedSquare = null;
                legalDestinations = [];
                removeHighlights();
            }
        } else {
            // Clicked a different square — try selecting it instead
            selectedSquare = null;
            legalDestinations = [];
            removeHighlights();
            const moves = await fetchLegalMoves(squareName);
            if (moves.length > 0) {
                selectedSquare = squareName;
                legalDestinations = moves;
                highlightSquares();
            }
        }
    }
}

// ================= HIGHLIGHTS =================

function highlightSquares() {
    removeHighlights();
    const selectedEl = document.querySelector(`[data-square="${selectedSquare}"]`);
    if (selectedEl) selectedEl.classList.add('selected');
    legalDestinations.forEach(sq => {
        const el = document.querySelector(`[data-square="${sq}"]`);
        if (el) el.classList.add('legal-move');
    });
}

function removeHighlights() {
    document.querySelectorAll('.square').forEach(sq => {
        sq.classList.remove('selected', 'legal-move');
    });
}

// ================= INIT =================

fetchGameState();
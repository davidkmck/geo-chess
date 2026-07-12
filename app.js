(function () {
    "use strict";

    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");

    let board = [];
    let turn = "w";
    let selected = null; 
    let legalTargets = []; 
    let gameOver = false;
    let gameOverText = "";

    // Camera Navigation States
    let zoomPreset = 1; 
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startMouseX = 0;
    let startMouseY = 0;
    let startPanX = 0;
    let startPanY = 0;

    // UI Configuration States
    let isFlipped = false;
    let hideAllUi = false; 
    let aiEnabled = true;  
    let aiDepth = 2;       
    let aiThinking = false;

    let history = [];
    let moveLog = [];
    let currentIndex = 0;

    const BACK_RANK_FILES = { 3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R" };

    const PIECE_SYMBOLS = {
        w: { P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔" },
        b: { P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚" }
    };

    const PIECE_VALUES = { P: 10, N: 30, B: 30, R: 50, Q: 90, K: 9000 };

    let lastMoveSource = null; 
    let lastMoveTarget = null; 

    // ---- Terrain sets ----
    // "default" is the original hand-authored layout. "alternative" is a left-right
    // mirror of it (keeps things balanced/fair while giving a different feel).
    // "none" is a flat, all-plain board (classic chess behavior).
    const TERRAIN_DEFAULT = [
        "pppppppppppppp", "pppppppppppppp", "pppppppppppppp",
        "ppMMFFpppppppp", "ppMMFFLLpppppp", "ppppppLLpppppp",
        "rrrfrrrppppppp", "pppppprrrrrrfr", "ppppppLLpppppp",
        "ppppppLLFFMMpp", "ppppppppFFMMpp", "pppppppppppppp",
        "pppppppppppppp", "pppppppppppppp"
    ];

    const TERRAIN_ALTERNATIVE = [
        "pppppppppppppp", "pppppppppppppp", "pppppppppppppp",
        "ppppppppFFMMpp", "ppppppLLFFMMpp", "ppppppLLpppppp",
        "ppppppprrrfrrr", "rfrrrrrrpppppp", "ppppppLLpppppp",
        "ppMMFFLLpppppp", "ppMMFFpppppppp", "pppppppppppppp",
        "pppppppppppppp", "pppppppppppppp"
    ];

    const TERRAIN_NONE = Array.from({ length: SIZE }, () => "p".repeat(SIZE));

    const TERRAIN_SETS = { default: TERRAIN_DEFAULT, alternative: TERRAIN_ALTERNATIVE, none: TERRAIN_NONE };
    let activeTerrainKey = "default";

    const CHAR_TO_TERRAIN = { 'p': "plain", 'M': "mountain", 'F': "forest", 'L': "lake", 'r': "river", 'f': "ford" };
    function terrain(r, f) { return CHAR_TO_TERRAIN[TERRAIN_SETS[activeTerrainKey][r][f]] || "plain"; }

    function isWater(t) { return t === "river" || t === "lake"; }
    function isForest(t) { return t === "forest"; }
    function isSlow(t) { return isWater(t); } 
    function isImpassable(t) { return t === "mountain"; } 
    function canCapture(tFrom, tTo) {
        if (isWater(tFrom) && !isWater(tTo)) return false;
        if (isWater(tFrom) && isWater(tTo)) return false; 
        if (!isForest(tFrom) && isForest(tTo)) return false;
        return true;
    }
    function isHomeRank(r) { return r <= 1 || r >= SIZE - 2; }

    function freshBoard() {
        const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        for (let f = 0; f < SIZE; f++) {
            if (BACK_RANK_FILES[f]) b[0][f] = { type: BACK_RANK_FILES[f], color: "b", moved: false };
            b[1][f] = { type: "P", color: "b", moved: false };
            b[SIZE - 2][f] = { type: "P", color: "w", moved: false };
            if (BACK_RANK_FILES[f]) b[SIZE - 1][f] = { type: BACK_RANK_FILES[f], color: "w", moved: false };
        }
        return b;
    }

    function cloneBoard(src) { return src.map(row => row.map(cell => cell ? { ...cell } : null)); }

    function saveState() {
        history = history.slice(0, currentIndex + 1);
        moveLog = moveLog.slice(0, currentIndex);
        history.push({
            board: cloneBoard(board), turn: turn, gameOver: gameOver, gameOverText: gameOverText,
            lastMoveSource: lastMoveSource ? { ...lastMoveSource } : null,
            lastMoveTarget: lastMoveTarget ? { ...lastMoveTarget } : null
        });
        currentIndex = history.length - 1;
        updateUndoRedoButtons();
    }

    function getMoves(r, f, bMatrix) {
        const p = bMatrix[r][f];
        if (!p) return [];
        const moves = [];
        const tFrom = terrain(r, f);
        const directions = {
            R: [[1,0], [-1,0], [0,1], [0,-1]], B: [[1,1], [1,-1], [-1,1], [-1,-1]],
            Q: [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]],
            K: [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]],
            N: [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]]
        };

        if (p.type === "P") {
            const dir = p.color === "w" ? -1 : 1;
            const startRank = p.color === "w" ? SIZE - 2 : 1;
            const nr = r + dir;
            if (nr >= 0 && nr < SIZE) {
                if (!bMatrix[nr][f] && !isImpassable(terrain(nr, f))) {
                    moves.push({ r: nr, f: f });
                    const nnr = r + (2 * dir);
                    if (r === startRank && !isSlow(tFrom) && !isSlow(terrain(nr, f)) && !bMatrix[nnr][f] && !isImpassable(terrain(nnr, f))) {
                        moves.push({ r: nnr, f: f });
                    }
                }
            }
            [f - 1, f + 1].forEach(nf => {
                if (nf >= 0 && nf < SIZE) {
                    const tgtR = r + dir;
                    if (tgtR >= 0 && tgtR < SIZE) {
                        const targetPiece = bMatrix[tgtR][nf];
                        const tTo = terrain(tgtR, nf);
                        if (targetPiece && targetPiece.color !== p.color && !isImpassable(tTo)) {
                            if (canCapture(tFrom, tTo)) moves.push({ r: tgtR, f: nf });
                        }
                    }
                }
            });
        } 
        else if (["R", "B", "Q"].includes(p.type)) {
            directions[p.type].forEach(([dr, df]) => {
                let curR = r + dr, curF = f + df;
                const startingInWater = isWater(tFrom);
                while (curR >= 0 && curR < SIZE && curF >= 0 && curF < SIZE) {
                    const tTo = terrain(curR, curF);
                    if (isImpassable(tTo)) break;
                    const tgt = bMatrix[curR][curF];
                    if (!tgt) {
                        moves.push({ r: curR, f: curF });
                        if (startingInWater || isWater(tTo)) break;
                        if (isForest(tTo)) break; 
                    } else {
                        if (tgt.color !== p.color && canCapture(tFrom, tTo)) moves.push({ r: curR, f: curF });
                        break;
                    }
                    curR += dr; curF += df;
                }
            });
        }
        else if (["N", "K"].includes(p.type)) {
            directions[p.type].forEach(([dr, df]) => {
                const nr = r + dr, nf = f + df;
                if (nr >= 0 && nr < SIZE && nf >= 0 && nf < SIZE) {
                    const tTo = terrain(nr, nf);
                    if (!isImpassable(tTo)) {
                        const tgt = bMatrix[nr][nf];
                        if (!tgt || (tgt.color !== p.color && canCapture(tFrom, tTo))) moves.push({ r: nr, f: nf });
                    }
                }
            });
        }
        return moves;
    }

    function generateAllLegalMoves(color, bMatrix) {
        const list = [];
        for (let r = 0; r < SIZE; r++) for (let f = 0; f < SIZE; f++) {
            const p = bMatrix[r][f];
            if (p && p.color === color) getMoves(r, f, bMatrix).forEach(t => list.push({ from: { r, f }, to: t }));
        }
        return list;
    }

    function makeMove(from, to) {
        const p = board[from.r][from.f];
        const captured = board[to.r][to.f];
        moveLog.push(`${p.type}${FILES[from.f]}${from.r + 1}→${FILES[to.f]}${to.r + 1}`);
        board[to.r][to.f] = { ...p, moved: true };
        board[from.r][from.f] = null;
        lastMoveSource = { ...from }; lastMoveTarget = { ...to };
        if (captured && captured.type === "K") {
            gameOver = true; gameOverText = p.color === "w" ? "White Wins!" : "Black Wins!";
        }
        turn = turn === "w" ? "b" : "w"; selected = null; legalTargets = [];
        if (!gameOver && isCheckmate(turn, board)) {
            gameOver = true; gameOverText = turn === "w" ? "Black Wins by Checkmate!" : "White Wins by Checkmate!";
        }
        saveState(); render();
        if (!gameOver && aiEnabled && turn === "b") triggerAIAsyncExecution();
    }

    function evaluateBoard(bMatrix) {
        let score = 0;
        for (let r = 0; r < SIZE; r++) for (let f = 0; f < SIZE; f++) {
            const p = bMatrix[r][f];
            if (p) {
                let val = PIECE_VALUES[p.type] || 0;
                score += (p.color === "w" ? val : -val);
            }
        }
        return score;
    }

    function minimax(bMatrix, depth, alpha, beta, isMaximizing) {
        if (depth === 0) return { score: evaluateBoard(bMatrix) };
        const moves = generateAllLegalMoves(isMaximizing ? "w" : "b", bMatrix);
        if (moves.length === 0) return { score: evaluateBoard(bMatrix) };
        let bestMove = null;
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;
                const scoreEval = minimax(nextBoard, depth - 1, alpha, beta, false).score;
                if (scoreEval > maxEval) { maxEval = scoreEval; bestMove = move; }
                alpha = Math.max(alpha, scoreEval); if (beta <= alpha) break; 
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;
                const scoreEval = minimax(nextBoard, depth - 1, alpha, beta, true).score;
                if (scoreEval < minEval) { minEval = scoreEval; bestMove = move; }
                beta = Math.min(beta, scoreEval); if (beta <= alpha) break; 
            }
            return { score: minEval, move: bestMove };
        }
    }

    function triggerAIAsyncExecution() {
        if (gameOver) return;
        aiThinking = true; setThinkingIndicatorVisibility(true);
        setTimeout(() => {
            const decision = minimax(board, aiDepth, -Infinity, Infinity, false);
            aiThinking = false; setThinkingIndicatorVisibility(false);
            if (decision && decision.move) makeMove(decision.move.from, decision.move.to);
        }, 50);
    }

    // ---- Camera: zoom + pan ----
    function currentScale() { return [1.0, 1.75, 3.5][zoomPreset - 1] || 1.0; }

    function clampPan() {
        const scale = currentScale();
        if (scale <= 1) { panX = 0; panY = 0; return; }
        // translate() is applied before scale() in "scale(s) translate(x,y)", so the
        // on-screen displacement of a translate unit is (unit * s). Keep the scaled
        // board covering the 600x600 viewport by bounding the translate accordingly.
        const boardPx = 600;
        const maxOffset = ((scale - 1) * boardPx) / (2 * scale);
        panX = Math.max(-maxOffset, Math.min(maxOffset, panX));
        panY = Math.max(-maxOffset, Math.min(maxOffset, panY));
    }

    function updateCameraMatrix() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        clampPan();
        const scaleFactor = currentScale();
        boardEl.style.transform = `scale(${scaleFactor}) translate(${panX}px, ${panY}px)`;
        updateMinimapViewportIndicator(scaleFactor);
    }

    function updateMinimapViewportIndicator(scale) {
        const vp = document.getElementById("mini-viewport");
        if (!vp) return;
        const pct = (1 / scale) * 100;
        vp.style.width = `${pct}%`; vp.style.height = `${pct}%`;
        // Position the viewport box to reflect current pan (approximate, center-based)
        const miniPx = 100; // mini-map is 100x100
        const offsetPxX = scale > 1 ? (-panX / (600 / miniPx)) : 0;
        const offsetPxY = scale > 1 ? (-panY / (600 / miniPx)) : 0;
        vp.style.left = `calc(50% - ${pct / 2}% - ${offsetPxX}px)`;
        vp.style.top = `calc(50% - ${pct / 2}% - ${offsetPxY}px)`;
    }

    function setupPanning() {
        const boardOuter = document.getElementById("board-outer");
        if (!boardOuter) return;

        function beginPan(clientX, clientY, targetEl) {
            if (currentScale() <= 1) return false;
            if (targetEl && targetEl.classList && targetEl.classList.contains("piece")) return false;
            isPanning = true;
            startMouseX = clientX; startMouseY = clientY;
            startPanX = panX; startPanY = panY;
            boardOuter.classList.add("panning");
            return true;
        }
        function movePan(clientX, clientY) {
            if (!isPanning) return;
            const scale = currentScale();
            panX = startPanX + (clientX - startMouseX) / scale;
            panY = startPanY + (clientY - startMouseY) / scale;
            updateCameraMatrix();
        }
        function endPan() {
            isPanning = false;
            boardOuter.classList.remove("panning");
        }

        boardOuter.addEventListener("mousedown", (e) => {
            if (beginPan(e.clientX, e.clientY, e.target)) e.preventDefault();
        });
        window.addEventListener("mousemove", (e) => movePan(e.clientX, e.clientY));
        window.addEventListener("mouseup", endPan);

        boardOuter.addEventListener("touchstart", (e) => {
            const t = e.touches[0];
            if (beginPan(t.clientX, t.clientY, e.target)) e.preventDefault();
        }, { passive: false });
        boardOuter.addEventListener("touchmove", (e) => {
            if (!isPanning) return;
            const t = e.touches[0];
            movePan(t.clientX, t.clientY);
            e.preventDefault();
        }, { passive: false });
        boardOuter.addEventListener("touchend", endPan);
    }

    function render() {
        const container = document.getElementById("board");
        if (!container) return;
        container.innerHTML = "";
        const loopOrder = isFlipped ? Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i) : Array.from({ length: SIZE }, (_, i) => i);

        loopOrder.forEach(r => {
            for (let f = 0; f < SIZE; f++) {
                const cellEl = document.createElement("div");
                const t = terrain(r, f);
                cellEl.className = `cell ${(r + f) % 2 === 0 ? "light" : "dark"} terrain-${t}`;
                if (selected && selected.r === r && selected.f === f) cellEl.classList.add("selected");
                if (legalTargets.some(m => m.r === r && m.f === f)) cellEl.classList.add("legal-target");

                const p = board[r][f];
                if (p) {
                    const pieceEl = document.createElement("span");
                    pieceEl.className = `piece ${p.color === "w" ? "white" : "black"}`;
                    pieceEl.textContent = PIECE_SYMBOLS[p.color][p.type];
                    pieceEl.draggable = !gameOver && (!aiEnabled || turn === "w") && p.color === turn;
                    pieceEl.addEventListener("dragstart", (e) => {
                        selected = { r, f };
                        legalTargets = getMoves(r, f, board);
                        e.dataTransfer.setData("text/plain", JSON.stringify({ r, f }));
                        e.dataTransfer.effectAllowed = "move";
                    });
                    pieceEl.addEventListener("dragend", () => { selected = null; legalTargets = []; render(); });
                    cellEl.appendChild(pieceEl);
                }

                cellEl.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; });
                cellEl.addEventListener("drop", (e) => {
                    e.preventDefault();
                    let from;
                    try { from = JSON.parse(e.dataTransfer.getData("text/plain")); } catch (err) { from = selected; }
                    if (from) handleDrop(from, { r, f });
                });

                cellEl.addEventListener("click", () => handleSquareClick(r, f));
                container.appendChild(cellEl);
            }
        });
        updateModalScreenState();
        syncTurnIndicators();
        renderMoveLog();
        updateTerrainLockState();
    }

    function handleDrop(from, to) {
        if (gameOver || aiThinking || (aiEnabled && turn === "b")) return;
        const p = board[from.r] && board[from.r][from.f];
        if (!p || p.color !== turn) return;
        const moves = getMoves(from.r, from.f, board);
        if (moves.some(m => m.r === to.r && m.f === to.f)) makeMove(from, to);
        else { selected = null; legalTargets = []; render(); }
    }

    function renderLabels() {
        const ranks = document.getElementById("ranks-labels"), files = document.getElementById("files-labels");
        if (!ranks || !files) return;
        ranks.innerHTML = ""; files.innerHTML = "";
        Array.from({ length: SIZE }, (_, i) => i + 1).forEach(r => { const d = document.createElement("div"); d.textContent = r; ranks.appendChild(d); });
        FILES.forEach(f => { const d = document.createElement("div"); d.textContent = f.toUpperCase(); files.appendChild(d); });
    }

    function renderMoveLog() {
        const list = document.getElementById("move-log-list");
        if (!list) return;
        list.innerHTML = "";
        moveLog.forEach((m, i) => { const li = document.createElement("li"); li.textContent = `${i + 1}. ${m}`; list.appendChild(li); });
    }

    function updateModalScreenState() {
        const overlay = document.getElementById("win-overlay");
        if (overlay) overlay.classList.toggle("hidden", !gameOver);
        if (gameOver) {
            const title = document.getElementById("win-title");
            if (title) title.textContent = gameOverText;
        }
    }

    function syncTurnIndicators() {
        const wNode = document.getElementById("node-w"), bNode = document.getElementById("node-b");
        if (!wNode || !bNode) return;
        wNode.classList.toggle("active-glow", turn === "w");
        bNode.classList.toggle("active-glow", turn === "b");
    }

    function setThinkingIndicatorVisibility(v) {
        document.getElementById("ai-thinking")?.classList.toggle("hidden", !v);
    }

    function updateUndoRedoButtons() {
        const undoBtn = document.getElementById("btn-undo");
        if (undoBtn) undoBtn.disabled = currentIndex <= 0;
        const redoBtn = document.getElementById("btn-redo");
        if (redoBtn) redoBtn.disabled = currentIndex >= history.length - 1;
    }

    // Lock the terrain selector once any move has been made this game.
    function updateTerrainLockState() {
        const sel = document.getElementById("terrain-select");
        if (sel) sel.disabled = moveLog.length > 0;
    }

    function handleSquareClick(r, f) {
        if (gameOver || aiThinking || (aiEnabled && turn === "b")) return;
        if (selected && legalTargets.some(t => t.r === r && t.f === f)) makeMove(selected, {r, f});
        else if (board[r][f] && board[r][f].color === turn) { selected = {r, f}; legalTargets = getMoves(r, f, board); render(); }
        else { selected = null; legalTargets = []; render(); }
    }

    function isSquareAttacked(r, f, color, bMatrix) {
        const enemy = color === "w" ? "b" : "w";
        for (let row = 0; row < SIZE; row++) for (let file = 0; file < SIZE; file++) {
            if (bMatrix[row][file] && bMatrix[row][file].color === enemy && getMoves(row, file, bMatrix).some(m => m.r === r && m.f === f)) return true;
        }
        return false;
    }

    function isCheckmate(color, bMatrix) {
        let king = null;
        for(let r=0; r<SIZE; r++) for(let f=0; f<SIZE; f++) if(bMatrix[r][f] && bMatrix[r][f].type === "K" && bMatrix[r][f].color === color) king = {r, f};
        if(!king || !isSquareAttacked(king.r, king.f, color, bMatrix)) return false;
        return generateAllLegalMoves(color, bMatrix).every(m => {
            const nb = cloneBoard(bMatrix);
            nb[m.to.r][m.to.f] = nb[m.from.r][m.from.f]; nb[m.from.r][m.from.f] = null;
            let nk = null;
            for(let r=0; r<SIZE; r++) for(let f=0; f<SIZE; f++) if(nb[r][f] && nb[r][f].type === "K" && nb[r][f].color === color) nk = {r, f};
            return isSquareAttacked(nk.r, nk.f, color, nb);
        });
    }

    function resetGame() {
        board = freshBoard();
        turn = "w"; history = []; moveLog = []; currentIndex = 0;
        gameOver = false; gameOverText = "";
        selected = null; legalTargets = [];
        panX = 0; panY = 0; zoomPreset = 1;
        const zoomSlider = document.getElementById("zoom-slider");
        if (zoomSlider) zoomSlider.value = 1;
        saveState(); render(); updateCameraMatrix();
    }

    function setupControlLayoutListeners() {
        document.getElementById("btn-reset")?.addEventListener("click", resetGame);
        document.getElementById("btn-another-match")?.addEventListener("click", resetGame);
        document.getElementById("btn-flip")?.addEventListener("click", () => { isFlipped = !isFlipped; render(); });
        document.getElementById("btn-zen")?.addEventListener("click", () => document.body.classList.toggle("zen-active"));
        document.getElementById("ai-toggle")?.addEventListener("change", (e) => { aiEnabled = e.target.checked; });
        document.getElementById("ai-depth-select")?.addEventListener("change", (e) => { aiDepth = parseInt(e.target.value, 10) || 2; });
        document.getElementById("zoom-slider")?.addEventListener("input", (e) => { zoomPreset = parseInt(e.target.value); updateCameraMatrix(); });
        document.getElementById("terrain-select")?.addEventListener("change", (e) => {
            if (moveLog.length > 0) { e.target.value = activeTerrainKey; return; } // safety net, select is also disabled
            activeTerrainKey = e.target.value;
            render();
        });
    }

    function init() {
        board = freshBoard();
        const depthSel = document.getElementById("ai-depth-select");
        if (depthSel) aiDepth = parseInt(depthSel.value, 10) || 2;
        setupControlLayoutListeners();
        setupPanning();
        renderLabels();
        render();
        updateCameraMatrix();
    }
    document.addEventListener("DOMContentLoaded", init);
})();

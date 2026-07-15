(function () {
    "use strict";

    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");
    const PIECE_SYMBOLS = { w: { P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔" }, b: { P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚" } };
    const PIECE_VALUES = { P: 10, N: 30, B: 30, R: 50, Q: 90, K: 9000 };

    let board = [], turn = "w", selected = null, legalTargets = [], gameOver = false, gameOverText = "", currentTerrain = 'default';
    let lastMoveSource = null, lastMoveTarget = null;
    
    // History & Move Log Variables
    let history = [], moveLog = [], currentIndex = 0;

    // Camera Variables
    let zoomPreset = 1, panX = 0, panY = 0, startMouseX = 0, startMouseY = 0, startPanX = 0, startPanY = 0, isPanning = false;
    let isFlipped = false, aiEnabled = true, aiDepth = 2, aiThinking = false;

    const TERRAIN_PRESETS = {
        default: ["pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "ppMMFFpppppppp", "ppMMFFLLpppppp", "ppppppLLpppppp", "rrrfrrrppppppp", "pppppprrrrrrfr", "ppppppLLpppppp", "ppppppLLFFMMpp", "ppppppppFFMMpp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp"],
        alternative: ["pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "ppppFFrrpppppp", "ppMMppppppMMpp", "ppMMppppppMMpp", "ppMMppppppMMpp", "ppMMppppppMMpp", "pppprrFFpppppp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp"],
        none: Array(14).fill("pppppppppppppp")
    };

    function terrain(r, f) {
        const char = TERRAIN_PRESETS[currentTerrain][r][f];
        const map = { 'p': "plain", 'M': "mountain", 'F': "forest", 'L': "lake", 'r': "river", 'f': "ford" };
        return map[char] || "plain";
    }

    function isImpassable(t) { return t === "mountain"; }
    function isWater(t) { return t === "river" || t === "lake"; }
    function isForest(t) { return t === "forest"; }
    function canCapture(tFrom, tTo) {
        if (isWater(tFrom) && !isWater(tTo)) return false;
        if (isWater(tFrom) && isWater(tTo)) return false;
        if (!isForest(tFrom) && isForest(tTo)) return false;
        return true;
    }

    // NEW: Dynamic Board Generator
    function freshBoard() {
        const whiteStart = document.getElementById("white-start-select")?.value || "topos";
        const blackStart = document.getElementById("black-start-select")?.value || "topos";
        
        const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));

        const coreBackRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
        const toposBackRank = ['P', 'P', 'P', 'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R', 'P', 'P', 'P'];

        // DEPLOY BLACK
        if (blackStart === "classic") {
            for (let x = 0; x < 8; x++) {
                b[3][x + 3] = { type: coreBackRank[x], color: "b", moved: false };
                b[4][x + 3] = { type: "P", color: "b", moved: false };
            }
        } else {
            for (let x = 0; x < 14; x++) {
                b[0][x] = { type: toposBackRank[x], color: "b", moved: false };
                b[1][x] = { type: "P", color: "b", moved: false };
            }
        }

        // DEPLOY WHITE
        if (whiteStart === "classic") {
            for (let x = 0; x < 8; x++) {
                b[10][x + 3] = { type: coreBackRank[x], color: "w", moved: false };
                b[9][x + 3] = { type: "P", color: "w", moved: false };
            }
        } else {
            for (let x = 0; x < 14; x++) {
                b[13][x] = { type: toposBackRank[x], color: "w", moved: false };
                b[12][x] = { type: "P", color: "w", moved: false };
            }
        }

        return b;
    }

    function cloneBoard(src) { return src.map(row => row.map(cell => cell ? { ...cell } : null)); }

    // History Management
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

    function jumpToTimelineIndex(idx) {
        if (idx < 0 || idx >= history.length) return;
        currentIndex = idx;
        const stateData = history[currentIndex];
        board = cloneBoard(stateData.board);
        turn = stateData.turn; gameOver = stateData.gameOver; gameOverText = stateData.gameOverText;
        lastMoveSource = stateData.lastMoveSource ? { ...stateData.lastMoveSource } : null;
        lastMoveTarget = stateData.lastMoveTarget ? { ...stateData.lastMoveTarget } : null;
        selected = null; legalTargets = [];
        updateUndoRedoButtons(); render();
        if (!gameOver && aiEnabled && turn === "b") triggerAI();
    }

    function updateUndoRedoButtons() {
        const btnUndo = document.getElementById("btn-undo");
        const btnRedo = document.getElementById("btn-redo");
        if (btnUndo) btnUndo.disabled = currentIndex <= 0;
        if (btnRedo) btnRedo.disabled = currentIndex >= history.length - 1;
    }

    function getMoves(r, f, bMatrix) {
        const p = bMatrix[r][f];
        if (!p) return [];
        const moves = [], tFrom = terrain(r, f);
        const D = { R: [[1,0], [-1,0], [0,1], [0,-1]], B: [[1,1], [1,-1], [-1,1], [-1,-1]], Q: [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]], K: [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]], N: [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]] };

        if (p.type === "P") {
            const dir = p.color === "w" ? -1 : 1;
            const nr = r + dir;
            if (nr >= 0 && nr < SIZE && !bMatrix[nr][f] && !isImpassable(terrain(nr, f))) {
                moves.push({ r: nr, f: f });
                // FIX: Pawn double-move now strictly checks if the piece has moved, not its row.
                if (!p.moved && !bMatrix[r + (2 * dir)][f] && !isImpassable(terrain(r + (2 * dir), f))) {
                    moves.push({ r: r + (2 * dir), f: f });
                }
            }
            [f - 1, f + 1].forEach(nf => {
                if (nf >= 0 && nf < SIZE && r + dir >= 0 && r + dir < SIZE) {
                    const tTo = terrain(r + dir, nf), tgt = bMatrix[r + dir][nf];
                    if (tgt && tgt.color !== p.color && !isImpassable(tTo) && canCapture(tFrom, tTo)) moves.push({ r: r + dir, f: nf });
                }
            });
        } else if (["R", "B", "Q"].includes(p.type)) {
            D[p.type].forEach(([dr, df]) => {
                let cr = r + dr, cf = f + df;
                while (cr >= 0 && cr < SIZE && cf >= 0 && cf < SIZE) {
                    const tTo = terrain(cr, cf);
                    if (isImpassable(tTo)) break;
                    const tgt = bMatrix[cr][cf];
                    if (!tgt) { moves.push({ r: cr, f: cf }); if (isWater(tFrom) || isWater(tTo) || isForest(tTo)) break; }
                    else { if (tgt.color !== p.color && canCapture(tFrom, tTo)) moves.push({ r: cr, f: cf }); break; }
                    cr += dr; cf += df;
                }
            });
        } else if (["N", "K"].includes(p.type)) {
            D[p.type].forEach(([dr, df]) => {
                const nr = r + dr, nf = f + df;
                if (nr >= 0 && nr < SIZE && nf >= 0 && nf < SIZE && !isImpassable(terrain(nr, nf))) {
                    const tgt = bMatrix[nr][nf];
                    if (!tgt || (tgt.color !== p.color && canCapture(tFrom, terrain(nr, nf)))) moves.push({ r: nr, f: nf });
                }
            });
        }
        return moves;
    }

    function generateAllLegalMoves(color, bMatrix) {
        const list = [];
        for (let r = 0; r < SIZE; r++) for (let f = 0; f < SIZE; f++) if (bMatrix[r][f] && bMatrix[r][f].color === color) getMoves(r, f, bMatrix).forEach(t => list.push({ from: { r, f }, to: t }));
        return list;
    }

    function isSquareAttacked(r, f, color, bMatrix) {
        const enemyColor = color === "w" ? "b" : "w";
        for (let row = 0; row < SIZE; row++) {
            for (let file = 0; file < SIZE; file++) {
                const p = bMatrix[row][file];
                if (p && p.color === enemyColor) {
                    const moves = getMoves(row, file, bMatrix);
                    if (moves.some(m => m.r === r && m.f === f)) return true;
                }
            }
        }
        return false;
    }

    function isCheckmate(color, bMatrix) {
        let kingPos = null;
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (p && p.type === "K" && p.color === color) {
                    kingPos = { r, f };
                    break;
                }
            }
        }
        
        if (!kingPos) return false;
        if (!isSquareAttacked(kingPos.r, kingPos.f, color, bMatrix)) return false;

        const allMoves = generateAllLegalMoves(color, bMatrix);
        for (const move of allMoves) {
            const nextBoard = cloneBoard(bMatrix);
            nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
            nextBoard[move.from.r][move.from.f] = null;
            
            let nextKingPos = null;
            for (let r = 0; r < SIZE; r++) {
                for (let f = 0; f < SIZE; f++) {
                    if (nextBoard[r][f] && nextBoard[r][f].type === "K" && nextBoard[r][f].color === color) {
                        nextKingPos = { r, f };
                    }
                }
            }
            if (nextKingPos && !isSquareAttacked(nextKingPos.r, nextKingPos.f, color, nextBoard)) {
                return false; 
            }
        }
        return true; 
    }

    function makeMove(from, to) {
        const p = board[from.r][from.f];
        const captured = board[to.r][to.f];
        
        // Log Move
        moveLog.push(`${p.type}${FILES[from.f]}${from.r + 1}→${FILES[to.f]}${to.r + 1}`);

        board[to.r][to.f] = { ...p, moved: true };
        board[from.r][from.f] = null;
        
        lastMoveSource = { ...from };
        lastMoveTarget = { ...to };
        
        if (captured && captured.type === "K") {
            gameOver = true;
            gameOverText = p.color === "w" ? "White Wins by Regicide!" : "Black Wins by Regicide!";
            saveState();
            render();
            return;
        }

        turn = turn === "w" ? "b" : "w"; selected = null; legalTargets = []; 
        
        if (isCheckmate(turn, board)) {
            gameOver = true;
            gameOverText = turn === "w" ? "Black Wins by Checkmate!" : "White Wins by Checkmate!";
        }

        saveState();
        render();
        if (aiEnabled && turn === "b" && !gameOver) triggerAI();
    }

    function triggerAI() {
        if (gameOver) return;
        aiThinking = true;
        setTimeout(() => {
            if (typeof AI !== 'undefined') {
                const res = AI.minimax(board, aiDepth, -Infinity, Infinity, false, PIECE_VALUES, generateAllLegalMoves, cloneBoard, isSquareAttacked);
                aiThinking = false;
                if (res && res.move) makeMove(res.move.from, res.move.to);
            }
        }, 50);
    }

    // Camera Application Engine
    function applyCameraTransform() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        const scales = [1, 1.75, 3.5];
        boardEl.style.transform = `scale(${scales[zoomPreset - 1]}) translate(${panX}px, ${panY}px)`;
    }

    function setupPanning() {
        const outer = document.getElementById("board-outer");
        if (!outer) return;

        outer.addEventListener("pointerdown", (e) => {
            if (zoomPreset === 1) return;
            isPanning = true;
            startMouseX = e.clientX;
            startMouseY = e.clientY;
            startPanX = panX;
            startPanY = panY;
            outer.setPointerCapture(e.pointerId);
        });

        outer.addEventListener("pointermove", (e) => {
            if (!isPanning) return;
            const scales = [1, 1.75, 3.5];
            const scaleFactor = scales[zoomPreset - 1] || 1.0;

            panX = startPanX + (e.clientX - startMouseX) / scaleFactor;
            panY = startPanY + (e.clientY - startMouseY) / scaleFactor;

            const w = outer.offsetWidth;
            const h = outer.offsetHeight;
            const maxTranslateX = (w * scaleFactor - w) / scaleFactor;
            const maxTranslateY = (h * scaleFactor - h) / scaleFactor;

            panX = Math.min(0, Math.max(-maxTranslateX, panX));
            panY = Math.min(0, Math.max(-maxTranslateY, panY));

            applyCameraTransform();
        });

        outer.addEventListener("pointerup", (e) => {
            isPanning = false;
            outer.releasePointerCapture(e.pointerId);
        });

        outer.addEventListener("pointercancel", () => {
            isPanning = false;
        });
    }

    // UI Renderers
    function renderMoveLog() {
        const listEl = document.getElementById("move-log-list");
        if (!listEl) return;
        
        let copyBtn = document.getElementById("copy-history-btn");
        if (!copyBtn) {
            copyBtn = document.createElement("button");
            copyBtn.id = "copy-history-btn";
            copyBtn.className = "btn-ghost"; 
            copyBtn.textContent = "📋 Copy History";
            copyBtn.addEventListener("click", () => {
                const historyText = moveLog.map((move, idx) => `${idx + 1}. ${move}`).join('\n');
                navigator.clipboard.writeText(historyText).catch(err => console.error('Failed to copy: ', err));
            });
            listEl.parentNode.insertBefore(copyBtn, listEl); 
        }

        listEl.innerHTML = "";
        moveLog.forEach((move, idx) => {
            const li = document.createElement("li");
            li.textContent = `${idx + 1}. ${move}`;
            li.style.cursor = "pointer";
            if (idx === currentIndex - 1) li.style.fontWeight = "bold"; 
            li.addEventListener("click", () => jumpToTimelineIndex(idx + 1));
            listEl.appendChild(li);
        });
    }

    function render() {
        const container = document.getElementById("board");
        if (!container) return;
        container.innerHTML = "";
        applyCameraTransform();
        
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cell = document.createElement("div");
                cell.className = `cell ${(r + f) % 2 === 0 ? 'light' : 'dark'} terrain-${terrain(r, f)}`;
                
                // Highlight last move targets
                if (lastMoveSource && lastMoveSource.r === r && lastMoveSource.f === f) cell.classList.add("last-move-source");
                if (lastMoveTarget && lastMoveTarget.r === r && lastMoveTarget.f === f) cell.classList.add("last-move-target");

                if (selected && selected.r === r && selected.f === f) {
                    cell.classList.add("selected");
                }
                
                if (legalTargets.some(t => t.r === r && t.f === f)) {
                    const hasEnemy = board[r][f] && board[r][f].color !== turn;
                    cell.classList.add(hasEnemy ? "legal-capture" : "legal-move");
                }

                const p = board[r][f];
                if (p) {
                    const piece = document.createElement("span");
                    piece.className = `piece ${p.color === 'w' ? 'white' : 'black'}`;
                    piece.textContent = PIECE_SYMBOLS[p.color][p.type];
                    cell.appendChild(piece);
                }
                
                cell.onclick = () => {
                    if (gameOver || aiThinking || (aiEnabled && turn === "b")) return;
                    if (selected && legalTargets.some(t => t.r === r && t.f === f)) {
                        makeMove(selected, {r, f});
                    } else if (board[r][f] && board[r][f].color === turn) { 
                        selected = {r, f}; 
                        legalTargets = getMoves(r, f, board); 
                        render(); 
                    } else {
                        selected = null;
                        legalTargets = [];
                        render();
                    }
                };
                container.appendChild(cell);
            }
        }
        
        const nodeW = document.getElementById("node-w");
        const nodeB = document.getElementById("node-b");
        if (nodeW && nodeB) {
            nodeW.classList.toggle("active-glow", turn === 'w');
            nodeB.classList.toggle("active-glow", turn === 'b');
        }

        const overlay = document.getElementById("win-overlay");
        const winTitle = document.getElementById("win-title");
        if (overlay && winTitle) {
            if (gameOver) {
                winTitle.textContent = gameOverText;
                overlay.classList.remove("hidden");
            } else {
                overlay.classList.add("hidden");
            }
        }

        renderMoveLog();
    }

    function init() {
        board = freshBoard();
        setupPanning();
        
        document.getElementById("zoom-slider")?.addEventListener("input", (e) => { 
            zoomPreset = parseInt(e.target.value); 
            panX = 0; panY = 0; 
            render(); 
        });
        document.getElementById("btn-reset")?.addEventListener("click", () => { 
            board = freshBoard(); turn = "w"; selected = null; legalTargets = []; gameOver = false;
            lastMoveSource = null; lastMoveTarget = null; history = []; moveLog = [];
            saveState(); render(); 
        });
        document.getElementById("btn-undo")?.addEventListener("click", () => { if (currentIndex > 0) jumpToTimelineIndex(currentIndex - 1); });
        document.getElementById("btn-redo")?.addEventListener("click", () => { if (currentIndex < history.length - 1) jumpToTimelineIndex(currentIndex + 1); });
        
        document.getElementById("btn-another-match")?.addEventListener("click", () => { document.getElementById("btn-reset").click(); });
        
        // Toggle Zen Mode (Maximizes board, hides menus)
        document.getElementById("btn-zen")?.addEventListener("click", () => {
            document.body.classList.toggle("zen-active");
            
            const zenBtn = document.getElementById("btn-zen");
            if (document.body.classList.contains("zen-active")) {
                zenBtn.innerHTML = "❌ Exit Zen";
            } else {
                zenBtn.innerHTML = "👁️ Zen";
            }
        });

        document.getElementById("terrain-select")?.addEventListener("change", (e) => { currentTerrain = e.target.value; document.getElementById("btn-reset").click(); });
        document.getElementById("ai-toggle")?.addEventListener("change", (e) => { aiEnabled = e.target.checked; if (aiEnabled && turn === "b" && !gameOver) triggerAI(); });
        document.getElementById("ai-depth-select")?.addEventListener("change", (e) => { aiDepth = parseInt(e.target.value); });

        // NEW: Reload the board immediately if a player changes their deployment style
        document.getElementById("white-start-select")?.addEventListener("change", () => {
            document.getElementById("btn-reset").click();
        });
        document.getElementById("black-start-select")?.addEventListener("change", () => {
            document.getElementById("btn-reset").click();
        });
        
        saveState();
        render();
    }
    
    document.addEventListener("DOMContentLoaded", init);
})();

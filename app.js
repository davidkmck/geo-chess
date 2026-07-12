(function () {  // 6:46, 6:37 2026-07-11
    "use strict";

    // ==========================================================================
    // 1. Core Config & Global State Matrix
    // ==========================================================================
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

    const BACK_RANK_FILES = {
        3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R"
    };

    const PIECE_SYMBOLS = {
        w: { P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔" },
        b: { P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚" }
    };

    const PIECE_VALUES = { P: 10, N: 30, B: 30, R: 50, Q: 90, K: 9000 };

    let lastMoveSource = null; 
    let lastMoveTarget = null; 

    // ==========================================================================
    // 2. Visual Terrain Biome Designer
    // ==========================================================================
    const TERRAIN_LAYOUT = [
        "pppppppppppppp", // 0
        "pppppppppppppp", // 1
        "pppppppppppppp", // 2
        "ppMMFFpppppppp", // 3 
        "ppMMFFLLpppppp", // 4 
        "ppppppLLpppppp", // 5 
        "rrrfrrrppppppp", // 6 
        "pppppprrrrrrfr", // 7 
        "ppppppLLpppppp", // 8 
        "ppppppLLFFMMpp", // 9 
        "ppppppppFFMMpp", // 10
        "pppppppppppppp", // 11
        "pppppppppppppp", // 12
        "pppppppppppppp"  // 13
    ];

    const CHAR_TO_TERRAIN = {
        'p': "plain", 'M': "mountain", 'F': "forest", 
        'L': "lake", 'r': "river", 'f': "ford"
    };

    function terrain(r, f) {
        return CHAR_TO_TERRAIN[TERRAIN_LAYOUT[r][f]] || "plain";
    }

    function isWater(t) { return t === "river" || t === "lake"; }
    function isForest(t) { return t === "forest"; }
    
    // REFINED: Water is slow, Forest is open territory
    function isSlow(t) { return isWater(t); } 
    function isImpassable(t) { return t === "mountain"; } 

    function canCapture(tFrom, tTo) {
        if (isWater(tFrom) && !isWater(tTo)) return false;
        if (isWater(tFrom) && isWater(tTo)) return false; 

        // FOREST COMBAT: Inside can attack Outside. Outside cannot attack Inside.
        if (!isForest(tFrom) && isForest(tTo)) return false;

        return true;
    }

    function isHomeRank(r) { return r <= 1 || r >= SIZE - 2; }

    // ==========================================================================
    // 3. Board Initialization & Deep Cloning Tools
    // ==========================================================================
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

    function cloneBoard(src) {
        return src.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    function saveState() {
        history = history.slice(0, currentIndex + 1);
        moveLog = moveLog.slice(0, currentIndex);
        history.push({
            board: cloneBoard(board),
            turn: turn,
            gameOver: gameOver,
            gameOverText: gameOverText,
            lastMoveSource: lastMoveSource ? { ...lastMoveSource } : null,
            lastMoveTarget: lastMoveTarget ? { ...lastMoveTarget } : null
        });
        currentIndex = history.length - 1;
        updateUndoRedoButtons();
    }

    // ==========================================================================
    // 4. Tactical Legal Movement Engines
    // ==========================================================================

    ////
    function getMoves(r, f, bMatrix) {
        const p = bMatrix[r][f];
        if (!p) return [];
        const moves = [];
        const tFrom = terrain(r, f);

        const directions = {
            R: [[1,0], [-1,0], [0,1], [0,-1]],
            B: [[1,1], [1,-1], [-1,1], [-1,-1]],
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
            const captureFiles = [f - 1, f + 1];
            captureFiles.forEach(nf => {
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
            const dirs = directions[p.type];
            dirs.forEach(([dr, df]) => {
                let curR = r + dr;
                let curF = f + df;
                const startingInWater = isWater(tFrom);

                while (curR >= 0 && curR < SIZE && curF >= 0 && curF < SIZE) {
                    const tTo = terrain(curR, curF);
                    if (isImpassable(tTo)) break;

                    const tgt = bMatrix[curR][curF];
                    if (!tgt) {
                        moves.push({ r: curR, f: curF });
                        // Rule: If starting in water OR moving into water, slide ends.
                        if (startingInWater || isWater(tTo)) break;
                        // Blockade: Stop sliding on forest.
                        if (isForest(tTo)) break; 
                    } else {
                        if (tgt.color !== p.color && canCapture(tFrom, tTo)) {
                            moves.push({ r: curR, f: curF });
                        }
                        break;
                    }
                    curR += dr; curF += df;
                }
            });
        }
        else if (["N", "K"].includes(p.type)) {
            const steps = directions[p.type];
            steps.forEach(([dr, df]) => {
                const nr = r + dr;
                const nf = f + df;
                if (nr >= 0 && nr < SIZE && nf >= 0 && nf < SIZE) {
                    const tTo = terrain(nr, nf);
                    if (!isImpassable(tTo)) {
                        const tgt = bMatrix[nr][nf];
                        if (!tgt || (tgt.color !== p.color && canCapture(tFrom, tTo))) {
                            moves.push({ r: nr, f: nf });
                        }
                    }
                }
            });
        }
        return moves;
    }


    function generateAllLegalMoves(color, bMatrix) {
        const list = [];
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (p && p.color === color) {
                    const targets = getMoves(r, f, bMatrix);
                    targets.forEach(t => {
                        list.push({ from: { r, f }, to: t });
                    });
                }
            }
        }
        return list;
    }

    // ==========================================================================
    // 5. Executive Execution & Turn Orchestration
    // ==========================================================================
///// ////
function makeMove(from, to) {
    const p = board[from.r][from.f];
    const captured = board[to.r][to.f];
    
    const moveNotation = `${p.type}${FILES[from.f]}${from.r + 1}→${FILES[to.f]}${to.r + 1}`;
    moveLog.push(moveNotation);

    board[to.r][to.f] = { ...p, moved: true };
    board[from.r][from.f] = null;

    lastMoveSource = { ...from };
    lastMoveTarget = { ...to };

    // 1. Immediate Win: Regicide
    if (captured && captured.type === "K") {
        gameOver = true;
        gameOverText = p.color === "w" ? "White Wins by Regicide!" : "Black Wins by Regicide!";
    }

    // 2. Identify the opponent before flipping the turn
    const opponentColor = turn === "w" ? "b" : "w";
    const activeColor = turn;

    // 3. Flip turn
    turn = opponentColor;
    selected = null;
    legalTargets = [];

    // 4. Check for checkmate on the opponent
    if (!gameOver && isCheckmate(opponentColor, board)) {
        gameOver = true;
        gameOverText = activeColor === "w" ? "White Wins by Checkmate!" : "Black Wins by Checkmate!";
    }
    
    saveState();
    render();

    if (!gameOver && aiEnabled && turn === "b") {
        triggerAIAsyncExecution();
    }
}

    ////
  
    // ==========================================================================
    // 6. Deep Meta AI Architecture
    // ==========================================================================
    function evaluateBoard(bMatrix) {
        let score = 0;
        // Central range for 14x14 board (indices 5, 6, 7, 8)
        const centerStart = 5;
        const centerEnd = 8;

        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (p) {
                    const val = PIECE_VALUES[p.type] || 0;
                    // Base value
                    let cellScore = p.color === "w" ? val : -val;
                    
                    // 1. Positional Bonus: Control the center
                    if (r >= centerStart && r <= centerEnd && f >= centerStart && f <= centerEnd) {
                        // Bonus for Pawns and Knights specifically for center control
                        if (p.type === 'P' || p.type === 'N') {
                            cellScore += (p.color === "w" ? 5 : -5);
                        }
                    }

                    // 2. Development Bonus (Penalty for pieces on back rank)
                    const isHomeRank = (p.color === "b" && r === 0) || (p.color === "w" && r === 13);
                    if (isHomeRank && (p.type === 'N' || p.type === 'B' || p.type === 'Q')) {
                        cellScore += (p.color === "w" ? -10 : 10);
                    }
                    
                    score += cellScore;
                }
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
                const captured = nextBoard[move.to.r][move.to.f];
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                if (captured && captured.type === "K") return { score: 99999 + depth, move };

                const scoreEval = minimax(nextBoard, depth - 1, alpha, beta, false).score;
                if (scoreEval > maxEval) { maxEval = scoreEval; bestMove = move; }
                alpha = Math.max(alpha, scoreEval);
                if (beta <= alpha) break; 
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                const captured = nextBoard[move.to.r][move.to.f];
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                if (captured && captured.type === "K") return { score: -99999 - depth, move };

                const scoreEval = minimax(nextBoard, depth - 1, alpha, beta, true).score;
                if (scoreEval < minEval) { minEval = scoreEval; bestMove = move; }
                beta = Math.min(beta, scoreEval);
                if (beta <= alpha) break; 
            }
            return { score: minEval, move: bestMove };
        }
    }

    function triggerAIAsyncExecution() {
        if (gameOver) return;
        aiThinking = true;
        setThinkingIndicatorVisibility(true);

        setTimeout(() => {
            const decision = minimax(board, aiDepth, -Infinity, Infinity, false);
            aiThinking = false;
            setThinkingIndicatorVisibility(false);

            if (decision && decision.move) {
                makeMove(decision.move.from, decision.move.to);
            } else {
                gameOver = true;
                gameOverText = "Black Surrenders! White wins.";
                saveState();
                render();
            }
        }, 50);
    }

    // ==========================================================================
    // 7. Render Core Engines (DOM Synchronization Layouts)
    // ==========================================================================
    function updateCameraMatrix() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        let scaleFactor = [1.0, 1.75, 3.5][zoomPreset - 1] || 1.0;
        boardEl.style.transform = `scale(${scaleFactor}) translate(${panX}px, ${panY}px)`;
        updateMinimapViewportIndicator(scaleFactor);
    }

    function updateMinimapViewportIndicator(scale) {
        const vp = document.getElementById("mini-viewport");
        const boardEl = document.getElementById("board");
        if (!vp || !boardEl) return;

        if (scale <= 1.0) {
            vp.style.width = "100%"; vp.style.height = "100%"; vp.style.left = "0"; vp.style.top = "0";
        } else {
            const pct = (1 / scale) * 100;
            vp.style.width = `${pct}%`; 
            vp.style.height = `${pct}%`;
            
            const w = boardEl.offsetWidth || 560;
            const h = boardEl.offsetHeight || 560;
            const maxPanX = (w * scale - w) / (2 * scale);
            const maxPanY = (h * scale - h) / (2 * scale);
            
            const ratioX = maxPanX > 0 ? (maxPanX - panX) / (2 * maxPanX) : 0;
            const ratioY = maxPanY > 0 ? (maxPanY - panY) / (2 * maxPanY) : 0;
            
            vp.style.left = `${ratioX * (100 - pct)}%`;
            vp.style.top = `${ratioY * (100 - pct)}%`;
        }
    }

    function render() {
        const container = document.getElementById("board");
        if (!container) return;
        container.innerHTML = "";
        container.className = `board turn-${turn}`;

        const loopOrder = Array.from({ length: SIZE }, (_, i) => i);
        if (isFlipped) loopOrder.reverse();

        loopOrder.forEach(r => {
            for (let f = 0; f < SIZE; f++) {
                const cellEl = document.createElement("div");
                const t = terrain(r, f);
                const isLight = (r + f) % 2 === 0;

                cellEl.classList.add("cell", isLight ? "light" : "dark");
                if (t !== "plain") cellEl.classList.add(`terrain-${t}`);
                if (isHomeRank(r)) cellEl.classList.add("home-rank");

                if (lastMoveSource && lastMoveSource.r === r && lastMoveSource.f === f) cellEl.classList.add("last-move-source");
                if (lastMoveTarget && lastMoveTarget.r === r && lastMoveTarget.f === f) cellEl.classList.add("last-move-target");

                if (selected && selected.r === r && selected.f === f) cellEl.classList.add("selected");
                const isLegal = legalTargets.some(tgt => tgt.r === r && tgt.f === f);
                if (isLegal) {
                    const hasEnemy = board[r][f] && board[r][f].color !== board[selected.r][selected.f].color;
                    cellEl.classList.add(hasEnemy ? "legal-capture" : "legal-move");
                }

                const p = board[r][f];
                if (p) {
                    const pieceEl = document.createElement("span");
                    pieceEl.className = `piece ${p.color === "w" ? "white" : "black"}`;
                    pieceEl.textContent = PIECE_SYMBOLS[p.color][p.type];
                    pieceEl.draggable = !gameOver && (!aiEnabled || turn === "w") && p.color === turn;
                    pieceEl.addEventListener("dragstart", (e) => handleDragStart(e, r, f));
                    pieceEl.addEventListener("dragend", handleDragEnd);
                    cellEl.appendChild(pieceEl);
                }

                cellEl.addEventListener("click", () => handleSquareClick(r, f));
                cellEl.addEventListener("dragover", (e) => e.preventDefault());
                cellEl.addEventListener("drop", (e) => handleSquareDrop(e, r, f));
                container.appendChild(cellEl);
            }
        });

        renderLabels();
        renderMoveLog();
        updateModalScreenState();
        syncTurnIndicators();
    }

    function renderLabels() {
        const ranksContainer = document.getElementById("ranks-labels");
        const filesContainer = document.getElementById("files-labels");
        if (!ranksContainer || !filesContainer) return;

        ranksContainer.innerHTML = ""; filesContainer.innerHTML = "";
        const rankOrder = Array.from({ length: SIZE }, (_, i) => i + 1);
        if (isFlipped) rankOrder.reverse();
        rankOrder.forEach(rank => { const label = document.createElement("div"); label.textContent = rank; ranksContainer.appendChild(label); });
        FILES.forEach(file => { const label = document.createElement("div"); label.textContent = file.toUpperCase(); filesContainer.appendChild(label); });
    }

function renderMoveLog() {
    const listEl = document.getElementById("move-log-list");
    if (!listEl) return;
    
    // Create/Update the button
    let copyBtn = document.getElementById("copy-history-btn");
    if (!copyBtn) {
        copyBtn = document.createElement("button");
        copyBtn.id = "copy-history-btn";
        copyBtn.textContent = "📋 Copy History";
        copyBtn.addEventListener("click", copyMoveHistory);
        listEl.parentNode.insertBefore(copyBtn, listEl); // Inserts before the list
    }

    listEl.innerHTML = "";
    moveLog.forEach((move, idx) => {
        const li = document.createElement("li");
        li.textContent = `${idx + 1}. ${move}`;
        if (idx === currentIndex - 1) li.classList.add("active");
        li.addEventListener("click", () => jumpToTimelineIndex(idx + 1));
        listEl.appendChild(li);
    });
}

    function updateModalScreenState() {
        const overlay = document.getElementById("win-overlay");
        const title = document.getElementById("win-title");
        if (!overlay || !title) return;
        if (gameOver) { title.textContent = gameOverText; overlay.classList.remove("hidden"); } 
        else { overlay.classList.add("hidden"); }
    }

    function syncTurnIndicators() {
        const wNode = document.getElementById("node-w");
        const bNode = document.getElementById("node-b");
        if (!wNode || !bNode) return;
        if (turn === "w") { wNode.classList.add("active-glow"); bNode.classList.remove("active-glow"); } 
        else { bNode.classList.add("active-glow"); wNode.classList.remove("active-glow"); }
    }

    function setThinkingIndicatorVisibility(visible) {
        const ind = document.getElementById("ai-thinking");
        if (!ind) return;
        visible ? ind.classList.remove("hidden") : ind.classList.add("hidden");
    }

    function updateUndoRedoButtons() {
        const btnUndo = document.getElementById("btn-undo");
        const btnRedo = document.getElementById("btn-redo");
        if (btnUndo) btnUndo.disabled = currentIndex <= 0;
        if (btnRedo) btnRedo.disabled = currentIndex >= history.length - 1;
    }

    // ==========================================================================
    // 8. User Interaction Handlers (Clicks & Drag Gestures)
    // ==========================================================================
    function handleSquareClick(r, f) {
        if (gameOver || aiThinking || (aiEnabled && turn === "b")) return;

        const p = board[r][f];
        if (selected && selected.r === r && selected.f === f) {
            selected = null; legalTargets = []; render(); return;
        }

        const isTargetLegal = legalTargets.some(tgt => tgt.r === r && tgt.f === f);
        if (isTargetLegal && selected) {
            makeMove(selected, { r, f });
            return;
        }

        if (p && p.color === turn) {
            selected = { r, f }; legalTargets = getMoves(r, f, board); render();
        } else {
            selected = null; legalTargets = []; render();
        }
    }

    function handleDragStart(e, r, f) {
        if (gameOver || aiThinking || (aiEnabled && turn === "b")) { e.preventDefault(); return; }
        selected = { r, f };
        legalTargets = getMoves(r, f, board);
        e.dataTransfer.setData("text/plain", JSON.stringify({ r, f }));
        setTimeout(() => { const cell = e.target.parentElement; if (cell) cell.classList.add("dragging-source"); }, 0);
    }

    function handleDragEnd(e) {
        document.querySelectorAll(".dragging-source").forEach(n => n.classList.remove("dragging-source"));
    }

    function handleSquareDrop(e, r, f) {
        e.preventDefault();
        try {
            const from = JSON.parse(e.dataTransfer.getData("text/plain"));
            const isTargetLegal = legalTargets.some(tgt => tgt.r === r && tgt.f === f);
            if (isTargetLegal && from) makeMove(from, { r, f });
            else { selected = null; legalTargets = []; render(); }
        } catch (err) { selected = null; legalTargets = []; render(); }
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
        if (!gameOver && aiEnabled && turn === "b") triggerAIAsyncExecution();
    }

    function setupControlLayoutListeners() {
        document.getElementById("btn-undo")?.addEventListener("click", () => { if (currentIndex > 0) jumpToTimelineIndex(currentIndex - 1); });
        document.getElementById("btn-redo")?.addEventListener("click", () => { if (currentIndex < history.length - 1) jumpToTimelineIndex(currentIndex + 1); });
        document.getElementById("btn-reset")?.addEventListener("click", () => {
            board = freshBoard(); turn = "w"; selected = null; legalTargets = []; gameOver = false; gameOverText = "";
            lastMoveSource = null; lastMoveTarget = null; history = []; moveLog = []; saveState(); render();
        });
        document.getElementById("btn-another-match")?.addEventListener("click", () => document.getElementById("btn-reset").click());
        document.getElementById("btn-flip")?.addEventListener("click", () => { isFlipped = !isFlipped; render(); });
        document.getElementById("btn-zen")?.addEventListener("click", () => {
            hideAllUi = !hideAllUi; document.body.classList.toggle("zen-active", hideAllUi);
        });
        document.getElementById("ai-toggle")?.addEventListener("change", (e) => {
            aiEnabled = e.target.checked; if (!gameOver && aiEnabled && turn === "b") triggerAIAsyncExecution();
        });
        document.getElementById("ai-depth")?.addEventListener("change", (e) => { aiDepth = parseInt(e.target.value) || 2; });

        const outer = document.getElementById("board-outer");
        if (outer) {
            outer.addEventListener("mousedown", (e) => {
                if (zoomPreset === 1) return; 
                isPanning = true; 
                startMouseX = e.clientX; 
                startMouseY = e.clientY;
                startPanX = panX;
                startPanY = panY;
            });
            window.addEventListener("mousemove", (e) => {
                if (!isPanning) return;
                let scaleFactor = [1.0, 1.75, 3.5][zoomPreset - 1] || 1.0;
                
                panX = startPanX + (e.clientX - startMouseX) / scaleFactor;
                panY = startPanY + (e.clientY - startMouseY) / scaleFactor;
                
                const w = document.getElementById("board").offsetWidth;
                const h = document.getElementById("board").offsetHeight;
                const maxPanX = (w * scaleFactor - w) / (2 * scaleFactor);
                const maxPanY = (h * scaleFactor - h) / (2 * scaleFactor);
                
                panX = Math.max(-maxPanX, Math.min(maxPanX, panX));
                panY = Math.max(-maxPanY, Math.min(maxPanY, panY));
                
                updateCameraMatrix();
            });
            window.addEventListener("mouseup", () => { isPanning = false; });
            window.addEventListener("mouseleave", () => { isPanning = false; });
        }
    }
function isSquareAttacked(r, f, color, bMatrix) {
    const enemyColor = color === "w" ? "b" : "w";
    for (let row = 0; row < SIZE; row++) {
        for (let file = 0; file < SIZE; file++) {
            const p = bMatrix[row][file];
            if (p && p.color === enemyColor) {
                // Generate moves for this enemy piece to see if they can hit (r, f)
                const moves = getMoves(row, file, bMatrix);
                if (moves.some(m => m.r === r && m.f === f)) return true;
            }
        }
    }
    return false;
}

// copying move history to clipboard
function copyMoveHistory() {
    // Joins the current moveLog array into a clean, readable string
    const historyText = moveLog.map((move, idx) => `${idx + 1}. ${move}`).join('\n');
    
    navigator.clipboard.writeText(historyText).then(() => {
        // You could also trigger a small UI toast notification here
        console.log("History copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy: ', err);
    })
}

   function isCheckmate(color, bMatrix) {
    // 1. Find the King's position
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

    // 2. Is the King currently attacked?
    if (!isSquareAttacked(kingPos.r, kingPos.f, color, bMatrix)) return false;

    // 3. Can any piece make a move that removes the check?
    const allMoves = generateAllLegalMoves(color, bMatrix);
    for (const move of allMoves) {
        const nextBoard = cloneBoard(bMatrix);
        // Simulate move
        nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
        nextBoard[move.from.r][move.from.f] = null;
        
        // Find king in new board
        let nextKingPos = null;
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                if (nextBoard[r][f] && nextBoard[r][f].type === "K" && nextBoard[r][f].color === color) {
                    nextKingPos = { r, f };
                }
            }
        }
        
        if (!isSquareAttacked(nextKingPos.r, nextKingPos.f, color, nextBoard)) {
            return false; // Found a move that escapes check
        }
    }
    return true; // No moves escape check
} 

    ///   init
    
    function init() {
        board = freshBoard();
        const aiToggle = document.getElementById("ai-toggle"); if (aiToggle) aiToggle.checked = aiEnabled;
        const zoomSlider = document.getElementById("zoom-slider");
        if (zoomSlider) {
            zoomSlider.min = "1"; zoomSlider.max = "3"; zoomSlider.step = "1"; zoomSlider.value = zoomPreset;
            zoomSlider.addEventListener("input", function (e) {
                zoomPreset = parseInt(e.target.value); panX = 0; panY = 0; updateCameraMatrix();
            });
        }
        setupControlLayoutListeners(); saveState(); render(); updateCameraMatrix();
    }

    document.addEventListener("DOMContentLoaded", init);
})();

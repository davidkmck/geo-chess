(function () {
    "use strict";

    // ==========================================================================
    // 1. Core Config & Global State Matrix
    // ==========================================================================
    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");

    let board = [];
    let turn = "w";
    let selected = null; // {r, f}
    let legalTargets = []; // [{r, f}]
    let gameOver = false;
    let gameOverText = "";

    // Camera Navigation States
    let zoomPreset = 1; // 1 = 14x14 (Full), 2 = 8x8 (Tactical), 3 = 4x4 (Skirmish)
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    // UI Configuration States
    let isFlipped = false;
    let hideAllUi = false; // Zen Mode Master Switch
    let aiEnabled = true;  // DEFAULT: AI Opponent ON
    let aiDepth = 2;       // Balanced Performance Depth
    let aiThinking = false;

    // Undo/Redo Engine Timeline Arrays
    let history = [];
    let moveLog = [];
    let currentIndex = 0;

    // Base Standard Mapping for Inner Back Ranks
    const BACK_RANK_FILES = {
        3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R"
    };

    // Piece Unicode Dictionary Symbols
    const PIECE_SYMBOLS = {
        w: { P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔" },
        b: { P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚" }
    };

    // Score evaluation matrix weights for Minimax processing
    const PIECE_VALUES = { P: 10, N: 30, B: 30, R: 50, Q: 90, K: 9000 };

    // Move Logging tracking metrics
    let lastMoveSource = null; // {r, f}
    let lastMoveTarget = null; // {r, f}

    // ==========================================================================
    // 2. Environmental Biome & Terrain Definition Rules
    // ==========================================================================
    function terrain(r, f) {
        if (r >= 3 && r <= 4 && f >= 1 && f <= 2) return "mountain";
        if (r >= 9 && r <= 10 && f >= 10 && f <= 12) return "mountain";
        if (r >= 3 && r <= 4 && f >= 11 && f <= 12) return "forest";
        if (r >= 9 && r <= 10 && f >= 1 && f <= 3) return "forest";
        if (r === 8 && f >= 6 && f <= 8) return "lake";
        if (r === 6) {
            if (f === 3 || f === 9) return "ford"; // Shallow structural crossings
            return "river";
        }
        return "plain";
    }

    function isWater(t) { return t === "river" || t === "lake"; }
    function isImpassable(t) { return t === "mountain" || t === "forest"; }
    function isHomeRank(r) { return r <= 1 || r >= SIZE - 2; }
    function canCapture(fromTerrain, toTerrain) {
        return !(isWater(fromTerrain) && isWater(toTerrain));
    }

    // ==========================================================================
    // 3. Board Initialization & Deep Cloning Tools
    // ==========================================================================
    function freshBoard() {
        const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        for (let f = 0; f < SIZE; f++) {
            // White Pieces Setup (Ranks 0 and 1)
            if (BACK_RANK_FILES[f]) b[0][f] = { type: BACK_RANK_FILES[f], color: "w", moved: false };
            b[1][f] = { type: "P", color: "w", moved: false };

            // Black Pieces Setup (Ranks 12 and 13)
            b[SIZE - 2][f] = { type: "P", color: "b", moved: false };
            if (BACK_RANK_FILES[f]) b[SIZE - 1][f] = { type: BACK_RANK_FILES[f], color: "b", moved: false };
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

        // --- PAWN MOVEMENT MODES ---
        if (p.type === "P") {
            const dir = p.color === "w" ? 1 : -1;
            const startRank = p.color === "w" ? 1 : SIZE - 2;

            // Single Step Forward
            const nr = r + dir;
            if (nr >= 0 && nr < SIZE) {
                if (!bMatrix[nr][f] && !isImpassable(terrain(nr, f))) {
                    moves.push({ r: nr, f: f });
                    // Double Step Option from Starting Gate
                    const nnr = r + (2 * dir);
                    if (r === startRank && !bMatrix[nnr][f] && !isImpassable(terrain(nnr, f))) {
                        moves.push({ r: nnr, f: f });
                    }
                }
            }

            // Diagonal Threat Captures
            const captureFiles = [f - 1, f + 1];
            captureFiles.forEach(nf => {
                if (nf >= 0 && nf < SIZE) {
                    const tgtR = r + dir;
                    if (tgtR >= 0 && tgtR < SIZE) {
                        const targetPiece = bMatrix[tgtR][nf];
                        const tTo = terrain(tgtR, nf);
                        if (targetPiece && targetPiece.color !== p.color && !isImpassable(tTo)) {
                            if (canCapture(tFrom, tTo)) {
                                moves.push({ r: tgtR, f: nf });
                            }
                        }
                    }
                }
            });
        }
        
        // --- SLIDER MECHANICS (Rook, Bishop, Queen) ---
        else if (["R", "B", "Q"].includes(p.type)) {
            const dirs = directions[p.type];
            dirs.forEach(([dr, df]) => {
                let curR = r + dr;
                let curF = f + df;
                while (curR >= 0 && curR < SIZE && curF >= 0 && curF < SIZE) {
                    const tTo = terrain(curR, curF);
                    if (isImpassable(tTo)) break;

                    const tgt = bMatrix[curR][curF];
                    if (!tgt) {
                        moves.push({ r: curR, f: curF });
                        if (isWater(tTo) && tTo !== "ford") break; // River locks sliders instantly
                    } else {
                        if (tgt.color !== p.color && canCapture(tFrom, tTo)) {
                            moves.push({ r: curR, f: curF });
                        }
                        break; // Blocked path
                    }
                    curR += dr;
                    curF += df;
                }
            });
        }
        
        // --- LEAPERS & ROYALS (Knight & King) ---
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
    function makeMove(from, to) {
        const p = board[from.r][from.f];
        const captured = board[to.r][to.f];
        
        // Build Alphanumeric Move Notation String
        const moveNotation = `${p.type}${FILES[from.f]}${from.r + 1}→${FILES[to.f]}${to.r + 1}`;
        moveLog.push(moveNotation);

        // Execute Move Update Matrix
        board[to.r][to.f] = { ...p, moved: true };
        board[from.r][from.f] = null;

        // Set highlight references
        lastMoveSource = { ...from };
        lastMoveTarget = { ...to };

        // Evaluate King Capture Win Conditions
        if (captured && captured.type === "K") {
            gameOver = true;
            gameOverText = p.color === "w" ? "White Wins by Regicide!" : "Black Wins by Regicide!";
        }

        // Toggle Turn Active State
        turn = turn === "w" ? "b" : "w";
        selected = null;
        legalTargets = [];

        saveState();
        render();

        if (!gameOver && aiEnabled && turn === "b") {
            triggerAIAsyncExecution();
        }
    }

    // ==========================================================================
    // 6. Deep Meta AI Architecture (Minimax Strategy Layer)
    // ==========================================================================
    function evaluateBoard(bMatrix) {
        let score = 0;
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (p) {
                    const val = PIECE_VALUES[p.type] || 0;
                    score += p.color === "w" ? val : -val;
                }
            }
        }
        return score;
    }

    function minimax(bMatrix, depth, alpha, beta, isMaximizing) {
        if (depth === 0) return { score: evaluateBoard(bMatrix) };

        const moves = generateAllLegalMoves(isMaximizing ? "w" : "b", bMatrix);
        if (moves.length === 0) return { score: evaluateBoard(bMatrix) };

        // Search for target elements
        let kingFound = false;
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                if (bMatrix[r][f] && bMatrix[r][f].type === "K") {
                    if ((isMaximizing && bMatrix[r][f].color === "b") || (!isMaximizing && bMatrix[r][f].color === "w")) {
                        kingFound = true;
                    }
                }
            }
        }

        let bestMove = null;
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                const captured = nextBoard[move.to.r][move.to.f];
                
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                if (captured && captured.type === "K") {
                    return { score: 99999 + depth, move };
                }

                const scoreEval = minimax(nextBoard, depth - 1, alpha, beta, false).score;
                if (scoreEval > maxEval) {
                    maxEval = scoreEval;
                    bestMove = move;
                }
                alpha = Math.max(alpha, scoreEval);
                if (beta <= alpha) break; // Pruning
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                const captured = nextBoard[move.to.r][move.to.f];

                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                if (captured && captured.type === "K") {
                    return { score: -99999 - depth, move };
                }

                const scoreEval = minimax(nextBoard, depth - 1, alpha, beta, true).score;
                if (scoreEval < minEval) {
                    minEval = scoreEval;
                    bestMove = move;
                }
                beta = Math.min(beta, scoreEval);
                if (beta <= alpha) break; // Pruning
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
                // Out of options, yield execution
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
        
        let scaleFactor = 1.0;
        switch (parseInt(zoomPreset)) {
            case 1: scaleFactor = 1.0; break;   // Full 14x14 Scale Engine
            case 2: scaleFactor = 1.75; break;  // Balanced Tactical 8x8 Focus
            case 3: scaleFactor = 3.5; break;   // CQC Close Skirmish 4x4 Frame
            default: scaleFactor = 1.0;
        }
        
        boardEl.style.transform = `scale(${scaleFactor}) translate(${panX}px, ${panY}px)`;
        updateMinimapViewportIndicator(scaleFactor);
    }

    function updateMinimapViewportIndicator(scale) {
        const vp = document.getElementById("mini-viewport");
        if (!vp) return;
        if (scale <= 1.0) {
            vp.style.width = "100%";
            vp.style.height = "100%";
            vp.style.left = "0";
            vp.style.top = "0";
        } else {
            const pct = (1 / scale) * 100;
            vp.style.width = `${pct}%`;
            vp.style.height = `${pct}%`;
            
            // Reverse coordinates vector calculations
            const maxPanOffset = (SIZE * 40 * (scale - 1)) / 2; 
            const ratioX = maxPanOffset > 0 ? -panX / maxPanOffset : 0;
            const ratioY = maxPanOffset > 0 ? -panY / maxPanOffset : 0;
            
            const leftPct = ((1 - (1 / scale)) * 50) * (1 + ratioX);
            const topPct = ((1 - (1 / scale)) * 50) * (1 + ratioY);
            
            vp.style.left = `${Math.max(0, Math.min(100 - pct, leftPct))}%`;
            vp.style.top = `${Math.max(0, Math.min(100 - pct, topPct))}%`;
        }
    }

    function render() {
        const container = document.getElementById("board");
        if (!container) return;
        container.innerHTML = "";

        // Track and cycle the turn indicators inside the tracking dashboard nodes
        container.className = `board turn-${turn}`;

        // Standard Rank loop orchestration checks
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

                // History Highlighting Application Matcher
                if (lastMoveSource && lastMoveSource.r === r && lastMoveSource.f === f) {
                    cellEl.classList.add("last-move-source");
                }
                if (lastMoveTarget && lastMoveTarget.r === r && lastMoveTarget.f === f) {
                    cellEl.classList.add("last-move-target");
                }

                // Interaction State Highlights
                if (selected && selected.r === r && selected.f === f) cellEl.classList.add("selected");
                const isLegal = legalTargets.some(tgt => tgt.r === r && tgt.f === f);
                if (isLegal) {
                    const hasEnemy = board[r][f] && board[r][f].color !== board[selected.r][selected.f].color;
                    cellEl.classList.add(hasEnemy ? "legal-capture" : "legal-move");
                }

                // Render Chess Piece Glyphs
                const p = board[r][f];
                if (p) {
                    const pieceEl = document.createElement("span");
                    pieceEl.className = `piece ${p.color === "w" ? "white" : "black"}`;
                    pieceEl.textContent = PIECE_SYMBOLS[p.color][p.type];
                    pieceEl.draggable = !gameOver && (!aiEnabled || turn === "w") && p.color === turn;
                    
                    // Drag and Drop Event Infrastructure Hooks
                    pieceEl.addEventListener("dragstart", (e) => handleDragStart(e, r, f));
                    pieceEl.addEventListener("dragend", handleDragEnd);
                    
                    cellEl.appendChild(pieceEl);
                }

                // Square Interactive Grid Click Events
                cellEl.addEventListener("click", () => handleSquareClick(r, f));
                cellEl.addEventListener("dragover", (e) => e.preventDefault());
                cellEl.addEventListener("drop", (e) => handleSquareDrop(e, r, f));

                container.appendChild(cellEl);
            }
        });

        // Sync Secondary Panels and HUD Overlays
        renderLabels();
        renderMoveLog();
        updateModalScreenState();
        syncTurnIndicators();
    }

    function renderLabels() {
        const ranksContainer = document.getElementById("ranks-labels");
        const filesContainer = document.getElementById("files-labels");
        if (!ranksContainer || !filesContainer) return;

        ranksContainer.innerHTML = "";
        filesContainer.innerHTML = "";

        const rankOrder = Array.from({ length: SIZE }, (_, i) => i + 1);
        if (isFlipped) rankOrder.reverse();

        rankOrder.forEach(rank => {
            const label = document.createElement("div");
            label.textContent = rank;
            ranksContainer.appendChild(label);
        });

        FILES.forEach(file => {
            const label = document.createElement("div");
            label.textContent = file.toUpperCase();
            filesContainer.appendChild(label);
        });
    }

    function renderMoveLog() {
        const listEl = document.getElementById("move-log-list");
        if (!listEl) return;
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

        if (gameOver) {
            title.textContent = gameOverText;
            overlay.classList.remove("hidden");
        } else {
            overlay.classList.add("hidden");
        }
    }

    function syncTurnIndicators() {
        const wNode = document.getElementById("node-w");
        const bNode = document.getElementById("node-b");
        if (!wNode || !bNode) return;

        if (turn === "w") {
            wNode.classList.add("active-glow");
            bNode.classList.remove("active-glow");
        } else {
            bNode.classList.add("active-glow");
            wNode.classList.remove("active-glow");
        }
    }

    function setThinkingIndicatorVisibility(visible) {
        const ind = document.getElementById("ai-thinking");
        if (!ind) return;
        if (visible) ind.classList.remove("hidden");
        else ind.classList.add("hidden");
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
            selected = null;
            legalTargets = [];
            render();
            return;
        }

        const isTargetLegal = legalTargets.some(tgt => tgt.r === r && tgt.f === f);
        if (isTargetLegal && selected) {
            makeMove(selected, { r, f });
            return;
        }

        if (p && p.color === turn) {
            selected = { r, f };
            legalTargets = getMoves(r, f, board);
            render();
        } else {
            selected = null;
            legalTargets = [];
            render();
        }
    }

    function handleDragStart(e, r, f) {
        if (gameOver || aiThinking || (aiEnabled && turn === "b")) {
            e.preventDefault();
            return;
        }
        selected = { r, f };
        legalTargets = getMoves(r, f, board);
        e.dataTransfer.setData("text/plain", JSON.stringify({ r, f }));
        
        setTimeout(() => {
            const cell = e.target.parentElement;
            if (cell) cell.classList.add("dragging-source");
        }, 0);
    }

    function handleDragEnd(e) {
        const nodes = document.querySelectorAll(".dragging-source");
        nodes.forEach(n => n.classList.remove("dragging-source"));
    }

    function handleSquareDrop(e, r, f) {
        e.preventDefault();
        try {
            const from = JSON.parse(e.dataTransfer.getData("text/plain"));
            const isTargetLegal = legalTargets.some(tgt => tgt.r === r && tgt.f === f);
            if (isTargetLegal && from) {
                makeMove(from, { r, f });
            } else {
                selected = null;
                legalTargets = [];
                render();
            }
        } catch (err) {
            selected = null;
            legalTargets = [];
            render();
        }
    }

    // ==========================================================================
    // 9. Timeline Engine & Interface Bindings
    // ==========================================================================
    function jumpToTimelineIndex(idx) {
        if (idx < 0 || idx >= history.length) return;
        currentIndex = idx;
        const stateData = history[currentIndex];

        board = cloneBoard(stateData.board);
        turn = stateData.turn;
        gameOver = stateData.gameOver;
        gameOverText = stateData.gameOverText;
        lastMoveSource = stateData.lastMoveSource ? { ...stateData.lastMoveSource } : null;
        lastMoveTarget = stateData.lastMoveTarget ? { ...stateData.lastMoveTarget } : null;

        selected = null;
        legalTargets = [];
        
        updateUndoRedoButtons();
        render();

        if (!gameOver && aiEnabled && turn === "b") {
            triggerAIAsyncExecution();
        }
    }

    function setupControlLayoutListeners() {
        // Timeline Action Controls
        document.getElementById("btn-undo")?.addEventListener("click", () => {
            if (currentIndex > 0) jumpToTimelineIndex(currentIndex - 1);
        });
        document.getElementById("btn-redo")?.addEventListener("click", () => {
            if (currentIndex < history.length - 1) jumpToTimelineIndex(currentIndex + 1);
        });
        document.getElementById("btn-reset")?.addEventListener("click", () => {
            board = freshBoard();
            turn = "w";
            selected = null;
            legalTargets = [];
            gameOver = false;
            gameOverText = "";
            lastMoveSource = null;
            lastMoveTarget = null;
            history = [];
            moveLog = [];
            saveState();
            render();
        });
        document.getElementById("btn-another-match")?.addEventListener("click", () => {
            document.getElementById("btn-reset").click();
        });

        // Board Perspective Alternator Rule
        document.getElementById("btn-flip")?.addEventListener("click", () => {
            isFlipped = !isFlipped;
            render();
        });

        // Master Mode Zen Focus Toggler
        document.getElementById("btn-zen")?.addEventListener("click", () => {
            hideAllUi = !hideAllUi;
            document.body.classList.toggle("zen-active", hideAllUi);
        });

        // Match Settings Configuration Elements
        const aiCheck = document.getElementById("ai-toggle");
        if (aiCheck) {
            aiCheck.addEventListener("change", (e) => {
                aiEnabled = e.target.checked;
                if (!gameOver && aiEnabled && turn === "b") {
                    triggerAIAsyncExecution();
                }
            });
        }

        const depthSelect = document.getElementById("ai-depth");
        if (depthSelect) {
            depthSelect.addEventListener("change", (e) => {
                aiDepth = parseInt(e.target.value) || 2;
            });
        }

        // Camera Pan System Registration Hook
        const outer = document.getElementById("board-outer");
        if (outer) {
            outer.addEventListener("mousedown", (e) => {
                if (zoomPreset === 1) return; // Full perspective is structurally locked down
                isPanning = true;
                startPanX = e.clientX - panX;
                startPanY = e.clientY - panY;
            });
            window.addEventListener("mousemove", (e) => {
                if (!isPanning) return;
                panX = e.clientX - startPanX;
                panY = e.clientY - startPanY;

                // Restrict boundary scrolling overflows based on state ratios
                let scaleFactor = 1.0;
                if (zoomPreset === 2) scaleFactor = 1.75;
                if (zoomPreset === 3) scaleFactor = 3.5;

                const boundaryLimit = (SIZE * 40 * (scaleFactor - 1)) / 2;
                panX = Math.max(-boundaryLimit, Math.min(boundaryLimit, panX));
                panY = Math.max(-boundaryLimit, Math.min(boundaryLimit, panY));

                updateCameraMatrix();
            });
            window.addEventListener("mouseup", () => { isPanning = false; });
        }
    }

    // ==========================================================================
    // 10. Core Initialize Context Hook
    // ==========================================================================
    function init() {
        board = freshBoard();
        
        // Sync Initial Engine States directly to DOM Element Hooks
        const aiToggle = document.getElementById("ai-toggle");
        if (aiToggle) aiToggle.checked = aiEnabled;

        const zoomSlider = document.getElementById("zoom-slider");
        if (zoomSlider) {
            zoomSlider.min = "1";
            zoomSlider.max = "3";
            zoomSlider.step = "1";
            zoomSlider.value = zoomPreset;
            zoomSlider.addEventListener("input", function (e) {
                zoomPreset = parseInt(e.target.value);
                // Reset standard camera pans whenever resetting views
                panX = 0;
                panY = 0;
                updateCameraMatrix();
            });
        }

        setupControlLayoutListeners();
        saveState();
        render();
        updateCameraMatrix();
    }

    document.addEventListener("DOMContentLoaded", init);
})();

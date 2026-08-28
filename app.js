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
    let currentScale = 1;
    const MIN_SCALE = 1, MAX_SCALE = 4;
    let panX = 0, panY = 0, startMouseX = 0, startMouseY = 0, startPanX = 0, startPanY = 0, isPanning = false;
    let isFlipped = false, aiEnabled = true, aiDepth = 2, aiThinking = false;
    let hasDragged = false;
    
    let initialPinchDistance = -1;
    let aiLastMove = null;

    const TERRAIN_PRESETS = {
      default: [
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "ppppFFrrpppppp",
        "ppMMppppppMMpp",
        "ppMMppppppMMpp",
        "ppMMppppppMMpp",
        "ppMMppppppMMpp",
        "pppprrFFpppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp"
      ],
      alternative: [
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "ppMMFFLLpppppp",
        "ppppppLLpppppp",
        "rrrfrrrppppppp",
        "pppppprrrrrrfr",
        "ppppppLLpppppp",
        "ppppppLLFFMMpp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp"
      ],
      fortress: [
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "ppMMMffMMMpppp",
        "ppMFFppFFMpppp",
        "ppMFppppFMpppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp"
      ],
      pass: [
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "MMMMppFFppMMMM",
        "MMMMppFFppMMMM",
        "MMMMppffppMMMM",
        "MMMMppffppMMMM",
        "MMMMppFFppMMMM",
        "MMMMppFFppMMMM",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp"
      ],
      archipelago: [
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "ppLLLLrrLLLLpp",
        "ppLpMMppMMpLpp",
        "rrrfrrrffrrrfr",
        "rrrfrrrffrrrfr",
        "ppLpMMppMMpLpp",
        "ppLLLLrrLLLLpp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp",
        "pppppppppppppp"
      ],
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

    function freshBoard() {
        const whiteStart = document.getElementById("white-start-select")?.value || "topos";
        const blackStart = document.getElementById("black-start-select")?.value || "topos";
        const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        const coreBackRank = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];

        if (blackStart === "classic") {
            for (let x = 0; x < 8; x++) {
                b[3][x + 3] = { type: coreBackRank[x], color: "b", moved: false };
                b[4][x + 3] = { type: "P", color: "b", moved: false };
            }
        } else {
            for (let x = 0; x < 14; x++) {
                b[1][x] = { type: "P", color: "b", moved: false };
            }
            for (let x = 0; x < 8; x++) {
                b[0][x + 3] = { type: coreBackRank[x], color: "b", moved: false };
            }
        }

        if (whiteStart === "classic") {
            for (let x = 0; x < 8; x++) {
                b[10][x + 3] = { type: coreBackRank[x], color: "w", moved: false };
                b[9][x + 3] = { type: "P", color: "w", moved: false };
            }
        } else {
            for (let x = 0; x < 14; x++) {
                b[12][x] = { type: "P", color: "w", moved: false };
            }
            for (let x = 0; x < 8; x++) {
                b[13][x + 3] = { type: coreBackRank[x], color: "w", moved: false };
            }
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

    function jumpToTimelineIndex(idx) {
        if (idx < 0 || idx >= history.length) return;
        currentIndex = idx;
        const stateData = history[currentIndex];
        board = cloneBoard(stateData.board);
        turn = stateData.turn; gameOver = stateData.gameOver; gameOverText = stateData.gameOverText;
        lastMoveSource = stateData.lastMoveSource ? { ...stateData.lastMoveSource } : null;
        lastMoveTarget = stateData.lastMoveTarget ? { ...stateData.lastMoveTarget } : null;
        selected = null; legalTargets = [];
        updateUndoRedoButtons(); 
        render();
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
                    if (!tgt) { 
                        moves.push({ r: cr, f: cf }); 
                    } else { 
                        if (tgt.color !== p.color && canCapture(tFrom, tTo)) {
                            moves.push({ r: cr, f: cf }); 
                        }
                        break;
                    }
                    
                    if (isForest(tTo) || isWater(tTo) || isWater(tFrom)) break;

                    cr += dr; cf += df;
                }
            });
        } else if (["N", "K"].includes(p.type)) {
            D[p.type].forEach(([dr, df]) => {
                const nr = r + dr, nf = f + df;
                if (nr >= 0 && nr < SIZE && nf >= 0 && nf < SIZE) {
                    const tTo = terrain(nr, nf);
                    if (!isImpassable(tTo)) {
                        const tgt = bMatrix[nr][nf];
                        if (!tgt || (tgt.color !== p.color && canCapture(tFrom, tTo))) {
                            moves.push({ r: nr, f: nf });
                        }
                    }
                }

                if (p.type === "K" && !p.moved) {
                    [1, -1].forEach(step => {
                        let pathClear = true;
                        let foundRook = false;
                        for (let x = f + step; x >= 0 && x < SIZE; x += step) {
                            const sq = bMatrix[r][x];
                            if (isImpassable(terrain(r, x))) {
                                pathClear = false;
                                break;
                            }
                            if (sq) {
                                if (sq.type === "R" && !sq.moved && sq.color === p.color) {
                                    foundRook = true;
                                } else {
                                    pathClear = false;
                                }
                                break; 
                            }
                        }
                        if (pathClear && foundRook) {
                            moves.push({ r: r, f: f + (2 * step) });
                        }
                    });
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
                    if (p.type === "N") {
                        const dr = Math.abs(r - row);
                        const df = Math.abs(f - file);
                        if ((dr === 1 && df === 2) || (dr === 2 && df === 1)) {
                            return true;
                        }
                    } else {
                        const moves = getMoves(row, file, bMatrix);
                        if (moves.some(m => m.r === r && m.f === f)) return true;
                    }
                }
            }
        }
        return false;
    }

    function findKing(color, bMatrix) {
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (p && p.type === "K" && p.color === color) return { r, f };
            }
        }
        return null;
    }

    function isKingSafe(color, bMatrix) {
        const kp = findKing(color, bMatrix);
        if (!kp) return true;
        return !isSquareAttacked(kp.r, kp.f, color, bMatrix);
    }

    function isInCheck(color, bMatrix) {
        return !isKingSafe(color, bMatrix);
    }

    function getLegalMoves(r, f, bMatrix) {
        const p = bMatrix[r][f];
        if (!p) return [];
    
        return getMoves(r, f, bMatrix).filter(m => {
            const nb = cloneBoard(bMatrix);
            nb[m.r][m.f] = { ...nb[r][f], moved: true };
            nb[r][f] = null;
            
            let isSafe = isKingSafe(p.color, nb);
    
            if (isSafe && p.type === "K" && Math.abs(m.f - f) === 2) {
                if (isInCheck(p.color, bMatrix)) isSafe = false; 
                const passThroughFile = f + (m.f > f ? 1 : -1);
                if (isSquareAttacked(r, passThroughFile, p.color, bMatrix)) isSafe = false; 
            }
    
            return isSafe;
        });
    }
    
    function computeLegalMoves(color, bMatrix) {
        const list = [];
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                if (bMatrix[r][f] && bMatrix[r][f].color === color) {
                    getLegalMoves(r, f, bMatrix).forEach(t => list.push({ from: { r, f }, to: t }));
                }
            }
        }
        return list;
    }

    function makeMove(from, to) {
        const p = board[from.r][from.f];
        const captured = board[to.r][to.f];
        let moveString = `${p.type}${FILES[from.f]}${from.r + 1}→${FILES[to.f]}${to.r + 1}`;
    
        if (p.type === "K" && Math.abs(to.f - from.f) === 2) {
            const step = to.f > from.f ? 1 : -1;
            let rookFile = to.f;
            while (rookFile >= 0 && rookFile < SIZE) {
                const rPiece = board[from.r][rookFile];
                if (rPiece && rPiece.type === "R" && !rPiece.moved) {
                    board[from.r][from.f + step] = { ...rPiece, moved: true };
                    board[from.r][rookFile] = null;
                    break;
                }
                rookFile += step;
            }
            moveString = to.f > from.f ? "O-O" : "O-O-O"; 
        }
    
        board[to.r][to.f] = { ...p, moved: true };
        board[from.r][from.f] = null;
        
        if (p.type === "P") {
            const promotionRank = p.color === "w" ? 0 : SIZE - 1;
            if (to.r === promotionRank) {
                board[to.r][to.f].type = "Q";
                moveString += "=Q";
            }
        }
        
        moveLog.push(moveString);
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
        
        const nextInCheck = isInCheck(turn, board);
        const nextLegalMoves = computeLegalMoves(turn, board);
        if (nextLegalMoves.length === 0) {
            gameOver = true;
            if (nextInCheck) {
                gameOverText = turn === "w" ? "Black Wins by Checkmate!" : "White Wins by Checkmate!";
            } else {
                gameOverText = "Draw by Stalemate!";
            }
        }
    
        saveState();
        render();
    
        if (aiEnabled && turn === "b" && !gameOver) triggerAI();
    
        if (gameOver) {
            document.getElementById("node-w")?.classList.remove("active-glow");
            document.getElementById("node-b")?.classList.remove("active-glow");
            
            const winOverlay = document.getElementById("win-overlay");
            const winTitle = document.getElementById("win-title");
            
            if (winOverlay && winTitle) {
                winTitle.innerText = gameOverText; 
                winOverlay.classList.remove("hidden"); 
            }
        }
    }

    function triggerAI() {
        if (gameOver) return;
        aiThinking = true;
        setTimeout(() => {
            if (typeof AI !== 'undefined') {
                const legalMoves = computeLegalMoves("b", board);
                let chosenMove = null;

                try {
                    const res = AI.findBestMove(board, aiDepth, "b", PIECE_VALUES, legalMoves, cloneBoard, isSquareAttacked, generateAllLegalMoves, aiLastMove);
                    if (res && res.move) {
                        chosenMove = res.move;
                    }
                } catch (error) {
                    console.error("AI Engine panic/crash:", error);
                }

                if (!chosenMove && legalMoves.length > 0) {
                    console.warn("AI failed to choose a move. Triggering random fallback.");
                    chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
                }

                aiThinking = false; 
                
                if (chosenMove) {
                    aiLastMove = chosenMove;
                    makeMove(chosenMove.from, chosenMove.to);
                }
            }
        }, 50);
    }

    function clampPan() {
        const outer = document.getElementById("board-outer");
        const boardEl = document.getElementById("board");
        if (!outer || !boardEl) return;

        const outerW = outer.offsetWidth;
        const outerH = outer.offsetHeight;
        
        const scaledW = boardEl.offsetWidth * currentScale;
        const scaledH = boardEl.offsetHeight * currentScale;

        if (scaledW > outerW) {
            const minX = (outerW - scaledW) / currentScale;
            panX = Math.min(0, Math.max(minX, panX));
        } else {
            panX = (outerW - scaledW) / (2 * currentScale);
        }

        if (scaledH > outerH) {
            const minY = (outerH - scaledH) / currentScale;
            panY = Math.min(0, Math.max(minY, panY));
        } else {
            panY = (outerH - scaledH) / (2 * currentScale);
        }
    }

    function applyCameraTransform() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        
        boardEl.style.transformOrigin = "0 0";
        boardEl.style.transform = `scale(${currentScale}) translate(${panX}px, ${panY}px)`;
    }

    function setupPanning() {
        const outer = document.getElementById("board-outer");
        if (!outer) return;

        const pointers = {}; 

        outer.addEventListener("pointerdown", (e) => {
            pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            
            const keys = Object.keys(pointers);
            if (keys.length === 1) {
                isPanning = true;
                startMouseX = e.clientX;
                startMouseY = e.clientY;
                startPanX = panX;
                startPanY = panY;
                hasDragged = false;
            } else if (keys.length === 2) {
                isPanning = false;
                const p1 = pointers[keys[0]];
                const p2 = pointers[keys[1]];
                initialPinchDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
            }
        });

        outer.addEventListener("pointermove", (e) => {
            if (!pointers[e.pointerId]) return;
            
            pointers[e.pointerId].x = e.clientX;
            pointers[e.pointerId].y = e.clientY;

            const keys = Object.keys(pointers);
            if (keys.length === 2) {
                hasDragged = true;
                const p1 = pointers[keys[0]];
                const p2 = pointers[keys[1]];
                const currentDistance = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                
                if (initialPinchDistance > 0) {
                    const scaleDiff = currentDistance / initialPinchDistance;
                    let newScale = currentScale * scaleDiff;
                    
                    currentScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
                    initialPinchDistance = currentDistance; 
                    
                    clampPan();
                    applyCameraTransform();
                }
            } else if (keys.length === 1 && isPanning) {
                if (Math.abs(e.clientX - startMouseX) > 5 || Math.abs(e.clientY - startMouseY) > 5) {
                    hasDragged = true;
                }
                
                panX = startPanX + (e.clientX - startMouseX) / currentScale;
                panY = startPanY + (e.clientY - startMouseY) / currentScale;
                
                clampPan();
                applyCameraTransform();
            }
        });

        const removePointer = (e) => {
            delete pointers[e.pointerId];
            
            const keys = Object.keys(pointers);
            if (keys.length < 2) {
                initialPinchDistance = -1;
            }
            
            if (keys.length === 1) {
                startMouseX = pointers[keys[0]].x;
                startMouseY = pointers[keys[0]].y;
                startPanX = panX;
                startPanY = panY;
                isPanning = true;
            } else if (keys.length === 0) {
                isPanning = false;
            }
        };

        outer.addEventListener("pointerup", removePointer);
        outer.addEventListener("pointercancel", removePointer);
        outer.addEventListener("pointerleave", removePointer);
        
        outer.addEventListener("wheel", (e) => {
            e.preventDefault();
            const zoomFactor = -e.deltaY * 0.002;
            currentScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale + zoomFactor));
            clampPan();
            applyCameraTransform();
        }, { passive: false });
    }

    function renderMoveLog() {
        const listEl = document.getElementById("move-log-list");
        if (!listEl) return;

        let loadWidget = document.getElementById("load-game-widget");
        if (!loadWidget) {
            loadWidget = document.createElement("div");
            loadWidget.id = "load-game-widget";
            loadWidget.style.display = "flex";
            loadWidget.style.flexDirection = "column";
            loadWidget.style.gap = "8px";
            loadWidget.style.marginBottom = "15px";

            const textArea = document.createElement("textarea");
            textArea.id = "load-game-input";
            textArea.placeholder = "Paste history here (e.g. 1. Ph5→h7)...";
            textArea.rows = 4;
            textArea.style.resize = "vertical";
            textArea.style.background = "rgba(0,0,0,0.2)";
            textArea.style.color = "inherit";
            textArea.style.border = "1px solid rgba(255,255,255,0.2)";
            textArea.style.padding = "8px";
            textArea.style.borderRadius = "4px";

            const loadBtn = document.createElement("button");
            loadBtn.className = "btn-ghost";
            loadBtn.textContent = "📥 Load Game";
            
            loadBtn.addEventListener("click", () => {
                const text = textArea.value;
                if (text.trim() === "") return;
                
                document.getElementById("btn-reset").click();
                
                const tempAiState = aiEnabled;
                aiEnabled = false;

                const lines = text.split('\n');
                const regex = /\d+\.\s*[A-Z]([a-n])(\d+)→([a-n])(\d+)/;
                
                for (const line of lines) {
                    const match = line.match(regex);
                    if (match) {
                        const fromF = FILES.indexOf(match[1]);
                        const fromR = parseInt(match[2], 10) - 1;
                        const toF = FILES.indexOf(match[3]);
                        const toR = parseInt(match[4], 10) - 1;
                        
                        if (board[fromR] && board[fromR][fromF]) {
                            makeMove({ r: fromR, f: fromF }, { r: toR, f: toF });
                        }
                    }
                }

                textArea.value = "";
                aiEnabled = tempAiState;
                if (aiEnabled && turn === "b" && !gameOver) triggerAI();
            });

            loadWidget.appendChild(textArea);
            loadWidget.appendChild(loadBtn);
            listEl.parentNode.insertBefore(loadWidget, listEl);
        }

        let copyBtn = document.getElementById("copy-history-btn");
        if (!copyBtn) {
            copyBtn = document.createElement("button");
            copyBtn.id = "copy-history-btn";
            copyBtn.className = "btn-ghost"; 
            copyBtn.textContent = "📋 Copy History";
            copyBtn.style.marginBottom = "10px";
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
        
        for (let viewR = 0; viewR < SIZE; viewR++) {
            for (let viewF = 0; viewF < SIZE; viewF++) {
                const r = isFlipped ? SIZE - 1 - viewR : viewR;
                const f = isFlipped ? SIZE - 1 - viewF : viewF;
                
                const cell = document.createElement("div");
                cell.className = `cell ${(r + f) % 2 === 0 ? 'light' : 'dark'} terrain-${terrain(r, f)}`;
                
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
                    piece.style.pointerEvents = "none";
                    piece.style.userSelect = "none";
                    piece.style.webkitUserDrag = "none";
                    cell.appendChild(piece);
                }
                
                cell.onclick = () => {
                    if (hasDragged) return; 
                    if (gameOver || aiThinking || (aiEnabled && turn === "b")) return;
                    if (selected && legalTargets.some(t => t.r === r && t.f === f)) {
                        makeMove(selected, {r, f});
                    } else if (board[r][f] && board[r][f].color === turn) { 
                        selected = {r, f}; 
                        legalTargets = getLegalMoves(r, f, board); 
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

        if (isInCheck(turn, board)) {
            for (let checkR = 0; checkR < SIZE; checkR++) {
                for (let checkF = 0; checkF < SIZE; checkF++) {
                    const p = board[checkR][checkF];
                    if (p && p.type === "K" && p.color === turn) {
                        const renderR = isFlipped ? SIZE - 1 - checkR : checkR;
                        const renderF = isFlipped ? SIZE - 1 - checkF : checkF;
                        const idx = renderR * SIZE + renderF;
                        container.children[idx]?.classList.add("king-in-check");
                    }
                }
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

        const statusEl = document.getElementById("status-display"); 
        if (statusEl) {
            if (gameOver) {
                statusEl.innerText = gameOverText;
                statusEl.style.color = "red";
            } else {
                statusEl.innerText = turn === "w" ? "White's Turn" : "Black's Turn";
                statusEl.style.color = "black";
            }
        }
    }

    function syncCoreToggle() {
        const white = document.getElementById("white-start-select")?.value;
        const black = document.getElementById("black-start-select")?.value;
        const toggle = document.getElementById("inner-board-toggle");
        if (toggle && (white === "classic" || black === "classic")) {
            toggle.checked = true;
        }
    }

    function init() {
        board = freshBoard();
        setupPanning();

        document.getElementById("btn-reset")?.addEventListener("click", () => { 
            board = freshBoard(); turn = "w"; selected = null; legalTargets = []; gameOver = false;
            lastMoveSource = null; lastMoveTarget = null; history = []; moveLog = []; aiLastMove = null;
            currentScale = 1; panX = 0; panY = 0;
            saveState(); render(); 
        });
    
        document.getElementById("btn-undo")?.addEventListener("click", () => { 
            const stepsToUndo = (aiEnabled && turn === "w") ? 2 : 1;
            if (currentIndex >= stepsToUndo) {
                jumpToTimelineIndex(currentIndex - stepsToUndo);
            } else if (currentIndex > 0) {
                jumpToTimelineIndex(currentIndex - 1);
            }
        });
        document.getElementById("btn-redo")?.addEventListener("click", () => { if (currentIndex < history.length - 1) jumpToTimelineIndex(currentIndex + 1); });
        document.getElementById("btn-flip")?.addEventListener("click", () => { 
            isFlipped = !isFlipped; 
            render(); 
        });
        document.getElementById("btn-another-match")?.addEventListener("click", () => { document.getElementById("btn-reset").click(); });
        
        document.getElementById("btn-zen")?.addEventListener("click", () => {
            document.body.classList.toggle("zen-active");
            
            const zenBtn = document.getElementById("btn-zen");
            if (document.body.classList.contains("zen-active")) {
                zenBtn.innerHTML = "❌ Exit Zen";
            } else {
                zenBtn.innerHTML = "👁️ Zen";
            }

            clampPan();
            applyCameraTransform();
        });

        document.getElementById("terrain-select")?.addEventListener("change", (e) => { currentTerrain = e.target.value; document.getElementById("btn-reset").click(); });
        document.getElementById("ai-toggle")?.addEventListener("change", (e) => { aiEnabled = e.target.checked; if (aiEnabled && turn === "b" && !gameOver) triggerAI(); });
        document.getElementById("ai-depth-select")?.addEventListener("change", (e) => { aiDepth = parseInt(e.target.value); });

        document.getElementById("white-start-select")?.addEventListener("change", () => {
            syncCoreToggle();
            document.getElementById("btn-reset").click();
        });
        document.getElementById("black-start-select")?.addEventListener("change", () => {
            syncCoreToggle();
            document.getElementById("btn-reset").click();
        });

        const winOverlay = document.getElementById("win-overlay");
        if (winOverlay) {
            winOverlay.classList.add("hidden");
        }

        syncCoreToggle();
        saveState();
        render();
    }
    
    document.addEventListener("DOMContentLoaded", init);
})();

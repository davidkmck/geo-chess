(function () {
    "use strict";
    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");

    const TERRAIN_PRESETS = {
        default: [
            "pppppppppppppp", "pppppppppppppp", "pppppppppppppp",
            "ppMMFFpppppppp", "ppMMFFLLpppppp", "ppppppLLpppppp",
            "rrrfrrrppppppp", "pppppprrrrrrfr", "ppppppLLpppppp",
            "ppppppLLFFMMpp", "ppppppppFFMMpp", "pppppppppppppp",
            "pppppppppppppp", "pppppppppppppp"
        ],
        alternative: [
            "pppppppppppppp", "pppppppppppppp", "pppppppppppppp",
            "pppppppppppppp", "ppppFFrrpppppp", "ppMMppppppMMpp",
            "ppMMppppppMMpp", "ppMMppppppMMpp", "ppMMppppppMMpp",
            "pppprrFFpppppp", "pppppppppppppp", "pppppppppppppp",
            "pppppppppppppp", "pppppppppppppp"
        ],
        none: Array(14).fill("pppppppppppppp")
    };

    let board = [], turn = "w", selected = null, legalTargets = [], gameOver = false, gameOverText = "", currentTerrain = 'default';
    let zoomPreset = 1, panX = 0, panY = 0, isPanning = false, startMouseX = 0, startMouseY = 0, startPanX = 0, startPanY = 0;
    let isFlipped = false, aiEnabled = true, aiDepth = 2, aiThinking = false;
    let history = [], moveLog = [], currentIndex = 0, lastMoveSource = null, lastMoveTarget = null;

    const BACK_RANK_FILES = {3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R"};
    const PIECE_SYMBOLS = {w: {P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔"}, b: {P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚"}};
    const PIECE_VALUES = {P: 10, N: 30, B: 30, R: 50, Q: 90, K: 9000};

    function terrain(r, f) {
        const char = TERRAIN_PRESETS[currentTerrain][r][f];
        const CHAR_TO_TERRAIN = {'p': "plain", 'M': "mountain", 'F': "forest", 'L': "lake", 'r': "river", 'f': "ford"};
        return CHAR_TO_TERRAIN[char] || "plain";
    }

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
        history.push({board: cloneBoard(board), turn, gameOver, gameOverText, lastMoveSource: lastMoveSource ? { ...lastMoveSource } : null, lastMoveTarget: lastMoveTarget ? { ...lastMoveTarget } : null});
        currentIndex = history.length - 1;
    }

    function getMoves(r, f, bMatrix) {
        const p = bMatrix[r][f];
        if (!p) return [];
        const moves = [], tFrom = terrain(r, f);
        const directions = {R: [[1,0], [-1,0], [0,1], [0,-1]], B: [[1,1], [1,-1], [-1,1], [-1,-1]], Q: [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]], K: [[1,0], [-1,0], [0,1], [0,-1], [1,1], [1,-1], [-1,1], [-1,-1]], N: [[2,1], [2,-1], [-2,1], [-2,-1], [1,2], [1,-2], [-1,2], [-1,-2]]};
        
        if (p.type === "P") {
            const dir = p.color === "w" ? -1 : 1, startRank = p.color === "w" ? SIZE - 2 : 1;
            const nr = r + dir;
            if (nr >= 0 && nr < SIZE) {
                if (!bMatrix[nr][f] && !isImpassable(terrain(nr, f))) {
                    moves.push({ r: nr, f: f });
                    if (r === startRank && !isSlow(tFrom) && !isSlow(terrain(nr, f)) && !bMatrix[r + (2 * dir)][f] && !isImpassable(terrain(r + (2 * dir), f))) moves.push({ r: r + (2 * dir), f: f });
                }
            }
            [f - 1, f + 1].forEach(nf => {
                if (nf >= 0 && nf < SIZE && r + dir >= 0 && r + dir < SIZE) {
                    const tTo = terrain(r + dir, nf), tgt = bMatrix[r + dir][nf];
                    if (tgt && tgt.color !== p.color && !isImpassable(tTo) && canCapture(tFrom, tTo)) moves.push({ r: r + dir, f: nf });
                }
            });
        } else if (["R", "B", "Q"].includes(p.type)) {
            directions[p.type].forEach(([dr, df]) => {
                let curR = r + dr, curF = f + df;
                while (curR >= 0 && curR < SIZE && curF >= 0 && curF < SIZE) {
                    const tTo = terrain(curR, curF), tgt = bMatrix[curR][curF];
                    if (isImpassable(tTo)) break;
                    if (!tgt) { moves.push({ r: curR, f: curF }); if (isWater(tFrom) || isWater(tTo) || isForest(tTo)) break; }
                    else { if (tgt.color !== p.color && canCapture(tFrom, tTo)) moves.push({ r: curR, f: curF }); break; }
                    curR += dr; curF += df;
                }
            });
        } else if (["N", "K"].includes(p.type)) {
            directions[p.type].forEach(([dr, df]) => {
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

    function makeMove(from, to) {
        const p = board[from.r][from.f], captured = board[to.r][to.f];
        moveLog.push(`${p.type}${FILES[from.f]}${from.r + 1}→${FILES[to.f]}${to.r + 1}`);
        board[to.r][to.f] = { ...p, moved: true };
        board[from.r][from.f] = null;
        lastMoveSource = { ...from }; lastMoveTarget = { ...to };
        if (captured && captured.type === "K") { gameOver = true; gameOverText = p.color === "w" ? "White Wins!" : "Black Wins!"; }
        turn = turn === "w" ? "b" : "w"; selected = null; legalTargets = [];
        if (!gameOver && isCheckmate(turn, board)) { gameOver = true; gameOverText = turn === "w" ? "Black Wins by Checkmate!" : "White Wins by Checkmate!"; }
        saveState(); render();
        if (!gameOver && aiEnabled && turn === "b") triggerAIAsyncExecution();
    }

    function evaluateBoard(bMatrix) {
        let score = 0;
        for (let r = 0; r < SIZE; r++) for (let f = 0; f < SIZE; f++) {
            const p = bMatrix[r][f];
            if (p) {
                let s = (p.color === "w" ? 1 : -1) * (PIECE_VALUES[p.type] || 0);
                if (r >= 5 && r <= 8 && f >= 5 && f <= 8 && (p.type === 'P' || p.type === 'N')) s += (p.color === "w" ? 5 : -5);
                score += s;
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
            for (const m of moves) {
                const nextBoard = cloneBoard(bMatrix);
                nextBoard[m.to.r][m.to.f] = { ...nextBoard[m.from.r][m.from.f], moved: true }; nextBoard[m.from.r][m.from.f] = null;
                const score = minimax(nextBoard, depth - 1, alpha, beta, false).score;
                if (score > maxEval) { maxEval = score; bestMove = m; }
                alpha = Math.max(alpha, score); if (beta <= alpha) break;
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const m of moves) {
                const nextBoard = cloneBoard(bMatrix);
                nextBoard[m.to.r][m.to.f] = { ...nextBoard[m.from.r][m.from.f], moved: true }; nextBoard[m.from.r][m.from.f] = null;
                const score = minimax(nextBoard, depth - 1, alpha, beta, true).score;
                if (score < minEval) { minEval = score; bestMove = m; }
                beta = Math.min(beta, score); if (beta <= alpha) break;
            }
            return { score: minEval, move: bestMove };
        }
    }

    function triggerAIAsyncExecution() {
        if (gameOver) return;
        aiThinking = true;
        setTimeout(() => {
            const decision = minimax(board, aiDepth, -Infinity, Infinity, false);
            aiThinking = false;
            if (decision && decision.move) makeMove(decision.move.from, decision.move.to);
        }, 50);
    }

    function render() {
        const container = document.getElementById("board");
        if (!container) return;
        container.innerHTML = ""; container.className = `board turn-${turn} terrain-${currentTerrain}`;
        const loopOrder = isFlipped ? Array.from({ length: SIZE }, (_, i) => SIZE - 1 - i) : Array.from({ length: SIZE }, (_, i) => i);
        loopOrder.forEach(r => {
            for (let f = 0; f < SIZE; f++) {
                const cellEl = document.createElement("div"), t = terrain(r, f);
                cellEl.className = `cell ${(r + f) % 2 === 0 ? "light" : "dark"} terrain-${t} ${isHomeRank(r) ? "home-rank" : ""}`;
                if ((r === 0 || r === SIZE - 1) && (f >= 3 && f <= 10)) cellEl.classList.add("palace-home");
                if (selected && selected.r === r && selected.f === f) cellEl.classList.add("selected");
                if (legalTargets.some(tgt => tgt.r === r && tgt.f === f)) cellEl.classList.add(board[r][f] ? "legal-capture" : "legal-move");
                const p = board[r][f];
                if (p) {
                    const pieceEl = document.createElement("span");
                    pieceEl.className = `piece ${p.color === "w" ? "white" : "black"}`; 
                    pieceEl.textContent = PIECE_SYMBOLS[p.color][p.type];
                    pieceEl.draggable = !gameOver && (!aiEnabled || turn === "w");
                    pieceEl.addEventListener("dragstart", (e) => { selected = {r, f}; e.dataTransfer.setData("text", JSON.stringify({r, f})); });
                    cellEl.appendChild(pieceEl);
                }
                cellEl.addEventListener("click", () => handleSquareClick(r, f));
                cellEl.addEventListener("drop", (e) => { e.preventDefault(); const from = JSON.parse(e.dataTransfer.getData("text")); if (legalTargets.some(tgt => tgt.r === r && tgt.f === f)) makeMove(from, {r, f}); });
                cellEl.addEventListener("dragover", (e) => e.preventDefault());
                container.appendChild(cellEl);
            }
        });
        const overlay = document.getElementById("win-overlay");
        if (overlay) overlay.classList.toggle("hidden", !gameOver);
        if (gameOver) document.getElementById("win-title").textContent = gameOverText;
    }

    function handleSquareClick(r, f) {
        if (gameOver || aiThinking || (aiEnabled && turn === "b")) return;
        const isTarget = legalTargets.some(tgt => tgt.r === r && tgt.f === f);
        if (isTarget && selected) makeMove(selected, {r, f});
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
        for (let r = 0; r < SIZE; r++) for (let f = 0; f < SIZE; f++) if (bMatrix[r][f] && bMatrix[r][f].type === "K" && bMatrix[r][f].color === color) king = {r, f};
        if (!king || !isSquareAttacked(king.r, king.f, color, bMatrix)) return false;
        return generateAllLegalMoves(color, bMatrix).every(m => {
            const nb = cloneBoard(bMatrix);
            nb[m.to.r][m.to.f] = nb[m.from.r][m.from.f]; nb[m.from.r][m.from.f] = null;
            let nk = null;
            for(let r=0; r<SIZE; r++) for(let f=0; f<SIZE; f++) if(nb[r][f] && nb[r][f].type === "K" && nb[r][f].color === color) nk = {r, f};
            return nk && isSquareAttacked(nk.r, nk.f, color, nb);
        });
    }

    function init() {
        board = freshBoard();
        document.getElementById("terrain-select")?.addEventListener("change", (e) => { currentTerrain = e.target.value; document.getElementById("btn-reset").click(); });
        document.getElementById("btn-reset").addEventListener("click", () => { board = freshBoard(); turn = "w"; history = []; moveLog = []; saveState(); render(); });
        render();
    }
    document.addEventListener("DOMContentLoaded", init);
})();

(function () {
    "use strict";

    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");
    const PIECE_SYMBOLS = { w: { P: "♙", R: "♖", N: "♘", B: "♗", Q: "♕", K: "♔" }, b: { P: "♟", R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚" } };
    const PIECE_VALUES = { P: 10, N: 30, B: 30, R: 50, Q: 90, K: 9000 };
    const BACK_RANK_FILES = { 3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R" };

    let board = [], turn = "w", selected = null, legalTargets = [], gameOver = false, gameOverText = "", currentTerrain = 'default';
    let zoomPreset = 1, panX = 0, panY = 0, isFlipped = false, aiEnabled = true, aiDepth = 2, aiThinking = false;
    let history = [], moveLog = [], currentIndex = 0;

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

    function freshBoard() {
        const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        for (let f = 0; f < SIZE; f++) {
            if (BACK_RANK_FILES[f]) b[0][f] = { type: BACK_RANK_FILES[f], color: "b" };
            b[1][f] = { type: "P", color: "b" };
            b[SIZE - 2][f] = { type: "P", color: "w" };
            if (BACK_RANK_FILES[f]) b[SIZE - 1][f] = { type: BACK_RANK_FILES[f], color: "w" };
        }
        return b;
    }

    function cloneBoard(src) { return src.map(row => row.map(cell => cell ? { ...cell } : null)); }

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
                if ((r === (p.color === "w" ? SIZE - 2 : 1)) && !bMatrix[r + (2 * dir)][f] && !isImpassable(terrain(r + (2 * dir), f))) moves.push({ r: r + (2 * dir), f: f });
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

    function makeMove(from, to) {
        const p = board[from.r][from.f];
        board[to.r][to.f] = { ...p, moved: true };
        board[from.r][from.f] = null;
        turn = turn === "w" ? "b" : "w"; selected = null; legalTargets = []; render();
        if (aiEnabled && turn === "b") triggerAI();
    }

    function triggerAI() {
        if (gameOver) return;
        aiThinking = true;
        setTimeout(() => {
            const res = AI.minimax(board, aiDepth, -Infinity, Infinity, false, PIECE_VALUES, generateAllLegalMoves, cloneBoard);
            aiThinking = false;
            if (res.move) makeMove(res.move.from, res.move.to);
        }, 50);
    }

    function render() {
        const container = document.getElementById("board");
        if (!container) return;
        container.innerHTML = "";
        const scales = [1, 1.75, 3.5];
        container.style.transform = `scale(${scales[zoomPreset - 1]}) translate(${panX}px, ${panY}px)`;
        
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cell = document.createElement("div");
                cell.className = `cell ${(r + f) % 2 === 0 ? 'light' : 'dark'} terrain-${terrain(r, f)}`;
                if (selected && selected.r === r && selected.f === f) cell.classList.add("selected");
                if (legalTargets.some(t => t.r === r && t.f === f)) cell.classList.add("legal-target");
                const p = board[r][f];
                if (p) {
                    const piece = document.createElement("span");
                    piece.className = `piece ${p.color === 'w' ? 'white' : 'black'}`;
                    piece.textContent = PIECE_SYMBOLS[p.color][p.type];
                    cell.appendChild(piece);
                }
                cell.onclick = () => {
                    if (selected && legalTargets.some(t => t.r === r && t.f === f)) makeMove(selected, {r, f});
                    else if (board[r][f] && board[r][f].color === turn) { selected = {r, f}; legalTargets = getMoves(r, f, board); render(); }
                };
                container.appendChild(cell);
            }
        }
        document.getElementById("node-w").classList.toggle("active-glow", turn === 'w');
        document.getElementById("node-b").classList.toggle("active-glow", turn === 'b');
    }

    function init() {
        board = freshBoard();
        document.getElementById("zoom-slider")?.addEventListener("input", (e) => { zoomPreset = e.target.value; render(); });
        document.getElementById("btn-reset")?.addEventListener("click", () => { board = freshBoard(); render(); });
        document.getElementById("btn-zen")?.addEventListener("click", () => document.body.classList.toggle("zen-active"));
        document.getElementById("terrain-select")?.addEventListener("change", (e) => { currentTerrain = e.target.value; render(); });
        render();
    }
    document.addEventListener("DOMContentLoaded", init);
})();

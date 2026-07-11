(function () {
    "use strict";

    const SIZE = 14;
    let board = [];
    let turn = "w";
    let selected = null;
    let legalTargets = [];
    let zoomPreset = 1;
    let aiEnabled = true;

    const TERRAIN_MAP = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0], [0,1,1,0,0,0,0,2,2,2,0,0,0,0],
        [0,1,1,0,0,0,0,2,2,2,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [3,3,3,5,3,3,3,3,3,3,3,5,3,3], [0,0,0,0,2,2,0,0,0,4,4,0,0,0],
        [0,0,0,0,2,2,0,0,0,4,4,0,0,0], [0,0,1,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    const PIECES = {
        w: { r: "♖", n: "♘", b: "♗", q: "♕", k: "♔", p: "♙" },
        b: { r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟" }
    };
    const TWELVE_ROYALS = ["r", "r", "r", "n", "b", "q", "k", "b", "n", "r", "r", "r"];

    function isSlowTerrain(terrainType) { return terrainType === 2 || terrainType === 3; }

    function updateMinimap() {
        const miniMap = document.getElementById("mini-map");
        if (!miniMap) return;
        zoomPreset > 1 ? miniMap.classList.remove("hidden") : miniMap.classList.add("hidden");
    }

    function setupInitialBoardState() {
        board = [];
        for (let r = 0; r < SIZE; r++) {
            let row = [];
            for (let f = 0; f < SIZE; f++) {
                let piece = null;
                if (f >= 1 && f <= 12) {
                    if (r === 0) piece = { type: TWELVE_ROYALS[f - 1], color: "b" };
                    else if (r === 1) piece = { type: "p", color: "b" };
                    else if (r === SIZE - 2) piece = { type: "p", color: "w" };
                    else if (r === SIZE - 1) piece = { type: TWELVE_ROYALS[f - 1], color: "w" };
                }
                row.push({ terrain: TERRAIN_MAP[r][f], piece: piece });
            }
            board.push(row);
        }
    }

    function calculateLegalMoves(r, f) {
        const p = board[r][f].piece;
        if (!p) return [];
        let targets = [];
        const isRestricted = isSlowTerrain(board[r][f].terrain) && p.type !== 'n';

        if (p.type === "p") {
            let dir = p.color === "w" ? -1 : 1;
            let nr = r + dir;
            if (nr >= 0 && nr < SIZE && !board[nr][f].piece && board[nr][f].terrain !== 1 && board[nr][f].terrain !== 4) {
                targets.push({ r: nr, f: f });
            }
        } else if (p.type === "n") {
            const offsets = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
            offsets.forEach(o => {
                let nr = r + o[0], nf = f + o[1];
                if (nr >= 0 && nr < SIZE && nf >= 0 && nf < SIZE) {
                    if (board[nr][nf].terrain !== 1 && board[nr][nf].terrain !== 4) {
                        if (!board[nr][nf].piece || board[nr][nf].piece.color !== p.color) {
                            targets.push({ r: nr, f: nf });
                        }
                    }
                }
            });
        } else {
            const dirs = p.type === 'r' ? [[1,0],[-1,0],[0,1],[0,-1]] : 
                         p.type === 'b' ? [[1,1],[1,-1],[-1,1],[-1,-1]] :
                         [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            dirs.forEach(d => {
                let nr = r + d[0], nf = f + d[1];
                while (nr >= 0 && nr < SIZE && nf >= 0 && nf < SIZE) {
                    let cell = board[nr][nf];
                    if (cell.terrain === 1 || cell.terrain === 4) break;
                    if (!cell.piece) {
                        targets.push({ r: nr, f: nf });
                    } else if (cell.piece.color !== p.color) {
                        targets.push({ r: nr, f: nf });
                        break;
                    } else break;
                    if (isRestricted) break;
                    nr += d[0]; nf += d[1];
                }
            });
        }
        return targets;
    }

    function drawBoard() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        boardEl.innerHTML = "";
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cellEl = document.createElement("div");
                cellEl.dataset.row = r; cellEl.dataset.file = f;
                const terrainTypes = ["plain", "mountain", "forest", "river", "lake", "ford"];
                cellEl.className = `cell ${(r+f)%2===0 ? 'light':'dark'} terrain-${terrainTypes[board[r][f].terrain]}`;
                if (board[r][f].piece) {
                    const pEl = document.createElement("span");
                    pEl.className = `piece ${board[r][f].piece.color}`;
                    pEl.textContent = PIECES[board[r][f].piece.color][board[r][f].piece.type];
                    cellEl.appendChild(pEl);
                }
                cellEl.addEventListener("click", handleCellClick);
                boardEl.appendChild(cellEl);
            }
        }
    }

    function handleCellClick(e) { /* existing logic */ }

    function init() { 
        setupInitialBoardState(); 
        drawBoard(); 
        const zenBtn = document.getElementById("btn-zen");
        zenBtn?.addEventListener("click", () => document.body.classList.toggle("zen-active"));
        const zoom = document.getElementById("zoom-slider");
        zoom?.addEventListener("input", (e) => {
            zoomPreset = parseInt(e.target.value);
            updateMinimap();
        });
        updateMinimap();
    }
    document.addEventListener("DOMContentLoaded", init);
})();

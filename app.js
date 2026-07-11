(function () {
    "use strict";

    const SIZE = 14;
    let board = [];
    let turn = "w";
    let selected = null;
    let legalTargets = [];
    let gameOver = false;
    let zoomPreset = 1;
    let panX = 0;
    let panY = 0;
    let aiEnabled = true;

    // Terrain types: 0: Plain, 1: Mountain, 2: Forest, 3: River, 4: Lake, 5: Ford
    const TERRAIN_MAP = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,1,1,0,0,0,0,2,2,2,0,0,0,0],
        [0,1,1,0,0,0,0,2,2,2,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [3,3,3,5,3,3,3,3,3,3,3,5,3,3],
        [0,0,0,0,2,2,0,0,0,4,4,0,0,0],
        [0,0,0,0,2,2,0,0,0,4,4,0,0,0],
        [0,0,1,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,1,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    const PIECES = {
        w: { r: "♖", n: "♘", b: "♗", q: "♕", k: "♔", p: "♙" },
        b: { r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟" }
    };
    const TWELVE_ROYALS = ["r", "r", "r", "n", "b", "q", "k", "b", "n", "r", "r", "r"];

    function isSlowTerrain(terrainType) {
        return terrainType === 2 || terrainType === 3;
    }

    function setupInitialBoardState() {
        board = [];
        for (let r = 0; r < SIZE; r++) {
            let row = [];
            for (let f = 0; f < SIZE; f++) {
                let piece = null;
                if (f >= 1 && f <= 12) {
                    let arrayIdx = f - 1;
                    if (r === 0) piece = { type: TWELVE_ROYALS[arrayIdx], color: "b" };
                    else if (r === 1) piece = { type: "p", color: "b" };
                    else if (r === SIZE - 2) piece = { type: "p", color: "w" };
                    else if (r === SIZE - 1) piece = { type: TWELVE_ROYALS[arrayIdx], color: "w" };
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
        const currentTerrain = board[r][f].terrain;
        const isRestricted = isSlowTerrain(currentTerrain) && p.type !== 'n';

        if (p.type === "p") {
            let dir = p.color === "w" ? -1 : 1;
            let nr = r + dir;
            if (nr >= 0 && nr < SIZE) {
                let targetCell = board[nr][f];
                if (!targetCell.piece && targetCell.terrain !== 1 && targetCell.terrain !== 4) {
                    targets.push({ r: nr, f: f });
                    if (r === (p.color === "w" ? SIZE - 2 : 1) && !isSlowTerrain(targetCell.terrain)) {
                        let nnr = r + (dir * 2);
                        if (!board[nnr][f].piece && board[nnr][f].terrain !== 1 && board[nnr][f].terrain !== 4) {
                            targets.push({ r: nnr, f: f });
                        }
                    }
                }
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
            let directions = p.type === 'r' ? [[1,0],[-1,0],[0,1],[0,-1]] : 
                             p.type === 'b' ? [[1,1],[1,-1],[-1,1],[-1,-1]] :
                             p.type === 'q' ? [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]] :
                             [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            
            directions.forEach(d => {
                let nr = r, nf = f;
                while (true) {
                    nr += d[0]; nf += d[1];
                    if (nr < 0 || nr >= SIZE || nf < 0 || nf >= SIZE) break;
                    let targetCell = board[nr][nf];
                    if (targetCell.terrain === 1 || targetCell.terrain === 4) break;
                    
                    targets.push({ r: nr, f: nf });
                    
                    if (isRestricted || !targetCell.piece || p.type === 'k') break;
                    if (targetCell.piece) break;
                }
            });
        }
        return targets;
    }

    function executeMove(sr, sf, tr, tf) {
        board[tr][tf].piece = board[sr][sf].piece;
        board[sr][sf].piece = null;
        turn = turn === "w" ? "b" : "w";
    }

    function drawBoard() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        boardEl.innerHTML = "";
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cellEl = document.createElement("div");
                cellEl.dataset.row = r; cellEl.dataset.file = f;
                cellEl.className = `cell ${(r+f)%2===0 ? 'light':'dark'} terrain-${board[r][f].terrain}`;
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

    function handleCellClick(e) {
        const r = parseInt(e.currentTarget.dataset.row);
        const f = parseInt(e.currentTarget.dataset.file);
        if (selected && legalTargets.some(t => t.r === r && t.f === f)) {
            executeMove(selected.r, selected.f, r, f);
            selected = null; legalTargets = [];
            drawBoard();
        } else if (board[r][f].piece && board[r][f].piece.color === turn) {
            selected = { r, f };
            legalTargets = calculateLegalMoves(r, f);
            drawBoard();
        }
    }

    function init() {
        setupInitialBoardState();
        drawBoard();
    }
    document.addEventListener("DOMContentLoaded", init);
})();

(function () {
    "use strict";

    const SIZE = 14;
    let board = [];
    let turn = "w";
    let selected = null;
    let legalTargets = [];
    let gameOver = false;
    let aiEnabled = true;

    // 0: Plain, 1: Mountain, 2: Forest, 3: River, 4: Lake, 5: Ford
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
        
        // Rule: If current terrain is slow (Forest/River), move only 1 square (except Knight)
        const isRestricted = isSlowTerrain(board[r][f].terrain) && p.type !== 'n';

        // ... (Insert standard movement logic here, filtering for isRestricted)
        // Ensure you add the check:
        // if (isRestricted) { /* limit distance to 1 square */ }
        
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
                
                // RESTORED: Map terrain classes
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

    function handleCellClick(e) { /* ... same as before ... */ }
    function init() { setupInitialBoardState(); drawBoard(); }
    document.addEventListener("DOMContentLoaded", init);
})();

(function () {
    "use strict";

    const SIZE = 14;
    let board = [], turn = "w", selected = null, legalTargets = [], gameOver = false;
    let zoomPreset = 1, panX = 0, panY = 0, aiEnabled = true, hideAllUi = false;

    const TERRAIN_MAP = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
        [0,1,1,0,0,0,0,2,2,2,0,0,0,0], [0,1,1,0,0,0,0,2,2,2,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
        [3,3,3,5,3,3,3,3,3,3,3,5,3,3], [0,0,0,0,2,2,0,0,0,4,4,0,0,0], [0,0,0,0,2,2,0,0,0,4,4,0,0,0], 
        [0,0,1,1,0,0,0,0,0,0,0,0,0,0], [0,0,1,1,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0], 
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0], [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];
    const PIECES = { w: { r: "♖", n: "♘", b: "♗", q: "♕", k: "♔", p: "♙" }, b: { r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟" } };
    const TWELVE_ROYALS = ["r", "r", "r", "n", "b", "q", "k", "b", "n", "r", "r", "r"];

    function isSlowTerrain(t) { return t === 2 || t === 3; }

    function updateMinimap() {
        const miniMap = document.getElementById("mini-map");
        if (miniMap) miniMap.classList.toggle("hidden", zoomPreset <= 1);
    }

    function setupInitialBoardState() {
        board = [];
        for (let r = 0; r < SIZE; r++) {
            let row = [];
            for (let f = 0; f < SIZE; f++) {
                let piece = null;
                if (f >= 1 && f <= 12) {
                    let idx = f - 1;
                    if (r === 0) piece = { type: TWELVE_ROYALS[idx], color: "b" };
                    else if (r === 1) piece = { type: "p", color: "b" };
                    else if (r === SIZE - 2) piece = { type: "p", color: "w" };
                    else if (r === SIZE - 1) piece = { type: TWELVE_ROYALS[idx], color: "w" };
                }
                row.push({ terrain: TERRAIN_MAP[r][f], piece });
            }
            board.push(row);
        }
    }

    function drawBoard() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        boardEl.innerHTML = "";
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cellEl = document.createElement("div");
                cellEl.dataset.row = r; cellEl.dataset.file = f;
                cellEl.className = `cell ${(r + f) % 2 === 0 ? "light" : "dark"}`;
                const terrainTypes = ["plain", "mountain", "forest", "river", "lake", "ford"];
                cellEl.classList.add(`terrain-${terrainTypes[board[r][f].terrain]}`);
                if (board[r][f].piece) {
                    const p = document.createElement("span");
                    p.className = `piece ${board[r][f].piece.color === "w" ? "white" : "black"}`;
                    p.textContent = PIECES[board[r][f].piece.color][board[r][f].piece.type];
                    cellEl.appendChild(p);
                }
                cellEl.addEventListener("click", handleCellClick);
                boardEl.appendChild(cellEl);
            }
        }
    }

    function handleCellClick(e) {
        // ... (Insert your existing movement logic here)
        drawBoard();
    }

    function init() {
        setupInitialBoardState();
        const zoomSlider = document.getElementById("zoom-slider");
        zoomSlider?.addEventListener("input", (e) => {
            zoomPreset = parseInt(e.target.value);
            updateMinimap();
        });
        document.getElementById("btn-zen")?.addEventListener("click", () => document.body.classList.toggle("zen-active"));
        drawBoard();
        updateMinimap();
    }
    document.addEventListener("DOMContentLoaded", init);
})();

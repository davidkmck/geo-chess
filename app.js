(function () {
    "use strict";

    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");

    // NEW: Terrain configuration
    const TERRAIN_PRESETS = {
        default: [
            "pppppppppppppp", "pppppppppppppp", "pppppppppppppp",
            "ppMMFFpppppppp", "ppMMFFLLpppppp", "ppppppLLpppppp",
            "rrrfrrrppppppp", "pppppprrrrrrfr", "ppppppLLpppppp",
            "ppppppLLFFMMpp", "ppppppppFFMMpp", "pppppppppppppp",
            "pppppppppppppp", "pppppppppppppp"
        ],
        alternative: [
            "pppppppppppppp", "pppppppppppppp", "ppppFFrrpppppp",
            "ppppFFrrpppppp", "pppppppppppppp", "ppMMppppppMMpp",
            "ppMMppppppMMpp", "ppMMppppppMMpp", "ppMMppppppMMpp",
            "pppppppppppppp", "pprrFFpppprrFF", "pprrFFpppprrFF",
            "pppppppppppppp", "pppppppppppppp"
        ],
        none: Array(14).fill("pppppppppppppp")
    };

    let board = [];
    let turn = "w";
    let selected = null; 
    let legalTargets = []; 
    let gameOver = false;
    let gameOverText = "";
    let currentTerrain = 'default'; // Current mode

    // ... (Keep existing camera/UI/config states) ...

    function terrain(r, f) {
        const layout = TERRAIN_PRESETS[currentTerrain];
        const CHAR_TO_TERRAIN = {'p': "plain", 'M': "mountain", 'F': "forest", 'L': "lake", 'r': "river", 'f': "ford"};
        return CHAR_TO_TERRAIN[layout[r][f]] || "plain";
    }

    // ... (Keep isWater, isForest, isSlow, isImpassable, canCapture, isHomeRank) ...

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

    // ... (Keep cloneBoard, saveState, getMoves, generateAllLegalMoves, makeMove, evaluateBoard, minimax, triggerAIAsyncExecution, updateCameraMatrix, updateMinimapViewportIndicator) ...

    function render() {
        const container = document.getElementById("board");
        if (!container) return;
        container.innerHTML = "";
        container.className = `board turn-${turn} terrain-${currentTerrain}`; // Add mode class

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
                
                // ... (Keep Palace logic, lastMove logic, etc.)

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
        // ... (Keep remaining render functions)
    }

    // ... (Keep remaining helper functions)

    function init() {
        const terrainSelect = document.getElementById("terrain-select");
        if (terrainSelect) {
            terrainSelect.addEventListener("change", (e) => {
                currentTerrain = e.target.value;
                document.getElementById("btn-reset").click();
            });
        }
        board = freshBoard();
        // ... (Keep existing init logic)
        setupControlLayoutListeners(); saveState(); render(); updateCameraMatrix();
    }

    document.addEventListener("DOMContentLoaded", init);
})();

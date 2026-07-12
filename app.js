(function () {
    "use strict";
    const SIZE = 14;
    const TERRAIN_PRESETS = {
        default: ["pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "ppMMFFpppppppp", "ppMMFFLLpppppp", "ppppppLLpppppp", "rrrfrrrppppppp", "pppppprrrrrrfr", "ppppppLLpppppp", "ppppppLLFFMMpp", "ppppppppFFMMpp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp"],
        alternative: ["pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "ppppFFrrpppppp", "ppMMppppppMMpp", "ppMMppppppMMpp", "ppMMppppppMMpp", "ppMMppppppMMpp", "pppprrFFpppppp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp", "pppppppppppppp"],
        none: Array(14).fill("pppppppppppppp")
    };

    let board = [], turn = "w", currentTerrain = 'default', zoomPreset = 1;
    let panX = 0, panY = 0, isPanning = false;

    function render() {
        const boardEl = document.getElementById("board");
        boardEl.innerHTML = "";
        const scales = [1, 1.75, 3.5];
        boardEl.style.transform = `scale(${scales[zoomPreset-1]}) translate(${panX}px, ${panY}px)`;
        
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cell = document.createElement("div");
                cell.className = `cell ${(r+f)%2===0 ? 'light':'dark'}`;
                const p = board[r][f];
                if (p) {
                    const piece = document.createElement("span");
                    piece.className = `piece ${p.color === 'w' ? 'white' : 'black'}`;
                    piece.textContent = p.type;
                    cell.appendChild(piece);
                }
                boardEl.appendChild(cell);
            }
        }
        document.getElementById("node-w").classList.toggle("active-glow", turn === 'w');
        document.getElementById("node-b").classList.toggle("active-glow", turn === 'b');
    }

    function init() {
        document.getElementById("zoom-slider").addEventListener("input", (e) => { zoomPreset = e.target.value; render(); });
        document.getElementById("btn-zen").addEventListener("click", () => document.body.classList.toggle("zen-active"));
        document.getElementById("terrain-select").addEventListener("change", (e) => { currentTerrain = e.target.value; render(); });
        render();
    }
    document.addEventListener("DOMContentLoaded", init);
})();

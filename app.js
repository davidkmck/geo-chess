(function () {
    "use strict";

    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");

    // ---- Board state ----
    let board = [];
    let turn = "w";
    let selected = null; // {r, f}
    let legalTargets = []; // [{r,f}]
    let gameOver = false;
    let gameOverText = "";

    // Preset Layout & Camera States (Driven by Discrete 3-State Zoom Slider)
    let zoomPreset = 1; // Default to full 14x14 state index
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    // UI Component Visibility States
    let isFlipped = false;
    let hideAllUi = false; // Master Zen Mode state
    let aiEnabled = true;  // Default set to enabled

    // ---- History ----
    let history = [];
    let moveLog = [];
    let currentIndex = 0;

    const BACK_RANK_FILES = {
        3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R"
    };

    // ---- Terrain ----
    function terrain(r, f) {
        if (r >= 3 && r <= 4 && f >= 1 && f <= 2) return "mountain";
        if (r >= 9 && r <= 10 && f >= 10 && f <= 12) return "mountain";
        if (r >= 3 && r <= 4 && f >= 11 && f <= 12) return "forest";
        if (r >= 9 && r <= 10 && f >= 1 && f <= 3) return "forest";
        if (r === 8 && f >= 6 && f <= 8) return "lake";
        if (r === 6) {
            if (f === 3 || f === 9) return "ford";
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

    function freshBoard() {
        const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
        for (let f = 0; f < SIZE; f++) {
            if (BACK_RANK_FILES[f]) b[0][f] = { type: BACK_RANK_FILES[f], color: "w", moved: false };
            b[1][f] = { type: "P", color: "w", moved: false };
            b[SIZE - 2][f] = { type: "P", color: "b", moved: false };
            if (BACK_RANK_FILES[f]) b[SIZE - 1][f] = { type: BACK_RANK_FILES[f], color: "b", moved: false };
        }
        return b;
    }

    // ---- Camera Rendering Matrix Sync ----
    function updateCameraMatrix() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        
        let scaleFactor = 1.0;
        switch(parseInt(zoomPreset)) {
            case 1: // Full view 14x14
                scaleFactor = 1.0;
                break;
            case 2: // Balanced view 8x8 focus
                scaleFactor = 1.75;
                break;
            case 3: // CQC skirmish view 4x4 focus
                scaleFactor = 3.5;
                break;
            default:
                scaleFactor = 1.0;
        }
        
        boardEl.style.transform = `scale(${scaleFactor}) translate(${panX}px, ${panY}px)`;
    }

    // ---- Initialization & DOM Hook Rigging ----
    function init() {
        board = freshBoard();
        
        // Sync UI toggles with starting state defaults
        const aiToggle = document.getElementById("ai-toggle");
        if (aiToggle) aiToggle.checked = aiEnabled;

        const zoomSlider = document.getElementById("zoom-slider");
        if (zoomSlider) {
            zoomSlider.min = "1";
            zoomSlider.max = "3";
            zoomSlider.step = "1";
            zoomSlider.value = zoomPreset;
            zoomSlider.addEventListener("input", function(e) {
                zoomPreset = parseInt(e.target.value);
                updateCameraMatrix();
            });
        }

        updateCameraMatrix();
        // (Insert your drawing routines / event listener attachments below...)
    }

    document.addEventListener("DOMContentLoaded", init);
})();

(function () {
    "use strict";

    // ==========================================================================
    // 1. Core Config & Global State Matrix
    // ==========================================================================
    const SIZE = 14;
    const FILES = "abcdefghijklmn".split("");

    let board = [];
    let turn = "w";
    let selected = null; // {r, f}
    let legalTargets = []; // [{r, f}]
    let gameOver = false;
    let gameOverText = "";

    // Camera Navigation States (Driven by Discrete 3-State Zoom Slider)
    let zoomPreset = 1; // 1 = 14x14 (Full), 2 = 8x8 (Tactical), 3 = 4x4 (Skirmish)
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    // UI Configuration States
    let isFlipped = false;
    let hideAllUi = false; // Zen Mode Master Switch
    let aiEnabled = true;  // DEFAULT: AI Opponent ON
    let aiDepth = 2;       // Balanced Performance Depth
    let aiThinking = false;

    // ==========================================================================
    // 2. Camera Rendering Matrix Sync
    // ==========================================================================
    function updateCameraMatrix() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        
        let scaleFactor = 1.0;
        switch (parseInt(zoomPreset)) {
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

    // ==========================================================================
    // 3. Initialization & DOM Hook Rigging
    // ==========================================================================
    function init() {
        // ... (Your original drawing routines and state setups) ...
        
        // Sync UI toggles with starting state defaults
        const aiToggle = document.getElementById("ai-toggle");
        if (aiToggle) aiToggle.checked = aiEnabled;

        const zoomSlider = document.getElementById("zoom-slider");
        if (zoomSlider) {
            zoomSlider.min = "1";
            zoomSlider.max = "3";
            zoomSlider.step = "1";
            zoomSlider.value = zoomPreset;
            zoomSlider.addEventListener("input", function (e) {
                zoomPreset = parseInt(e.target.value);
                // Reset standard camera pans whenever resetting views
                panX = 0;
                panY = 0;
                updateCameraMatrix();
            });
        }

        updateCameraMatrix();
    }

    document.addEventListener("DOMContentLoaded", init);
})();

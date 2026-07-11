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

    // Preset Layout & Camera States (Driven by Zoom Slider now)
    // 0 = Full board with controls and labels
    // 1 = Full board only (labels hidden)
    // 2 = Zoomed in 8x8 viewport window
    let zoomPreset = 0;
    let panX = 0;
    let panY = 0;
    let isPanning = false;
    let startPanX = 0;
    let startPanY = 0;

    // UI Component Visibility States
    let isFlipped = false;
    let hideAllUi = false; // Master Zen Mode state

    // ---- History (undo/redo + jump-to-any-point) ----
    let history = [];
    let moveLog = [];
    let currentIndex = 0;

    const BACK_RANK_FILES = {
        3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R"
    };

    // Zen Mode Toggle Handler
function toggleZenMode() {
  const body = document.body;
  const btn = document.getElementById('zenToggleBtn');
  
  body.classList.toggle('zen-active');
  
  if (body.classList.contains('zen-active')) {
    btn.innerHTML = '👁️';
    btn.setAttribute('title', 'Exit Zen Mode');
  } else {
    btn.innerHTML = '👁️‍🗨️';
    btn.setAttribute('title', 'Enter Zen Mode');
  }
}
    // ---- Terrain
 

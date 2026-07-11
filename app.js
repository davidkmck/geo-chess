(function () {
    "use strict";

    // ==========================================================================
    // 1. Core Config & Global State Matrix
    // ==========================================================================
    const SIZE = 14;

    let board = [];
    let turn = "w";
    let selected = null; // {r, f}
    let legalTargets = []; // [{r, f}]
    let gameOver = false;

    // Camera Navigation States
    let zoomPreset = 1; 
    let panX = 0;
    let panY = 0;

    // UI Configuration States
    let aiEnabled = true;  
    let hideAllUi = false; // Zen Mode Master Toggle

    // Organic Asymmetric Map Layout (0: Plain, 1: Mountain, 2: Forest, 3: River, 4: Lake, 5: Ford)
    // Safe buffer zones: No blockers on rows 0, 1, 2 or 11, 12, 13 near standard starting squares.
    const TERRAIN_MAP = [
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Safe buffer rank
        [0,1,1,0,0,0,0,2,2,2,0,0,0,0], // Black Zone: 2x2 Mountain left, 2x3 Forest right
        [0,1,1,0,0,0,0,2,2,2,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [3,3,3,5,3,3,3,3,3,3,3,5,3,3], // Center River (row 6) with exactly 2 bridges
        [0,0,0,0,2,2,0,0,0,4,4,0,0,0], // White Zone: Asymmetric 2x2 Forest center-left, 2x2 Lake right
        [0,0,0,0,2,2,0,0,0,4,4,0,0,0],
        [0,0,1,1,0,0,0,0,0,0,0,0,0,0], // Deep White territory: Symmetrical 2x2 Mountain offset
        [0,0,1,1,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0], // Safe buffer rank
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
        [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ];

    // Standard Chess Unicode Piece Engine Map
    const PIECES = {
        w: { r: "♖", n: "♘", b: "♗", q: "♕", k: "♔", p: "♙" },
        b: { r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟" }
    };

    // Standard 8-piece royal back-rank setup array
    const STANDARD_ROYALS = ["r", "n", "b", "q", "k", "b", "n", "r"];

    // ==========================================================================
    // 2. Camera Rendering Matrix Sync
    // ==========================================================================
    function updateCameraMatrix() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        
        let scaleFactor = 1.0;
        switch (parseInt(zoomPreset)) {
            case 1: scaleFactor = 1.0; break;
            case 2: scaleFactor = 1.75; break;
            case 3: scaleFactor = 3.5; break;
            default: scaleFactor = 1.0;
        }
        boardEl.style.transform = `scale(${scaleFactor}) translate(${panX}px, ${panY}px)`;
    }

    // ==========================================================================
    // 3. Core State Draw & DOM Generation Engine
    // ==========================================================================
    function setupInitialBoardState() {
        board = [];
        for (let r = 0; r < SIZE; r++) {
            let row = [];
            for (let f = 0; f < SIZE; f++) {
                let piece = null;
                
                // Center the standard 8 pieces between file index 3 and 10
                if (f >= 3 && f <= 10) {
                    let standardIdx = f - 3;
                    if (r === 0) piece = { type: STANDARD_ROYALS[standardIdx], color: "b" };
                    else if (r === 1) piece = { type: "p", color: "b" };
                    else if (r === SIZE - 2) piece = { type: "p", color: "w" };
                    else if (r === SIZE - 1) piece = { type: STANDARD_ROYALS[standardIdx], color: "w" };
                }
                
                row.push({
                    terrain: TERRAIN_MAP[r][f],
                    piece: piece
                });
            }
            board.push(row);
        }
    }

    function drawBoard() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        boardEl.innerHTML = "";
        boardEl.className = `board turn-${turn}`;

        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cellData = board[r][f];
                const cellEl = document.createElement("div");
                
                cellEl.dataset.row = r;
                cellEl.dataset.file = f;

                let baseColorClass = (r + f) % 2 === 0 ? "light" : "dark";
                cellEl.classList.add("cell", baseColorClass);

                // Highlight initial homeland/palace position setup squares (Centered 8x2 areas)
                if ((f >= 3 && f <= 10) && (r === 0 || r === 1 || r === SIZE - 2 || r === SIZE - 1)) {
                    cellEl.classList.add("homeland-cell");
                }

                // Map styling visual environmental layouts
                if (cellData.terrain === 1) cellEl.classList.add("terrain-mountain");
                else if (cellData.terrain === 2) cellEl.classList.add("terrain-forest");
                else if (cellData.terrain === 3) cellEl.classList.add("terrain-river");
                else if (cellData.terrain === 4) cellEl.classList.add("terrain-lake");
                else if (cellData.terrain === 5) cellEl.classList.add("terrain-ford");

                if (selected && selected.r === r && selected.f === f) {
                    cellEl.classList.add("selected");
                }
                
                if (legalTargets.some(t => t.r === r && t.f === f)) {
                    if (cellData.piece) cellEl.classList.add("legal-capture");
                    else cellEl.classList.add("legal-move");
                }

                if (cellData.piece) {
                    const pieceEl = document.createElement("span");
                    pieceEl.className = `piece ${cellData.piece.color === "w" ? "white" : "black"}`;
                    pieceEl.textContent = PIECES[cellData.piece.color][cellData.piece.type];
                    pieceEl.style.fontSize = "110%"; 
                    cellEl.appendChild(pieceEl);
                }

                cellEl.addEventListener("click", handleCellClick);
                boardEl.appendChild(cellEl);
            }
        }
        updateIndicators();
    }

    function updateIndicators() {
        const nodeW = document.getElementById("node-w");
        const nodeB = document.getElementById("node-b");
        if (turn === "w") {
            nodeW?.classList.add("active-glow");
            nodeB?.classList.remove("active-glow");
        } else {
            nodeB?.classList.add("active-glow");
            nodeW?.classList.remove("active-glow");
        }
    }

    function handleCellClick(e) {
        if (gameOver || (turn === "b" && aiEnabled)) return;

        const cell = e.currentTarget;
        const r = parseInt(cell.dataset.row);
        const f = parseInt(cell.dataset.file);

        if (selected && legalTargets.some(t => t.r === r && t.f === f)) {
            executeMove(selected.r, selected.f, r, f);
            selected = null;
            legalTargets = [];
            drawBoard();
            
            if (aiEnabled && !gameOver && turn === "b") {
                setTimeout(triggerSimpleAi, 400);
            }
        } else {
            const piece = board[r][f].piece;
            if (piece && piece.color === turn) {
                selected = { r, f };
                legalTargets = calculateLegalMoves(r, f);
            } else {
                selected = null;
                legalTargets = [];
            }
            drawBoard();
        }
    }

    function calculateLegalMoves(r, f) {
        const p = board[r][f].piece;
        if (!p) return [];
        let targets = [];

        if (p.type === "p") {
            let dir = p.color === "w" ? -1 : 1;
            let startRow = p.color === "w" ? SIZE - 2 : 1;
            
            let nr = r + dir;
            if (nr >= 0 && nr < SIZE) {
                let targetCell = board[nr][f];
                // Blockers include Mountains, Forests, and Lakes
                if (!targetCell.piece && targetCell.terrain !== 1 && targetCell.terrain !== 2 && targetCell.terrain !== 4) {
                    targets.push({ r: nr, f: f });
                    
                    if (r === startRow) {
                        let nnr = r + (dir * 2);
                        let doubleCell = board[nnr][f];
                        if (!doubleCell.piece && doubleCell.terrain !== 1 && doubleCell.terrain !== 2 && doubleCell.terrain !== 4) {
                            targets.push({ r: nnr, f: f });
                        }
                    }
                }
            }
            
            let captureOffsets = [-1, 1];
            captureOffsets.forEach(fo => {
                let nf = f + fo;
                let cr = r + dir;
                if (cr >= 0 && cr < SIZE && nf >= 0 && nf < SIZE) {
                    let capCell = board[cr][nf];
                    if (capCell.piece && capCell.piece.color !== p.color && capCell.terrain !== 1 && capCell.terrain !== 2 && capCell.terrain !== 4) {
                        targets.push({ r: cr, f: nf });
                    }
                }
            });
        } else {
            let directions = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
            directions.forEach(d => {
                let nr = r + d[0], nf = f + d[1];
                if (nr >= 0 && nr < SIZE && nf >= 0 && nf < SIZE) {
                    let targetCell = board[nr][nf];
                    if (targetCell.terrain !== 1 && targetCell.terrain !== 2 && targetCell.terrain !== 4) {
                        if (!targetCell.piece || targetCell.piece.color !== p.color) {
                            targets.push({ r: nr, f: nf });
                        }
                    }
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

    function triggerSimpleAi() {
        let allMoves = [];
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                if (board[r][f].piece && board[r][f].piece.color === "b") {
                    let targets = calculateLegalMoves(r, f);
                    targets.forEach(t => allMoves.push({ sr: r, sf: f, tr: t.r, tf: t.f }));
                }
            }
        }

        if (allMoves.length > 0) {
            let pick = allMoves[Math.floor(Math.random() * allMoves.length)];
            executeMove(pick.sr, pick.sf, pick.tr, pick.tf);
        } else {
            gameOver = true;
            alert("Match Finished!");
        }
        drawBoard();
    }

    function init() {
        setupInitialBoardState();
        
        const aiToggle = document.getElementById("ai-toggle");
        if (aiToggle) aiToggle.checked = aiEnabled;

        const zoomSlider = document.getElementById("zoom-slider");
        if (zoomSlider) {
            zoomSlider.value = zoomPreset;
            zoomSlider.addEventListener("input", function (e) {
                zoomPreset = parseInt(e.target.value);
                panX = 0;
                panY = 0;
                updateCameraMatrix();
            });
        }

        // Functional Master Toggle for Zen Mode Switch
        const zenBtn = document.getElementById("btn-zen");
        if (zenBtn) {
            zenBtn.addEventListener("click", () => {
                hideAllUi = !hideAllUi;
                document.body.classList.toggle("zen-active", hideAllUi);
                zenBtn.classList.toggle("active-glow", hideAllUi);
            });
        }

        const resetBtn = document.getElementById("btn-reset");
        if (resetBtn) {
            resetBtn.addEventListener("click", () => {
                turn = "w";
                gameOver = false;
                selected = null;
                legalTargets = [];
                setupInitialBoardState();
                drawBoard();
            });
        }

        updateCameraMatrix();
        drawBoard();
    }

    document.addEventListener("DOMContentLoaded", init);
})();

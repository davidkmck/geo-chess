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
  
  // Dynamic Preset Matrix Camera State Machine:
  // 0 = Full board view including outer labels
  // 1 = Full board viewport only (labels hidden)
  // 2 = High Zoomed 8x8 responsive frame
  let zoomPreset = 0; 
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let startPanX = 0;
  let startPanY = 0;

  let showLegend = true;
  let showHistory = true;
  let isFlipped = false;

  // ---- History tracking ----
  let history = [];
  let moveLog = [];
  let currentIndex = 0;

  const BACK_RANK_FILES = { 3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R" };

  // ---- Terrain Rules Configurations ----
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

  function inBounds(r, f) { return r >= 0 && r < SIZE && f >= 0 && f < SIZE; }
  function pieceAt(b, r, f) { return b[r][f]; }

  // ---- Legality Move Generators ----
  function slideMoves(b, r, f, color, directions) {
    const myTerrain = terrain(r, f);
    const moves = [];

    if (isWater(myTerrain)) {
      for (const [dr, df] of directions) {
        const nr = r + dr, nf = f + df;
        if (!inBounds(nr, nf)) continue;
        const t = terrain(nr, nf);
        if (isImpassable(t)) continue;
        const occ = pieceAt(b, nr, nf);
        if (!occ) {
          moves.push({ r: nr, f: nf });
        } else if (occ.color !== color && canCapture(myTerrain, t)) {
          moves.push({ r: nr, f: nf });
        }
      }
      return moves;
    }

    for (const [dr, df] of directions) {
      let nr = r + dr, nf = f + df;
      while (inBounds(nr, nf)) {
        const t = terrain(nr, nf);
        if (isImpassable(t)) break; 

        const occ = pieceAt(b, nr, nf);
        if (!occ) {
          moves.push({ r: nr, f: nf });
          if (isWater(t)) break; 
        } else {
          if (occ.color !== color) moves.push({ r: nr, f: nf }); 
          break; 
        }
        nr += dr; nf += df;
      }
    }
    return moves;
  }

  const ROOK_DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
  const BISHOP_DIRS = [[1,1],[1,-1],[-1,1],[-1,-1]];
  const QUEEN_DIRS = ROOK_DIRS.concat(BISHOP_DIRS);
  const KNIGHT_OFFSETS = [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]];
  const KING_OFFSETS = QUEEN_DIRS;

  function generateMoves(b, r, f) {
    const piece = pieceAt(b, r, f);
    if (!piece) return [];
    const { type, color } = piece;
    switch (type) {
      case "R": return slideMoves(b, r, f, color, ROOK_DIRS);
      case "B": return slideMoves(b, r, f, color, BISHOP_DIRS);
      case "Q": return slideMoves(b, r, f, color, QUEEN_DIRS);
      case "N": {
        const moves = [];
        for (const [dr, df] of KNIGHT_OFFSETS) {
          const nr = r + dr, nf = f + df;
          if (!inBounds(nr, nf)) continue;
          if (isImpassable(terrain(nr, nf))) continue;
          const occ = pieceAt(b, nr, nf);
          if (!occ || occ.color !== color) moves.push({ r: nr, f: nf });
        }
        return moves;
      }
      case "K": {
        const myTerrain = terrain(r, f);
        const moves = [];
        for (const [dr, df] of KING_OFFSETS) {
          const nr = r + dr, nf = f + df;
          if (!inBounds(nr, nf)) continue;
          const t = terrain(nr, nf);
          if (isImpassable(t)) continue;
          const occ = pieceAt(b, nr, nf);
          if (!occ) moves.push({ r: nr, f: nf });
          else if (occ.color !== color && canCapture(myTerrain, t)) moves.push({ r: nr, f: nf });
        }
        if (!piece.moved) {
          for (const dir of [-1, 1]) {
            let nf = f + dir;
            while (inBounds(r, nf) && !pieceAt(b, r, nf)) nf += dir;
            if (!inBounds(r, nf)) continue;
            const maybeRook = pieceAt(b, r, nf);
            if (maybeRook && maybeRook.type === "R" && maybeRook.color === color && !maybeRook.moved) {
              const kingDest = f + 2 * dir;
              const rookDest = kingDest - dir;
              if (inBounds(r, kingDest) && inBounds(r, rookDest)) {
                moves.push({
                  r, f: kingDest,
                  castle: true,
                  rookFrom: { r, f: nf },
                  rookTo: { r, f: rookDest }
                });
              }
            }
          }
        }
        return moves;
      }
      case "P": {
        const moves = [];
        const myTerrain = terrain(r, f);
        const dir = color === "w" ? 1 : -1;
        const startRank = color === "w" ? 1 : SIZE - 2;
        const oneR = r + dir;

        if (inBounds(oneR, f)) {
          const tOne = terrain(oneR, f);
          if (!isImpassable(tOne) && !pieceAt(b, oneR, f)) {
            moves.push({ r: oneR, f });
            if (r === startRank && !isWater(myTerrain) && !isWater(tOne)) {
              const twoR = r + dir * 2;
              if (inBounds(twoR, f)) {
                const tTwo = terrain(twoR, f);
                if (!isImpassable(tTwo) && !isWater(tTwo) && !pieceAt(b, twoR, f)) {
                  moves.push({ r: twoR, f });
                }
              }
            }
          }
        }

        for (const df of [-1, 1]) {
          const nf = f + df;
          if (!inBounds(oneR, nf)) continue;
          const tDiag = terrain(oneR, nf);
          if (isImpassable(tDiag)) continue;
          const occ = pieceAt(b, oneR, nf);
          if (occ && occ.color !== color && canCapture(myTerrain, tDiag)) moves.push({ r: oneR, f: nf });
        }
        return moves;
      }
      default: return [];
    }
  }

  // ---- UI Setup Context Bindings ----
  const boardEl = document.getElementById("board");
  const ranksEl = document.getElementById("ranks");
  const filesEl = document.getElementById("files");
  const resetBtn = document.getElementById("resetBtn");
  const winOverlay = document.getElementById("winOverlay");
  const winMessage = document.getElementById("winMessage");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const moveLogEl = document.getElementById("moveLog");
  const aiToggle = document.getElementById("aiToggle");
  const aiDifficulty = document.getElementById("aiDifficulty");
  const aiThinkingEl = document.getElementById("aiThinking");

  const widgetW = document.getElementById("widget-w");
  const widgetB = document.getElementById("widget-b");

  const boardOuterEl = document.querySelector(".board-outer");
  const miniMapEl = document.getElementById("miniMap");
  const miniMapViewportEl = document.getElementById("miniMapViewport");

  const zoomSlider = document.getElementById("zoomSlider");
  const toggleLegendBtn = document.getElementById("toggleLegendBtn");
  const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");

  const GLYPHS = { R: "♜", N: "♞", B: "♝", Q: "♛", K: "♚", P: "♟" };

  function buildLabels() {
    ranksEl.innerHTML = "";
    filesEl.innerHTML = "";
    
    if (zoomPreset === 1 || zoomPreset === 2) {
      ranksEl.style.display = "none";
      filesEl.style.display = "none";
      return;
    }

    ranksEl.style.display = "flex";
    filesEl.style.display = "flex";

    const range = Array.from({length: SIZE}, (_, i) => i);
    const rankOrder = isFlipped ? range : [...range].reverse();
    const fileOrder = isFlipped ? [...range].reverse() : range;

    rankOrder.forEach(r => {
      const span = document.createElement("span");
      span.textContent = r + 1;
      ranksEl.appendChild(span);
    });

    fileOrder.forEach(f => {
      const span = document.createElement("span");
      span.textContent = FILES[f];
      filesEl.appendChild(span);
    });
  }

  function isLegalTarget(r, f) {
    return legalTargets.some((m) => m.r === r && m.f === f);
  }

  function render() {
    boardEl.innerHTML = "";
    const activeSnapshot = history[currentIndex];
    const lm = activeSnapshot ? activeSnapshot.lastMove : null;

    for (let i = 0; i < SIZE; i++) {
      const r = isFlipped ? i : (SIZE - 1 - i);
      for (let j = 0; j < SIZE; j++) {
        const f = isFlipped ? (SIZE - 1 - j) : j;
        
        const cell = document.createElement("div");
        const t = terrain(r, f);
        let cls = "cell " + (((r + f) % 2 === 0) ? "dark" : "light");
        if (t !== "plain") cls += " terrain-" + t;
        if (isHomeRank(r)) cls += " home-rank";
        
        let isLastMoveTarget = false;
        if (lm) {
          if (lm.from.r === r && lm.from.f === f) cls += " last-move-source";
          if (lm.to.r === r && lm.to.f === f) {
            cls += " last-move-target";
            isLastMoveTarget = true;
          }
        }

        cell.className = cls;
        cell.dataset.r = r;
        cell.dataset.f = f;

        if (selected && selected.r === r && selected.f === f) cell.classList.add("selected");
        if (isLegalTarget(r, f)) {
          cell.classList.add(pieceAt(board, r, f) ? "legal-capture" : "legal-move");
        }

        const piece = pieceAt(board, r, f);
        if (piece) {
          const span = document.createElement("span");
          span.className = "piece " + (piece.color === "w" ? "white" : "black");
          if (isLastMoveTarget) span.classList.add("last-moved-piece");
          span.textContent = GLYPHS[piece.type];
          cell.appendChild(span);
        }

        cell.addEventListener("pointerdown", onPointerDown);
        cell.addEventListener("pointermove", onPointerMove);
        cell.addEventListener("pointerup", onPointerUp);
        cell.addEventListener("pointercancel", onPointerCancel);
        boardEl.appendChild(cell);
      }
    }

    if (turn === "w") {
      if (widgetW) widgetW.classList.add("active");
      if (widgetB) widgetB.classList.remove("active");
    } else {
      if (widgetB) widgetB.classList.add("active");
      if (widgetW) widgetW.classList.remove("active");
    }

    boardEl.className = "board " + (turn === "w" ? "turn-w" : "turn-b");

    // Enforce Hide/Show Structural Logic Toggles
    const legendEl = document.querySelector(".legend-card");
    if (legendEl) legendEl.style.display = showLegend ? "block" : "none";
    
    const moveHistoryContainer = moveLogEl.closest(".panel-card");
    if (moveHistoryContainer) moveHistoryContainer.style.display = showHistory ? "block" : "none";

    updateBoardTransform();

    if (gameOver) {
      winMessage.textContent = gameOverText;
      winOverlay.classList.remove("hidden");
    } else {
      winOverlay.classList.add("hidden");
    }

    undoBtn.disabled = currentIndex <= 0;
    redoBtn.disabled = currentIndex >= history.length - 1;
    renderMoveLog();
  }

  function renderMoveLog() {
    moveLogEl.innerHTML = "";
    const startItem = document.createElement("li");
    startItem.textContent = "Start";
    startItem.dataset.index = "0";
    if (currentIndex === 0) startItem.classList.add("active");
    moveLogEl.appendChild(startItem);

    moveLog.forEach((desc, i) => {
      const item = document.createElement("li");
      const plyNumber = i + 1;
      const mover = i % 2 === 0 ? "w" : "b";
      item.textContent = `${plyNumber}${mover === "w" ? "." : "…"} ${desc}`;
      item.dataset.index = String(i + 1);
      if (currentIndex === i + 1) item.classList.add("active");
      moveLogEl.appendChild(item);
    });

    const active = moveLogEl.querySelector(".active");
    if (active && active.scrollIntoView) {
      try { active.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (err) {}
    }
  }

  // ---- Dynamic Viewport Matrix Transforms & Mini-Map Sync ----
  function updateBoardTransform() {
    // Zoom configurations: Preset 0 & 1 scale = 1.0; Preset 2 scale = 14 / 8 = 1.75
    const activeScale = zoomPreset === 2 ? 1.75 : 1;

    const outerRect = boardOuterEl.getBoundingClientRect();
    const minX = outerRect.width - (outerRect.width * activeScale);
    const minY = outerRect.height - (outerRect.height * activeScale);

    if (zoomPreset === 2) {
      panX = Math.min(0, Math.max(panX, minX));
      panY = Math.min(0, Math.max(panY, minY));
    } else {
      // Anchors coordinates perfectly at 0 when unzoomed to prevent displacement
      panX = 0;
      panY = 0;
    }

    boardEl.style.transform = `translate(${panX}px, ${panY}px) scale(${activeScale})`;
    updateMiniMap(activeScale);
  }

  function updateMiniMap(activeScale) {
    if (!miniMapEl || !miniMapViewportEl) return;
    if (zoomPreset !== 2) {
      miniMapEl.classList.add("hidden");
      return;
    }
    miniMapEl.classList.remove("hidden");

    // Invert scale percentages to accurately track viewport bounding box bounds
    const widthPct = 100 / activeScale;
    const heightPct = 100 / activeScale;

    const outerRect = boardOuterEl.getBoundingClientRect();
    const maxPanX = (outerRect.width * activeScale) - outerRect.width;
    const maxPanY = (outerRect.height * activeScale) - outerRect.height;

    const leftPct = maxPanX > 0 ? (Math.abs(panX) / maxPanX) * (100 - widthPct) : 0;
    const topPct = maxPanY > 0 ? (Math.abs(panY) / maxPanY) * (100 - heightPct) : 0;

    miniMapViewportEl.style.width = `${widthPct}%`;
    miniMapViewportEl.style.height = `${heightPct}%`;
    miniMapViewportEl.style.left = `${leftPct}%`;
    miniMapViewportEl.style.top = `${topPct}%`;
  }

  // ---- Native Dragging and Gesture Controls Engine ----
  const DRAG_THRESHOLD = 6; 
  let dragCandidate = null; 

  function clearDragVisuals() {
    if (dragCandidate && dragCandidate.ghost) dragCandidate.ghost.remove();
    boardEl.querySelectorAll(".dragging-source").forEach((el) => el.classList.remove("dragging-source"));
  }

  function createGhost(pieceEl, cellRect, clientX, clientY) {
    const ghost = document.createElement("div");
    ghost.className = "drag-ghost piece " + (pieceEl.classList.contains("white") ? "white" : "black");
    ghost.textContent = pieceEl.textContent;
    ghost.style.width = cellRect.width + "px";
    ghost.style.height = cellRect.height + "px";
    ghost.style.fontSize = cellRect.width * 0.74 + "px";
    positionGhost(ghost, cellRect, clientX, clientY);
    document.body.appendChild(ghost);
    return ghost;
  }

  function positionGhost(ghost, cellRect, clientX, clientY) {
    ghost.style.transform = `translate(${clientX - cellRect.width / 2}px, ${clientY - cellRect.height / 2}px)`;
  }

  function onPointerDown(e) {
    if (gameOver || dragCandidate) return;
    const r = Number(e.currentTarget.dataset.r);
    const f = Number(e.currentTarget.dataset.f);

    if (selected && !(selected.r === r && selected.f === f)) {
      const move = legalTargets.find((m) => m.r === r && m.f === f);
      if (move) {
        const fromR = selected.r, fromF = selected.f;
        selected = null;
        legalTargets = [];
        makeMove(fromR, fromF, move);
        maybeTriggerAI();
        return;
      }
    }

    const piece = pieceAt(board, r, f);
    if (piece && piece.color === turn) {
      const wasAlreadySelected = selected && selected.r === r && selected.f === f;
      selected = { r, f };
      legalTargets = generateMoves(board, r, f);
      render();

      const cell = e.currentTarget;
      const pieceEl = cell.querySelector(".piece");
      dragCandidate = {
        r, f,
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        moved: false,
        wasAlreadySelected,
        ghost: null,
        cellRect: cell.getBoundingClientRect(),
        pieceEl
      };
      if (cell.setPointerCapture) {
        try { cell.setPointerCapture(e.pointerId); } catch (err) {}
      }
    } else {
      selected = null;
      legalTargets = [];
      render();
    }
  }

  function onPointerMove(e) {
    if (!dragCandidate || e.pointerId !== dragCandidate.pointerId) return;
    const dx = e.clientX - dragCandidate.startX;
    const dy = e.clientY - dragCandidate.startY;

    if (!dragCandidate.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) {
      dragCandidate.moved = true;
      if (dragCandidate.pieceEl) {
        dragCandidate.pieceEl.closest(".cell").classList.add("dragging-source");
        dragCandidate.ghost = createGhost(dragCandidate.pieceEl, dragCandidate.cellRect, e.clientX, e.clientY);
      }
    }
    if (dragCandidate.moved && dragCandidate.ghost) {
      positionGhost(dragCandidate.ghost, dragCandidate.cellRect, e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    if (!dragCandidate || e.pointerId !== dragCandidate.pointerId) return;
    const { r, f, moved, wasAlreadySelected } = dragCandidate;

    if (moved) {
      clearDragVisuals();
      const dropEl = document.elementFromPoint(e.clientX, e.clientY);
      const dropCell = dropEl ? dropEl.closest(".cell") : null;
      dragCandidate = null;
      if (dropCell) {
        const dr = Number(dropCell.dataset.r);
        const df = Number(dropCell.dataset.f);
        const move = legalTargets.find((m) => m.r === dr && m.f === df);
        if (move) {
          selected = null;
          legalTargets = [];
          makeMove(r, f, move);
          maybeTriggerAI();
          return;
        }
      }
      selected = null;
      legalTargets = [];
      render();
      return;
    }

    dragCandidate = null;
    if (wasAlreadySelected) {
      selected = null;
      legalTargets = [];
      render();
    }
  }

  function onPointerCancel(e) {
    if (!dragCandidate || e.pointerId !== dragCandidate.pointerId) return;
    clearDragVisuals();
    dragCandidate = null;
    selected = null;
    legalTargets = [];
    render();
  }

  // ---- Viewport Matrix Linear Touch Panning Handler (8x8 Only) ----
  boardOuterEl.addEventListener("touchstart", (e) => {
    if (zoomPreset === 2 && e.touches.length === 1) {
      const targetCell = e.touches[0].target.closest(".cell");
      const hasFriendlyPiece = targetCell && pieceAt(board, Number(targetCell.dataset.r), Number(targetCell.dataset.f))?.color === turn;
      
      if (!hasFriendlyPiece) {
        isPanning = true;
        startPanX = e.touches[0].clientX - panX;
        startPanY = e.touches[0].clientY - panY;
      }
    }
  }, { passive: true });

  boardOuterEl.addEventListener("touchmove", (e) => {
    if (isPanning && zoomPreset === 2 && e.touches.length === 1) {
      panX = e.touches[0].clientX - startPanX;
      panY = e.touches[0].clientY - startPanY;
      updateBoardTransform();
    }
  }, { passive: true });

  boardOuterEl.addEventListener("touchend", () => { isPanning = false; }, { passive: true });

  // ---- Mouse Navigation Panning Backups ----
  boardOuterEl.addEventListener("mousedown", (e) => {
    if (zoomPreset === 2) {
      const targetCell = e.target.closest(".cell");
      const hasFriendlyPiece = targetCell && pieceAt(board, Number(targetCell.dataset.r), Number(targetCell.dataset.f))?.color === turn;
      if (!hasFriendlyPiece || e.button === 2) { 
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
      }
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning || zoomPreset !== 2) return;
    panX = e.clientX - startPanX;
    panY = e.clientY - startPanY;
    updateBoardTransform();
  });

  window.addEventListener("mouseup", () => { isPanning = false; });
  boardOuterEl.addEventListener("contextmenu", e => { if(zoomPreset === 2) e.preventDefault(); });

  // ---- AI Engine ----
  const PIECE_VALUE = { P: 100, N: 300, B: 300, R: 500, Q: 900, K: 100000 };

  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let f = 0; f < SIZE; f++) {
        const p = b[r][f];
        if (!p) continue;
        let v = PIECE_VALUE[p.type];
        if (p.type !== "K" && p.type !== "P") {
          const dist = Math.abs(r - 6.5) + Math.abs(f - 6.5);
          v += (13 - dist) * 2;
        }
        score += p.color === "w" ? v : -v;
      }
    }
    return score;
  }

  function allLegalMoves(b, color) {
    const out = [];
    for (let r = 0; r < SIZE; r++) {
      for (let f = 0; f < SIZE; f++) {
        const p = b[r][f];
        if (p && p.color === color) {
          const moves = generateMoves(b, r, f);
          for (const m of moves) out.push({ from: { r, f }, move: m });
        }
      }
    }
    return out;
  }

  function cloneBoard(b) { return JSON.parse(JSON.stringify(b)); }

  function applyMoveToBoard(b, from, move) {
    const moving = b[from.r][from.f];
    b[move.r][move.f] = moving;
    b[from.r][from.f] = null;
    moving.moved = true;
    if (move.castle) {
      const rook = b[move.rookFrom.r][move.rookFrom.f];
      b[move.rookTo.r][move.rookTo.f] = rook;
      b[move.rookFrom.r][move.rookFrom.f] = null;
      rook.moved = true;
    }
    if (moving.type === "P") {
      const lastRank = moving.color === "w" ? SIZE - 1 : 0;
      if (move.r === lastRank) moving.type = "Q";
    }
    return b;
  }

  function orderMoves(b, moves) {
    return moves
      .map((m) => {
        const captured = b[m.move.r][m.move.f];
        return { m, score: captured ? PIECE_VALUE[captured.type] : 0 };
      })
      .sort((a, b2) => b2.score - a.score)
      .map((x) => x.m);
  }

  function minimax(b, depth, alpha, beta, colorToMove) {
    if (depth === 0) return { score: evaluate(b) };
    const moves = orderMoves(b, allLegalMoves(b, colorToMove));
    if (moves.length === 0) return { score: evaluate(b) };

    let bestScore = colorToMove === "w" ? -Infinity : Infinity;
    let bestMove = null;

    for (const mv of moves) {
      const captured = b[mv.move.r][mv.move.f];
      let score;
      if (captured && captured.type === "K") {
        score = colorToMove === "w" ? 999999 : -999999;
      } else {
        const child = applyMoveToBoard(cloneBoard(b), mv.from, mv.move);
        score = minimax(child, depth - 1, alpha, beta, colorToMove === "w" ? "b" : "w").score;
      }

      if (colorToMove === "w") {
        if (score > bestScore) { bestScore = score; bestMove = mv; }
        alpha = Math.max(alpha, score);
      } else {
        if (score < bestScore) { bestScore = score; bestMove = mv; }
        beta = Math.min(beta, score);
      }
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }

  let aiEnabled = false;
  const aiColor = "b";
  let aiDepth = 2;
  let aiThinking = false;

  function updateAIThinkingUI(thinking) {
    if (aiThinkingEl) aiThinkingEl.classList.toggle("hidden", !thinking);
  }

  function maybeTriggerAI() {
    if (!aiEnabled || gameOver || turn !== aiColor || aiThinking) return;
    aiThinking = true;
    updateAIThinkingUI(true);
    const expectedIndex = currentIndex;

    requestAnimationFrame(() => {
      setTimeout(() => {
        let result = null;
        try {
          result = minimax(cloneBoard(board), aiDepth, -Infinity, Infinity, aiColor);
        } catch (err) {
          result = null;
        }
        
        aiThinking = false;
        updateAIThinkingUI(false);

        if (currentIndex !== expectedIndex || gameOver || turn !== aiColor) return;
        if (!result || !result.move) return;

        animateAndMakeMove(result.move.from.r, result.move.from.f, result.move.move);
      }, 50);
    });
  }

  function pieceLabel(type) {
    return type === "N" ? "N" : type === "P" ? "" : type;
  }

  function describeMove(fr, ff, move, movingType, movingColor, captured, wasPromotion) {
    if (move.castle) return move.f > ff ? "O-O" : "O-O-O";
    const from = FILES[ff] + (fr + 1);
    const to = FILES[move.f] + (move.r + 1);
    const sep = captured ? "x" : "-";
    let s = pieceLabel(movingType) + from + sep + to;
    if (wasPromotion) s += "=Q";
    return s;
  }

  // ---- Smooth Sliding Animation Engine ----
  function animateAndMakeMove(fr, ff, move) {
    const sourceCell = boardEl.querySelector(`[data-r="${fr}"][data-f="${ff}"]`);
    const targetCell = boardEl.querySelector(`[data-r="${move.r}"][data-f="${move.f}"]`);
    
    if (!sourceCell || !targetCell) {
      makeMove(fr, ff, move);
      return;
    }

    const pieceSpan = sourceCell.querySelector(".piece");
    if (!pieceSpan) {
      makeMove(fr, ff, move);
      return;
    }

    const sourceRect = sourceCell.getBoundingClientRect();
    const targetRect = targetCell.getBoundingClientRect();

    const deltaX = (targetRect.left + targetRect.width / 2) - (sourceRect.left + sourceRect.width / 2);
    const deltaY = (targetRect.top + targetRect.height / 2) - (sourceRect.top + sourceRect.height / 2);

    pieceSpan.style.zIndex = "100";
    pieceSpan.style.transition = "transform 400ms cubic-bezier(0.25, 1, 0.5, 1)";
    pieceSpan.style.transform = `translate(${deltaX}px, ${deltaY}px)`;

    pieceSpan.addEventListener("transitionend", function handler() {
      pieceSpan.removeEventListener("transitionend", handler);
      makeMove(fr, ff, move);
    }, { once: true });
  }

  function makeMove(fr, ff, move) {
    const tr = move.r, tf = move.f;
    const moving = board[fr][ff];
    if (!moving) return;
    
    const movingType = moving.type;
    const movingColor = moving.color;
    const captured = board[tr][tf];

    board[tr][tf] = moving;
    board[fr][ff] = null;
    moving.moved = true;

    if (move.castle) {
      const rook = board[move.rookFrom.r][move.rookFrom.f];
      board[move.rookTo.r][move.rookTo.f] = rook;
      board[move.rookFrom.r][move.rookFrom.f] = null;
      rook.moved = true;
    }

    let wasPromotion = false;
    if (moving.type === "P") {
      const lastRank = moving.color === "w" ? SIZE - 1 : 0;
      if (tr === lastRank) {
        moving.type = "Q";
        wasPromotion = true;
      }
    }

    const desc = describeMove(fr, ff, move, movingType, movingColor, captured, wasPromotion);

    if (captured && captured.type === "K") {
      gameOver = true;
      gameOverText = (movingColor === "w" ? "White" : "Black") + " wins";
    } else {
      turn = turn === "w" ? "b" : "w";
    }

    commitHistory(desc, { from: { r: fr, f: ff }, to: { r: tr, f: tf } });
  }

  // ---- State Synchronizations ----
  function snapshot(lastMoveObj = null) {
    return {
      board: JSON.parse(JSON.stringify(board)),
      turn,
      gameOver,
      gameOverText,
      lastMove: lastMoveObj
    };
  }

  function loadSnapshot(snap) {
    board = JSON.parse(JSON.stringify(snap.board));
    turn = snap.turn;
    gameOver = snap.gameOver;
    gameOverText = snap.gameOverText;
    selected = null;
    legalTargets = [];
  }

  function commitHistory(desc, lastMoveObj = null) {
    history = history.slice(0, currentIndex + 1);
    moveLog = moveLog.slice(0, currentIndex);
    history.push(snapshot(lastMoveObj));
    moveLog.push(desc);
    currentIndex = history.length - 1;
    render();
  }

  function goToIndex(i) {
    if (i < 0 || i >= history.length) return;
    currentIndex = i;
    loadSnapshot(history[currentIndex]);
    render();
  }

  function undo() { goToIndex(currentIndex - 1); }
  function redo() { goToIndex(currentIndex + 1); }

  function resetGame() {
    board = freshBoard();
    turn = "w";
    selected = null;
    legalTargets = [];
    gameOver = false;
    gameOverText = "";
    panX = 0;
    panY = 0;
    history = [snapshot(null)];
    moveLog = [];
    currentIndex = 0;
    render();
  }

  // ---- Event Interaction Mappings ----
  zoomSlider.addEventListener("input", (e) => {
    zoomPreset = Number(e.target.value);
    panX = 0;
    panY = 0;
    buildLabels();
    render();
  });

  toggleLegendBtn.addEventListener("click", () => {
    showLegend = !showLegend;
    toggleLegendBtn.innerHTML = showLegend ? "🗺️ Hide Legend" : "🗺️ Show Legend";
    render();
  });

  toggleHistoryBtn.addEventListener("click", () => {
    showHistory = !showHistory;
    toggleHistoryBtn.innerHTML = showHistory ? "📜 Hide History" : "📜 Show History";
    render();
  });

  resetBtn.addEventListener("click", resetGame);
  playAgainBtn.addEventListener("click", resetGame);
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  
  moveLogEl.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    goToIndex(Number(li.dataset.index));
  });
  
  aiToggle.addEventListener("change", () => {
    aiEnabled = aiToggle.checked;
    maybeTriggerAI();
  });
  
  aiDifficulty.addEventListener("change", () => {
    aiDepth = Number(aiDifficulty.value);
  });

  buildLabels();
  resetGame();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();

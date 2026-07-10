(function () {
  "use strict";

  const SIZE = 14;
  const FILES = "abcdefghijklmn".split("");

  // ---- Board state ----
  // board[rank][file], rank 0 = rank "1" (White's home), rank 13 = rank "14" (Black's home)
  // piece: { type: 'R'|'N'|'B'|'Q'|'K'|'P', color: 'w'|'b' }
  let board = [];
  let turn = "w";
  let selected = null; // {r, f}
  let legalTargets = []; // [{r,f}]
  let gameOver = false;
  let gameOverText = "";

  // ---- History (undo/redo + jump-to-any-point) ----
  // history[i] is a full snapshot of the game state after i plies have been
  // played (history[0] is the starting position). moveLog[i] describes the
  // move that produced history[i+1] from history[i].
  let history = [];
  let moveLog = [];
  let currentIndex = 0;

  const BACK_RANK_FILES = { 3: "R", 4: "N", 5: "B", 6: "Q", 7: "K", 8: "B", 9: "N", 10: "R" };

  function freshBoard() {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    for (let f = 0; f < SIZE; f++) {
      // White back rank + pawns
      if (BACK_RANK_FILES[f]) b[0][f] = { type: BACK_RANK_FILES[f], color: "w", moved: false };
      b[1][f] = { type: "P", color: "w", moved: false };
      // Black back rank + pawns
      b[SIZE - 2][f] = { type: "P", color: "b", moved: false };
      if (BACK_RANK_FILES[f]) b[SIZE - 1][f] = { type: BACK_RANK_FILES[f], color: "b", moved: false };
    }
    return b;
  }

  function inBounds(r, f) {
    return r >= 0 && r < SIZE && f >= 0 && f < SIZE;
  }

  function pieceAt(r, f) {
    return board[r][f];
  }

  // ---- Move generation (no terrain, no check/castling/en-passant filtering) ----
  function slideMoves(r, f, color, directions) {
    const moves = [];
    for (const [dr, df] of directions) {
      let nr = r + dr, nf = f + df;
      while (inBounds(nr, nf)) {
        const occ = pieceAt(nr, nf);
        if (!occ) {
          moves.push({ r: nr, f: nf });
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

  function generateMoves(r, f) {
    const piece = pieceAt(r, f);
    if (!piece) return [];
    const { type, color } = piece;
    switch (type) {
      case "R": return slideMoves(r, f, color, ROOK_DIRS);
      case "B": return slideMoves(r, f, color, BISHOP_DIRS);
      case "Q": return slideMoves(r, f, color, QUEEN_DIRS);
      case "N": {
        const moves = [];
        for (const [dr, df] of KNIGHT_OFFSETS) {
          const nr = r + dr, nf = f + df;
          if (!inBounds(nr, nf)) continue;
          const occ = pieceAt(nr, nf);
          if (!occ || occ.color !== color) moves.push({ r: nr, f: nf });
        }
        return moves;
      }
      case "K": {
        const moves = [];
        for (const [dr, df] of KING_OFFSETS) {
          const nr = r + dr, nf = f + df;
          if (!inBounds(nr, nf)) continue;
          const occ = pieceAt(nr, nf);
          if (!occ || occ.color !== color) moves.push({ r: nr, f: nf });
        }
        // Castling: works regardless of how many squares separate king and
        // rook — the king always moves two squares, the rook always lands on
        // the square the king passed over. Requires neither piece has moved,
        // and every square between them is empty. (No check-safety filtering
        // yet, consistent with this prototype skipping check detection.)
        if (!piece.moved) {
          for (const dir of [-1, 1]) {
            let nf = f + dir;
            while (inBounds(r, nf) && !pieceAt(r, nf)) nf += dir;
            if (!inBounds(r, nf)) continue;
            const maybeRook = pieceAt(r, nf);
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
        const dir = color === "w" ? 1 : -1;
        const startRank = color === "w" ? 1 : SIZE - 2;
        const oneR = r + dir;
        if (inBounds(oneR, f) && !pieceAt(oneR, f)) {
          moves.push({ r: oneR, f });
          const twoR = r + dir * 2;
          if (r === startRank && inBounds(twoR, f) && !pieceAt(twoR, f)) {
            moves.push({ r: twoR, f });
          }
        }
        for (const df of [-1, 1]) {
          const nf = f + df;
          if (!inBounds(oneR, nf)) continue;
          const occ = pieceAt(oneR, nf);
          if (occ && occ.color !== color) moves.push({ r: oneR, f: nf });
        }
        return moves;
      }
      default: return [];
    }
  }

  // ---- Rendering ----
  const boardEl = document.getElementById("board");
  const ranksEl = document.getElementById("ranks");
  const filesEl = document.getElementById("files");
  const turnIndicator = document.getElementById("turnIndicator");
  const resetBtn = document.getElementById("resetBtn");
  const winOverlay = document.getElementById("winOverlay");
  const winMessage = document.getElementById("winMessage");
  const playAgainBtn = document.getElementById("playAgainBtn");
  const undoBtn = document.getElementById("undoBtn");
  const redoBtn = document.getElementById("redoBtn");
  const moveLogEl = document.getElementById("moveLog");

  // Both colors render with the same solid silhouette glyphs (the "white" chess
  // Unicode characters are hollow outlines in most fonts, which lets the dark
  // square bleed through their interior — using solid shapes for both and
  // coloring them via CSS keeps white pieces genuinely opaque.
  const GLYPHS = { R: "\u265C", N: "\u265E", B: "\u265D", Q: "\u265B", K: "\u265A", P: "\u265F" };

  function buildLabels() {
    ranksEl.innerHTML = "";
    for (let r = 0; r < SIZE; r++) {
      const span = document.createElement("span");
      span.textContent = r + 1;
      ranksEl.appendChild(span);
    }
    filesEl.innerHTML = "";
    for (let f = 0; f < SIZE; f++) {
      const span = document.createElement("span");
      span.textContent = FILES[f];
      filesEl.appendChild(span);
    }
  }

  function isLegalTarget(r, f) {
    return legalTargets.some((m) => m.r === r && m.f === f);
  }

  function render() {
    boardEl.innerHTML = "";
    // top rank (13) rendered first so rank 1 ends up at bottom visually
    for (let r = SIZE - 1; r >= 0; r--) {
      for (let f = 0; f < SIZE; f++) {
        const cell = document.createElement("div");
        cell.className = "cell " + (((r + f) % 2 === 0) ? "dark" : "light");
        cell.dataset.r = r;
        cell.dataset.f = f;

        if (selected && selected.r === r && selected.f === f) {
          cell.classList.add("selected");
        }
        if (isLegalTarget(r, f)) {
          cell.classList.add(pieceAt(r, f) ? "legal-capture" : "legal-move");
        }

        const piece = pieceAt(r, f);
        if (piece) {
          const span = document.createElement("span");
          span.className = "piece " + (piece.color === "w" ? "white" : "black");
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

    turnIndicator.innerHTML = `<span class="turn-dot"></span>${turn === "w" ? "White" : "Black"} to move`;
    turnIndicator.className = "turn-pill " + (turn === "w" ? "turn-w" : "turn-b");
    boardEl.className = "board " + (turn === "w" ? "turn-w" : "turn-b");

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

  // ---- Interaction: tap-to-select-then-tap-to-move, and drag-and-drop ----
  // Both are driven from the same pointer events. A pointerdown on your own
  // piece both (a) selects it, exactly like a tap, and (b) arms a drag
  // candidate. If the pointer moves past a small threshold before release,
  // it becomes a drag; otherwise release is treated as a plain tap.
  const DRAG_THRESHOLD = 6; // px
  let dragCandidate = null; // {r, f, pointerId, startX, startY, moved, ghost, cellRect}

  function clearDragVisuals() {
    if (dragCandidate && dragCandidate.ghost) {
      dragCandidate.ghost.remove();
    }
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

    // Tapping a highlighted destination while something else is selected:
    // execute the move immediately, no drag involved.
    if (selected && !(selected.r === r && selected.f === f)) {
      const move = legalTargets.find((m) => m.r === r && m.f === f);
      if (move) {
        const fromR = selected.r, fromF = selected.f;
        selected = null;
        legalTargets = [];
        makeMove(fromR, fromF, move);
        return;
      }
    }

    const piece = pieceAt(r, f);
    if (piece && piece.color === turn) {
      const wasAlreadySelected = selected && selected.r === r && selected.f === f;
      selected = { r, f };
      legalTargets = generateMoves(r, f);
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
          return;
        }
      }
      selected = null;
      legalTargets = [];
      render();
      return;
    }

    // Plain tap release (no drag): tapping an already-selected piece deselects it.
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

  function pieceLabel(type) {
    return type === "N" ? "N" : type === "P" ? "" : type;
  }

  function describeMove(fr, ff, move, movingType, movingColor, captured, wasPromotion) {
    if (move.castle) {
      return move.f > ff ? "O-O" : "O-O-O";
    }
    const from = FILES[ff] + (fr + 1);
    const to = FILES[move.f] + (move.r + 1);
    const sep = captured ? "x" : "-";
    let s = pieceLabel(movingType) + from + sep + to;
    if (wasPromotion) s += "=Q";
    return s;
  }

  function makeMove(fr, ff, move) {
    const tr = move.r, tf = move.f;
    const moving = board[fr][ff];
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

    // auto-promotion at the far rank
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

    commitHistory(desc);
  }

  function snapshot() {
    return {
      board: JSON.parse(JSON.stringify(board)),
      turn,
      gameOver,
      gameOverText
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

  function commitHistory(desc) {
    // Making a move after undoing discards any redo-able future.
    history = history.slice(0, currentIndex + 1);
    moveLog = moveLog.slice(0, currentIndex);
    history.push(snapshot());
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
    history = [snapshot()];
    moveLog = [];
    currentIndex = 0;
    render();
  }

  resetBtn.addEventListener("click", resetGame);
  playAgainBtn.addEventListener("click", resetGame);
  undoBtn.addEventListener("click", undo);
  redoBtn.addEventListener("click", redo);
  moveLogEl.addEventListener("click", (e) => {
    const li = e.target.closest("li");
    if (!li) return;
    goToIndex(Number(li.dataset.index));
  });

  buildLabels();
  resetGame();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();

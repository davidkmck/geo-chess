(function () {
    "use strict";

    const SIZE = 14;
    let board = [];
    let turn = "w";
    let selected = null;
    let legalTargets = [];

    const PIECES = {
        w: { r: "♖", n: "♘", b: "♗", q: "♕", k: "♔", p: "♙" },
        b: { r: "♜", n: "♞", b: "♝", q: "♛", k: "♚", p: "♟" }
    };

    function setupBoard() {
        board = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null).map(() => ({ piece: null })));
        for (let f = 1; f <= 12; f++) {
            board[0][f].piece = { type: "r", color: "b" };
            board[1][f].piece = { type: "p", color: "b" };
            board[SIZE - 2][f].piece = { type: "p", color: "w" };
            board[SIZE - 1][f].piece = { type: "r", color: "w" };
        }
    }

    function drawBoard() {
        const boardEl = document.getElementById("board");
        if (!boardEl) return;
        boardEl.innerHTML = "";
        
        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const cell = document.createElement("div");
                cell.className = `cell ${(r + f) % 2 === 0 ? 'light' : 'dark'}`;
                if (board[r][f].piece) {
                    const p = document.createElement("span");
                    p.className = `piece ${board[r][f].piece.color}`;
                    p.textContent = PIECES[board[r][f].piece.color][board[r][f].piece.type];
                    cell.appendChild(p);
                }
                boardEl.appendChild(cell);
            }
        }
    }

    window.onload = () => {
        setupBoard();
        drawBoard();
    };
})();

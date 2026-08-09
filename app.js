// Piece Glyphs
const PIECES = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

// Terrain Types: 'mountain', 'lake', 'river'
// Movement Rules: Mountains & Lakes block all piece movement and line-of-sight. Rivers are crossable.
let terrainMap = {}; 

const LANDMARKS = {
    none: {},
    riverside: {
        'd3': 'river', 'e3': 'river',
        'd4': 'river', 'e4': 'river',
        'c5': 'river', 'f5': 'river'
    },
    twinHills: {
        'c3': 'mountain', 'f3': 'mountain',
        'c6': 'mountain', 'f6': 'mountain'
    },
    oasis: {
        'd4': 'lake', 'e4': 'lake',
        'd5': 'river', 'e5': 'river'
    },
    archipelago: {
        'c3': 'lake', 'f3': 'lake',
        'd6': 'lake', 'e6': 'lake',
        'a4': 'river', 'h5': 'river'
    },
    greatRidge: {
        'd2': 'mountain', 'd3': 'mountain', 'd4': 'mountain', 'd5': 'mountain',
        'e4': 'mountain', 'e5': 'mountain', 'e6': 'mountain', 'e7': 'mountain'
    },
    crossroads: {
        'd1': 'river', 'd2': 'river', 'd3': 'river', 'd4': 'river', 'd5': 'river', 'd6': 'river', 'd7': 'river', 'd8': 'river',
        'a4': 'river', 'b4': 'river', 'c4': 'river', 'e4': 'river', 'f4': 'river', 'g4': 'river', 'h4': 'river'
    },
    canyon: {
        'c2': 'mountain', 'c3': 'mountain', 'c4': 'mountain', 'c5': 'mountain',
        'f3': 'mountain', 'f4': 'mountain', 'f5': 'mountain', 'f6': 'mountain'
    },
    islands: {
        'b2': 'lake', 'g2': 'lake',
        'd4': 'mountain', 'e5': 'mountain',
        'b7': 'lake', 'g7': 'lake'
    }
};

let board = [];
let turn = 'w'; // 'w' or 'b'
let selectedSquare = null;
let validMoves = [];
let gameOver = false;
let gameMode = 'medium'; // 'none', 'easy', 'medium'
let moveHistory = [];

// Initialize Standard Chess Setup
function initBoard() {
    board = [
        ['br','bn','bb','bq','bk','bb','bn','br'],
        ['bp','bp','bp','bp','bp','bp','bp','bp'],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        [null,null,null,null,null,null,null,null],
        ['wp','wp','wp','wp','wp','wp','wp','wp'],
        ['wr','wn','wb','wq','wk','wb','wn','wr']
    ];
    turn = 'w';
    selectedSquare = null;
    validMoves = [];
    gameOver = false;
    moveHistory = [];
}

function getSquareName(r, c) {
    return String.fromCharCode(97 + c) + (8 - r);
}

function setLandmark(type) {
    terrainMap = LANDMARKS[type] || {};
}

// Raycasting movement check
function isValidLineOfSight(r1, c1, r2, c2) {
    let dr = Math.sign(r2 - r1);
    let dc = Math.sign(c2 - c1);
    let currR = r1 + dr;
    let currC = c1 + dc;

    while (currR !== r2 || currC !== c2) {
        let sqName = getSquareName(currR, currC);
        let t = terrainMap[sqName];
        // Mountains and lakes block line of sight/movement completely
        if (t === 'mountain' || t === 'lake') return false;
        currR += dr;
        currC += dc;
    }
    return true;
}

function getPseudoLegalMoves(r, c, currentBoard) {
    let piece = currentBoard[r][c];
    if (!piece) return [];
    let color = piece[0];
    let type = piece[1];
    let moves = [];

    let addStepMove = (tr, tc) => {
        if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
            let sqName = getSquareName(tr, tc);
            let t = terrainMap[sqName];
            // Can't move onto mountains or lakes
            if (t === 'mountain' || t === 'lake') return;

            let target = currentBoard[tr][tc];
            if (!target) {
                moves.push({r: tr, c: tc});
            } else if (target[0] !== color) {
                moves.push({r: tr, c: tc, capture: true});
            }
        }
    };

    let addRayMoves = (directions) => {
        for (let [dr, dc] of directions) {
            let currR = r + dr;
            let currC = c + dc;
            while (currR >= 0 && currR < 8 && currC >= 0 && currC < 8) {
                let sqName = getSquareName(currR, currC);
                let t = terrainMap[sqName];
                // Mountains and lakes block rays completely
                if (t === 'mountain' || t === 'lake') break;

                let target = currentBoard[currR][currC];
                if (!target) {
                    moves.push({r: currR, c: currC});
                } else {
                    if (target[0] !== color) {
                        moves.push({r: currR, c: currC, capture: true});
                    }
                    break; // Blocked by piece
                }
                currR += dr;
                currC += dc;
            }
        }
    };

    if (type === 'p') {
        let dir = (color === 'w') ? -1 : 1;
        let startRow = (color === 'w') ? 6 : 1;

        // Forward 1
        let f1r = r + dir;
        if (f1r >= 0 && f1r < 8) {
            let sqName = getSquareName(f1r, c);
            let t = terrainMap[sqName];
            if (t !== 'mountain' && t !== 'lake' && !currentBoard[f1r][c]) {
                moves.push({r: f1r, c: c});
                // Forward 2 from start
                let f2r = r + (dir * 2);
                if (r === startRow && !currentBoard[f2r][c]) {
                    let midSqName = getSquareName(f1r, c);
                    if (terrainMap[midSqName] !== 'mountain' && terrainMap[midSqName] !== 'lake') {
                        moves.push({r: f2r, c: c});
                    }
                }
            }
        }

        // Captures
        for (let dc of [-1, 1]) {
            let tr = r + dir;
            let tc = c + dc;
            if (tr >= 0 && tr < 8 && tc >= 0 && tc < 8) {
                let sqName = getSquareName(tr, tc);
                let t = terrainMap[sqName];
                if (t !== 'mountain' && t !== 'lake') {
                    let target = currentBoard[tr][tc];
                    if (target && target[0] !== color) {
                        moves.push({r: tr, c: tc, capture: true});
                    }
                }
            }
        }
    } else if (type === 'n') {
        let knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (let [dr, dc] of knightMoves) {
            addStepMove(r + dr, c + dc);
        }
    } else if (type === 'b') {
        addRayMoves([[-1, -1], [-1, 1], [1, -1], [1, 1]]);
    } else if (type === 'r') {
        addRayMoves([[-1, 0], [1, 0], [0, -1], [0, 1]]);
    } else if (type === 'q') {
        addRayMoves([[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]);
    } else if (type === 'k') {
        let kingMoves = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, -1], [1, 0], [1, 1]
        ];
        for (let [dr, dc] of kingMoves) {
            addStepMove(r + dr, c + dc);
        }
    }
    return moves;
}

function isSquareAttacked(r, c, byColor, currentBoard) {
    for (let ar = 0; ar < 8; ar++) {
        for (let ac = 0; ac < 8; ac++) {
            let piece = currentBoard[ar][ac];
            if (piece && piece[0] === byColor) {
                let type = piece[1];
                if (type === 'b' || type === 'r' || type === 'q') {
                    if (Math.abs(ar - r) === Math.abs(ac - c) || ar === r || ac === c) {
                        if (isValidLineOfSight(ar, ac, r, c)) {
                            let moves = getPseudoLegalMoves(ar, ac, currentBoard);
                            if (moves.some(m => m.r === r && m.c === c)) return true;
                        }
                    }
                } else {
                    let moves = getPseudoLegalMoves(ar, ac, currentBoard);
                    if (moves.some(m => m.r === r && m.c === c)) return true;
                }
            }
        }
    }
    return false;
}

function findKing(color, currentBoard) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (currentBoard[r][c] === color + 'k') return {r, c};
        }
    }
    return null;
}

function getLegalMoves(r, c, currentBoard) {
    let pseudo = getPseudoLegalMoves(r, c, currentBoard);
    let color = currentBoard[r][c][0];
    let legal = [];

    for (let move of pseudo) {
        let targetBackup = currentBoard[move.r][move.c];
        currentBoard[move.r][move.c] = currentBoard[r][c];
        currentBoard[r][c] = null;

        let kingPos = findKing(color, currentBoard);
        let inCheck = kingPos ? isSquareAttacked(kingPos.r, kingPos.c, color === 'w' ? 'b' : 'w', currentBoard) : false;

        currentBoard[r][c] = currentBoard[move.r][move.c];
        currentBoard[move.r][move.c] = targetBackup;

        if (!inCheck) {
            legal.push(move);
        }
    }
    return legal;
}

function getAllLegalMoves(color, currentBoard) {
    let allMoves = [];
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            if (currentBoard[r][c] && currentBoard[r][c][0] === color) {
                let moves = getLegalMoves(r, c, currentBoard);
                for (let m of moves) {
                    allMoves.push({fromR: r, fromC: c, toR: m.r, toC: m.c, capture: m.capture});
                }
            }
        }
    }
    return allMoves;
}

function makeMove(fromR, fromC, toR, toC) {
    let piece = board[fromR][fromC];
    
    if (piece[1] === 'p' && (toR === 0 || toR === 7)) {
        piece = piece[0] + 'q';
    }

    board[toR][toC] = piece;
    board[fromR][fromC] = null;

    turn = (turn === 'w') ? 'b' : 'w';
    selectedSquare = null;
    validMoves = [];

    checkGameStatus();
    renderBoard();

    if (!gameOver && turn === 'b' && gameMode !== 'none') {
        setTimeout(makeAIMove, 250);
    }
}

function checkGameStatus() {
    let legalMoves = getAllLegalMoves(turn, board);
    let kingPos = findKing(turn, board);
    let inCheck = kingPos ? isSquareAttacked(kingPos.r, kingPos.c, turn === 'w' ? 'b' : 'w', board) : false;

    let turnIndicator = document.getElementById('turnIndicator');
    let gameMessage = document.getElementById('gameMessage');

    turnIndicator.textContent = turn === 'w' ? "White's Turn" : "Black's Turn";

    if (legalMoves.length === 0) {
        gameOver = true;
        if (inCheck) {
            let winner = turn === 'w' ? 'Black' : 'White';
            gameMessage.textContent = `Checkmate! ${winner} wins.`;
        } else {
            gameMessage.textContent = `Stalemate! Draw.`;
        }
    } else if (inCheck) {
        gameMessage.textContent = "Check!";
    } else {
        gameMessage.textContent = "";
    }
}

// AI Logic
function evaluateBoard(currentBoard) {
    const values = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
    let score = 0;
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            let p = currentBoard[r][c];
            if (p) {
                let val = values[p[1]];
                score += (p[0] === 'b') ? val : -val;
            }
        }
    }
    return score;
}

function makeAIMove() {
    if (gameOver) return;
    let moves = getAllLegalMoves('b', board);
    if (moves.length === 0) return;

    if (gameMode === 'easy') {
        let randomMove = moves[Math.floor(Math.random() * moves.length)];
        makeMove(randomMove.fromR, randomMove.fromC, randomMove.toR, randomMove.toC);
    } else {
        let bestScore = -99999;
        let bestMoves = [];

        for (let m of moves) {
            let targetBackup = board[m.toR][m.toC];
            board[m.toR][m.toC] = board[m.fromR][m.fromC];
            board[m.fromR][m.fromC] = null;

            let score = evaluateBoard(board);
            score += Math.random() * 5;

            board[m.fromR][m.fromC] = board[m.toR][m.toC];
            board[m.toR][m.toC] = targetBackup;

            if (score > bestScore) {
                bestScore = score;
                bestMoves = [m];
            } else if (Math.abs(score - bestScore) < 0.1) {
                bestMoves.push(m);
            }
        }

        let chosenMove = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        makeMove(chosenMove.fromR, chosenMove.fromC, chosenMove.toR, chosenMove.toC);
    }
}

// Rendering
function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const sqEl = document.createElement('div');
            const sqName = getSquareName(r, c);
            const isDark = (r + c) % 2 === 1;
            
            sqEl.className = `square ${isDark ? 'dark' : 'light'}`;

            if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                sqEl.classList.add('selected');
            }
            let isValidTarget = validMoves.find(m => m.r === r && m.c === c);
            if (isValidTarget) {
                sqEl.classList.add('highlight');
            }

            let terrain = terrainMap[sqName];
            if (terrain === 'mountain') {
                let mEl = document.createElement('div');
                mEl.className = 'terrain-mountain';
                mEl.innerHTML = '⛰️';
                sqEl.appendChild(mEl);
            } else if (terrain === 'lake') {
                let lEl = document.createElement('div');
                lEl.className = 'terrain-lake';
                sqEl.appendChild(lEl);
            } else if (terrain === 'river') {
                let rEl = document.createElement('div');
                rEl.className = 'terrain-river';
                sqEl.appendChild(rEl);
            }

            let piece = board[r][c];
            if (piece) {
                let pEl = document.createElement('div');
                pEl.className = 'piece';
                pEl.setAttribute('data-color', piece[0]);
                pEl.textContent = PIECES[piece[0]][piece[1]];
                sqEl.appendChild(pEl);
            }

            if (isValidTarget) {
                if (isValidTarget.capture) {
                    let capEl = document.createElement('div');
                    capEl.className = 'capture-ring';
                    sqEl.appendChild(capEl);
                } else {
                    let dotEl = document.createElement('div');
                    dotEl.className = 'move-dot';
                    sqEl.appendChild(dotEl);
                }
            }

            sqEl.addEventListener('click', () => handleSquareClick(r, c));
            boardEl.appendChild(sqEl);
        }
    }
}

function handleSquareClick(r, c) {
    if (gameOver) return;
    if (turn === 'b' && gameMode !== 'none') return;

    let clickedPiece = board[r][c];

    if (selectedSquare) {
        let matchMove = validMoves.find(m => m.r === r && m.c === c);
        if (matchMove) {
            makeMove(selectedSquare.r, selectedSquare.c, r, c);
            return;
        }
    }

    if (clickedPiece && clickedPiece[0] === turn) {
        selectedSquare = {r, c};
        validMoves = getLegalMoves(r, c, board);
    } else {
        selectedSquare = null;
        validMoves = [];
    }
    renderBoard();
}

// Event Listeners
document.getElementById('newGameBtn').addEventListener('click', () => {
    let landmarkKey = document.getElementById('landmarkSelect').value;
    setLandmark(landmarkKey);
    initBoard();
    checkGameStatus();
    renderBoard();
});

document.getElementById('landmarkSelect').addEventListener('change', (e) => {
    setLandmark(e.target.value);
    initBoard();
    checkGameStatus();
    renderBoard();
});

document.getElementById('aiToggle').addEventListener('change', (e) => {
    gameMode = e.target.value;
});

// Initial Boot
setLandmark('riverside');
initBoard();
checkGameStatus();
renderBoard();

// Piece Glyphs
const PIECES = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
};

// Terrain Types: 'mountain', 'lake', 'river'
// Rule: Mountains & Lakes block movement and line of sight. Rivers are crossable.
let terrainMap = {}; 

const LANDMARKS = {
    none: {},
    riverside: {
        'f6': 'river', 'g6': 'river', 'h6': 'river', 'i6': 'river',
        'f7': 'river', 'g7': 'river', 'h7': 'river', 'i7': 'river',
        'e8': 'river', 'j8': 'river'
    },
    twinHills: {
        'e5': 'mountain', 'j5': 'mountain',
        'e10': 'mountain', 'j10': 'mountain'
    },
    oasis: {
        'f7': 'lake', 'g7': 'lake', 'h7': 'lake', 'i7': 'lake',
        'f8': 'river', 'g8': 'river', 'h8': 'river', 'i8': 'river'
    },
    archipelago: {
        'd5': 'lake', 'k5': 'lake',
        'f10': 'lake', 'i10': 'lake',
        'a7': 'river', 'n8': 'river'
    },
    greatRidge: {
        'f4': 'mountain', 'f5': 'mountain', 'f6': 'mountain', 'f7': 'mountain', 'f8': 'mountain',
        'i7': 'mountain', 'i8': 'mountain', 'i9': 'mountain', 'i10': 'mountain', 'i11': 'mountain'
    },
    crossroads: {
        'g1': 'river', 'g2': 'river', 'g3': 'river', 'g4': 'river', 'g5': 'river', 'g6': 'river', 'g7': 'river', 
        'g8': 'river', 'g9': 'river', 'g10': 'river', 'g11': 'river', 'g12': 'river', 'g13': 'river', 'g14': 'river',
        'a7': 'river', 'b7': 'river', 'c7': 'river', 'd7': 'river', 'e7': 'river', 'f7': 'river', 
        'h7': 'river', 'i7': 'river', 'j7': 'river', 'k7': 'river', 'l7': 'river', 'm7': 'river', 'n7': 'river'
    },
    canyon: {
        'e3': 'mountain', 'e4': 'mountain', 'e5': 'mountain', 'e6': 'mountain', 'e7': 'mountain', 'e8': 'mountain',
        'j6': 'mountain', 'j7': 'mountain', 'j8': 'mountain', 'j9': 'mountain', 'j10': 'mountain', 'j11': 'mountain'
    },
    islands: {
        'c3': 'lake', 'l3': 'lake',
        'f7': 'mountain', 'i7': 'mountain',
        'c12': 'lake', 'l12': 'lake'
    }
};

let board = [];
let turn = 'w'; // 'w' or 'b'
let selectedSquare = null;
let validMoves = [];
let gameOver = false;
let gameMode = 'medium';

// Initialize 14x14 Custom Chess Setup
function initBoard() {
    board = Array(14).fill(null).map(() => Array(14).fill(null));
    
    // Back row setup (14 columns)
    const backRow = ['br','bn','bn','bb','bb','bq','bk','bk','bq','bb','bb','bn','bn','br'];
    board[0] = [...backRow];
    board[13] = backRow.map(p => p ? 'w' + p[1] : null);

    // Pawns setup (Rows 1 and 12)
    board[1] = Array(14).fill('bp');
    board[12] = Array(14).fill('wp');
}

function getSquareName(r, c) {
    return String.fromCharCode(97 + c) + (14 - r);
}

function setLandmark(type) {
    terrainMap = LANDMARKS[type] || {};
}

function isValidLineOfSight(r1, c1, r2, c2) {
    let dr = Math.sign(r2 - r1);
    let dc = Math.sign(c2 - c1);
    let currR = r1 + dr;
    let currC = c1 + dc;

    while (currR !== r2 || currC !== c2) {
        let sqName = getSquareName(currR, currC);
        let t = terrainMap[sqName];
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
        if (tr >= 0 && tr < 14 && tc >= 0 && tc < 14) {
            let sqName = getSquareName(tr, tc);
            let t = terrainMap[sqName];
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
            while (currR >= 0 && currR < 14 && currC >= 0 && currC < 14) {
                let sqName = getSquareName(currR, currC);
                let t = terrainMap[sqName];
                if (t === 'mountain' || t === 'lake') break;

                let target = currentBoard[currR][currC];
                if (!target) {
                    moves.push({r: currR, c: currC});
                } else {
                    if (target[0] !== color) {
                        moves.push({r: currR, c: currC, capture: true});
                    }
                    break;
                }
                currR += dr;
                currC += dc;
            }
        }
    };

    if (type === 'p') {
        let dir = (color === 'w') ? -1 : 1;
        let startRow = (color === 'w') ? 12 : 1;

        let f1r = r + dir;
        if (f1r >= 0 && f1r < 14) {
            let sqName = getSquareName(f1r, c);
            let t = terrainMap[sqName];
            if (t !== 'mountain' && t !== 'lake' && !currentBoard[f1r][c]) {
                moves.push({r: f1r, c: c});
                let f2r = r + (dir * 2);
                if (r === startRow && !currentBoard[f2r][c]) {
                    let midSqName = getSquareName(f1r, c);
                    if (terrainMap[midSqName] !== 'mountain' && terrainMap[midSqName] !== 'lake') {
                        moves.push({r: f2r, c: c});
                    }
                }
            }
        }

        for (let dc of [-1, 1]) {
            let tr = r + dir;
            let tc = c + dc;
            if (tr >= 0 && tr < 14 && tc >= 0 && tc < 14) {
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
    for (let ar = 0; ar < 14; ar++) {
        for (let ac = 0; ac < 14; ac++) {
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
    for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 14; c++) {
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
        let inCheck = false;
        if (kingPos) {
            inCheck = isSquareAttacked(kingPos.r, kingPos.c, color === 'w' ? 'b' : 'w', currentBoard);
        }

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
    for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 14; c++) {
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
    
    if (piece[1] === 'p' && (toR === 0 || toR === 13)) {
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

function evaluateBoard(currentBoard) {
    const values = { p: 10, n: 30, b: 30, r: 50, q: 90, k: 900 };
    let score = 0;
    for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 14; c++) {
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

function renderBoard() {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (let r = 0; r < 14; r++) {
        for (let c = 0; c < 14; c++) {
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

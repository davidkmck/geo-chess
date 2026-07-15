const AI = {
    evaluateBoard: function (bMatrix, PIECE_VALUES, isSquareAttacked, generateAllLegalMoves) {
        let score = 0;
        const SIZE = 14;
        const centerStart = 5;
        const centerEnd = 8;

        let wKing = null;
        let bKing = null;

        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (!p) continue;

                // 1. Track King locations for the threat/aggression heuristics
                if (p.type === "K") {
                    if (p.color === "w") wKing = { r, f };
                    else bKing = { r, f };
                }

                const val = PIECE_VALUES[p.type] || 0;
                let cellScore = p.color === "w" ? val : -val;

                // 2. Positional Bonus: Control the center. Now applies to every piece type
                // (not just pawns/knights), weighted by how much that piece benefits from it,
                // so the AI is pulled toward the middle of the board instead of staying put.
                if (r >= centerStart && r <= centerEnd && f >= centerStart && f <= centerEnd) {
                    const centerWeight = { P: 4, N: 7, B: 6, R: 3, Q: 4, K: 0 }[p.type] || 0;
                    cellScore += p.color === "w" ? centerWeight : -centerWeight;
                }

                // 3. Development Bonus (Penalty for pieces sitting on the back rank)
                const isHomeRank = (p.color === "b" && r === 0) || (p.color === "w" && r === SIZE - 1);
                if (isHomeRank && (p.type === 'N' || p.type === 'B' || p.type === 'Q')) {
                    cellScore += (p.color === "w" ? -12 : 12);
                }

                // 4. Pawn advancement: reward pushing pawns forward, so the AI expands out
                // instead of leaving its whole pawn chain sitting at home.
                if (p.type === "P") {
                    const advancement = p.color === "w" ? (SIZE - 1 - r) : r;
                    cellScore += (p.color === "w" ? 1 : -1) * advancement * 1.2;
                }

                score += cellScore;
            }
        }

        // 5. Aggression: reward pieces (other than pawns/king) for closing the distance to the
        // enemy king. This is the "ultimately win the king" push - without it the AI is happy
        // to sit on material/position without ever converting an advantage into an attack.
        if (wKing || bKing) {
            for (let r = 0; r < SIZE; r++) {
                for (let f = 0; f < SIZE; f++) {
                    const p = bMatrix[r][f];
                    if (!p || p.type === "P" || p.type === "K") continue;
                    if (p.color === "w" && bKing) {
                        const dist = Math.max(Math.abs(r - bKing.r), Math.abs(f - bKing.f));
                        score += (SIZE - dist) * 0.6;
                    } else if (p.color === "b" && wKing) {
                        const dist = Math.max(Math.abs(r - wKing.r), Math.abs(f - wKing.f));
                        score -= (SIZE - dist) * 0.6;
                    }
                }
            }
        }

        // 6. Mobility: encourage having (and developing into) more available moves, so passive
        // shuffling scores worse than getting pieces into play.
        if (generateAllLegalMoves) {
            const wMoves = generateAllLegalMoves("w", bMatrix).length;
            const bMoves = generateAllLegalMoves("b", bMatrix).length;
            score += (wMoves - bMoves) * 0.4;
        }

        // 7. THE HORIZON FIX: Massive penalty if a King is currently under attack.
        // This forces the AI to avoid check, block checks, and deliver checks.
        if (wKing && isSquareAttacked(wKing.r, wKing.f, "w", bMatrix)) score -= 20000;
        if (bKing && isSquareAttacked(bKing.r, bKing.f, "b", bMatrix)) score += 20000;

        return score;
    },

    // Internal deep search. Uses fast pseudo-legal move generation (generateAllLegalMoves) for
    // speed - it does not filter out moves that would leave the mover's own king in check. The
    // massive king-under-attack term in evaluateBoard makes such lines look terrible anyway, so
    // this stays fast without meaningfully weakening play. The final move actually played always
    // comes from findBestMove below, which only considers fully legal moves.
    minimax: function (bMatrix, depth, alpha, beta, isMaximizing, PIECE_VALUES, generateAllLegalMoves, cloneBoard, isSquareAttacked) {
        if (depth === 0) return { score: this.evaluateBoard(bMatrix, PIECE_VALUES, isSquareAttacked, generateAllLegalMoves) };
        const moves = generateAllLegalMoves(isMaximizing ? "w" : "b", bMatrix);
        if (moves.length === 0) return { score: this.evaluateBoard(bMatrix, PIECE_VALUES, isSquareAttacked, generateAllLegalMoves) };

        let bestMove = null;
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                const captured = nextBoard[move.to.r][move.to.f];
                
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                if (captured && captured.type === "K") return { score: 99999 + depth, move };

                const scoreEval = this.minimax(nextBoard, depth - 1, alpha, beta, false, PIECE_VALUES, generateAllLegalMoves, cloneBoard, isSquareAttacked).score;
                if (scoreEval > maxEval) { maxEval = scoreEval; bestMove = move; }
                alpha = Math.max(alpha, scoreEval);
                if (beta <= alpha) break; 
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                const captured = nextBoard[move.to.r][move.to.f];
                
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                if (captured && captured.type === "K") return { score: -99999 - depth, move };

                const scoreEval = this.minimax(nextBoard, depth - 1, alpha, beta, true, PIECE_VALUES, generateAllLegalMoves, cloneBoard, isSquareAttacked).score;
                if (scoreEval < minEval) { minEval = scoreEval; bestMove = move; }
                beta = Math.min(beta, scoreEval);
                if (beta <= alpha) break; 
            }
            return { score: minEval, move: bestMove };
        }
    },

    // Root-level move selection. Only ever picks from the caller-supplied list of fully legal
    // moves (so the AI can never choose a move that leaves/keeps its own king in check). Also
    // breaks ties randomly and discourages immediately undoing its own previous move, which is
    // what caused the "shuffle a rook back and forth" behavior.
    findBestMove: function (bMatrix, depth, color, PIECE_VALUES, legalMoves, cloneBoard, isSquareAttacked, generateAllLegalMoves, lastMove) {
        if (!legalMoves || legalMoves.length === 0) return null;
        const isMaximizing = color === "w";

        let bestScore = isMaximizing ? -Infinity : Infinity;
        let bestMoves = [];

        for (const move of legalMoves) {
            const nextBoard = cloneBoard(bMatrix);
            const captured = nextBoard[move.to.r][move.to.f];

            nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
            nextBoard[move.from.r][move.from.f] = null;

            let scoreEval;
            if (captured && captured.type === "K") {
                scoreEval = isMaximizing ? 99999 + depth : -99999 - depth;
            } else {
                scoreEval = this.minimax(nextBoard, depth - 1, -Infinity, Infinity, !isMaximizing, PIECE_VALUES, generateAllLegalMoves, cloneBoard, isSquareAttacked).score;
            }

            // Anti-shuffle: penalize immediately reversing the piece we just moved.
            if (lastMove && move.from.r === lastMove.to.r && move.from.f === lastMove.to.f &&
                move.to.r === lastMove.from.r && move.to.f === lastMove.from.f) {
                scoreEval += isMaximizing ? -15 : 15;
            }

            if (isMaximizing ? scoreEval > bestScore : scoreEval < bestScore) {
                bestScore = scoreEval;
                bestMoves = [move];
            } else if (scoreEval === bestScore) {
                bestMoves.push(move);
            }
        }

        const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
        return { move: chosen, score: bestScore };
    }
};

const AI = {
    evaluateBoard: function(bMatrix, PIECE_VALUES, isSquareAttacked) {
        let score = 0;
        const centerStart = 5;
        const centerEnd = 8;
        const SIZE = 14; 

        let wKing = null;
        let bKing = null;

        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (p) {
                    // 1. Track King locations for the threat heuristic
                    if (p.type === "K") {
                        if (p.color === "w") wKing = {r, f};
                        else bKing = {r, f};
                    }

                    const val = PIECE_VALUES[p.type] || 0;
                    // Base value
                    let cellScore = p.color === "w" ? val : -val;
                    
                    // 2. Positional Bonus: Control the center
                    if (r >= centerStart && r <= centerEnd && f >= centerStart && f <= centerEnd) {
                        if (p.type === 'P' || p.type === 'N') {
                            cellScore += (p.color === "w" ? 5 : -5);
                        }
                    }

                    // 3. Development Bonus (Penalty for pieces on back rank)
                    const isHomeRank = (p.color === "b" && r === 0) || (p.color === "w" && r === SIZE - 1);
                    if (isHomeRank && (p.type === 'N' || p.type === 'B' || p.type === 'Q')) {
                        cellScore += (p.color === "w" ? -10 : 10);
                    }
                    
                    score += cellScore;
                }
            }
        }
        
        // 4. THE HORIZON FIX: Massive penalty if a King is currently under attack.
        // This forces the AI to avoid check, block checks, and deliver checks.
        if (wKing && isSquareAttacked(wKing.r, wKing.f, "w", bMatrix)) score -= 20000;
        if (bKing && isSquareAttacked(bKing.r, bKing.f, "b", bMatrix)) score += 20000;

        return score;
    },

    // Notice we now pass isSquareAttacked into the minimax function parameters
    minimax: function(bMatrix, depth, alpha, beta, isMaximizing, PIECE_VALUES, generateAllLegalMoves, cloneBoard, isSquareAttacked) {
        if (depth === 0) return { score: this.evaluateBoard(bMatrix, PIECE_VALUES, isSquareAttacked) };
        const moves = generateAllLegalMoves(isMaximizing ? "w" : "b", bMatrix);
        if (moves.length === 0) return { score: this.evaluateBoard(bMatrix, PIECE_VALUES, isSquareAttacked) };

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
    }
};

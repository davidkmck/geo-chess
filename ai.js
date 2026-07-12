const AI = {
    evaluateBoard: function(bMatrix, PIECE_VALUES) {
        let score = 0;
        const centerStart = 5;
        const centerEnd = 8;
        const SIZE = 14; 

        for (let r = 0; r < SIZE; r++) {
            for (let f = 0; f < SIZE; f++) {
                const p = bMatrix[r][f];
                if (p) {
                    const val = PIECE_VALUES[p.type] || 0;
                    // Base value
                    let cellScore = p.color === "w" ? val : -val;
                    
                    // 1. Positional Bonus: Control the center
                    if (r >= centerStart && r <= centerEnd && f >= centerStart && f <= centerEnd) {
                        if (p.type === 'P' || p.type === 'N') {
                            cellScore += (p.color === "w" ? 5 : -5);
                        }
                    }

                    // 2. Development Bonus (Penalty for pieces on back rank)
                    const isHomeRank = (p.color === "b" && r === 0) || (p.color === "w" && r === SIZE - 1);
                    if (isHomeRank && (p.type === 'N' || p.type === 'B' || p.type === 'Q')) {
                        cellScore += (p.color === "w" ? -10 : 10);
                    }
                    
                    score += cellScore;
                }
            }
        }
        return score;
    },

    minimax: function(bMatrix, depth, alpha, beta, isMaximizing, PIECE_VALUES, generateAllLegalMoves, cloneBoard) {
        if (depth === 0) return { score: this.evaluateBoard(bMatrix, PIECE_VALUES) };
        const moves = generateAllLegalMoves(isMaximizing ? "w" : "b", bMatrix);
        if (moves.length === 0) return { score: this.evaluateBoard(bMatrix, PIECE_VALUES) };

        let bestMove = null;
        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of moves) {
                const nextBoard = cloneBoard(bMatrix);
                const captured = nextBoard[move.to.r][move.to.f];
                
                // Simulate move
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                // Regicide condition
                if (captured && captured.type === "K") return { score: 99999 + depth, move };

                const scoreEval = this.minimax(nextBoard, depth - 1, alpha, beta, false, PIECE_VALUES, generateAllLegalMoves, cloneBoard).score;
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
                
                // Simulate move
                nextBoard[move.to.r][move.to.f] = { ...nextBoard[move.from.r][move.from.f], moved: true };
                nextBoard[move.from.r][move.from.f] = null;

                // Regicide condition
                if (captured && captured.type === "K") return { score: -99999 - depth, move };

                const scoreEval = this.minimax(nextBoard, depth - 1, alpha, beta, true, PIECE_VALUES, generateAllLegalMoves, cloneBoard).score;
                if (scoreEval < minEval) { minEval = scoreEval; bestMove = move; }
                beta = Math.min(beta, scoreEval);
                if (beta <= alpha) break; 
            }
            return { score: minEval, move: bestMove };
        }
    }
};

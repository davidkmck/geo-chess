// ai.js
const AI = {
    evaluateBoard: function(bMatrix, PIECE_VALUES) {
        let score = 0;
        for (let r = 0; r < 14; r++) {
            for (let f = 0; f < 14; f++) {
                const p = bMatrix[r][f];
                if (p) {
                    let s = (p.color === "w" ? 1 : -1) * (PIECE_VALUES[p.type] || 0);
                    if (r >= 5 && r <= 8 && f >= 5 && f <= 8 && (p.type === 'P' || p.type === 'N')) s += (p.color === "w" ? 5 : -5);
                    score += s;
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
            for (const m of moves) {
                const nextBoard = cloneBoard(bMatrix);
                nextBoard[m.to.r][m.to.f] = { ...nextBoard[m.from.r][m.from.f], moved: true };
                nextBoard[m.from.r][m.from.f] = null;
                const score = this.minimax(nextBoard, depth - 1, alpha, beta, false, PIECE_VALUES, generateAllLegalMoves, cloneBoard).score;
                if (score > maxEval) { maxEval = score; bestMove = m; }
                alpha = Math.max(alpha, score); if (beta <= alpha) break;
            }
            return { score: maxEval, move: bestMove };
        } else {
            let minEval = Infinity;
            for (const m of moves) {
                const nextBoard = cloneBoard(bMatrix);
                nextBoard[m.to.r][m.to.f] = { ...nextBoard[m.from.r][m.from.f], moved: true };
                nextBoard[m.from.r][m.from.f] = null;
                const score = this.minimax(nextBoard, depth - 1, alpha, beta, true, PIECE_VALUES, generateAllLegalMoves, cloneBoard).score;
                if (score < minEval) { minEval = score; bestMove = m; }
                beta = Math.min(beta, score); if (beta <= alpha) break;
            }
            return { score: minEval, move: bestMove };
        }
    }
};

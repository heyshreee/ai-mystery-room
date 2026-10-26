import { CORRECT_BASE_SCORE, HINT_PENALTY, type ScoreBreakdown } from "@amr/shared";

export function calculateScore(isCorrect: boolean, hintsUsed: number): ScoreBreakdown {
  const normalizedHints = Number.isFinite(hintsUsed)
    ? Math.max(0, Math.floor(hintsUsed))
    : 0;

  if (!isCorrect) {
    return {
      base: 0,
      hintPenalty: 0,
      hintsUsed: normalizedHints,
      total: 0,
    };
  }

  const base = CORRECT_BASE_SCORE;
  const hintPenalty = normalizedHints * HINT_PENALTY;
  return {
    base,
    hintPenalty,
    hintsUsed: normalizedHints,
    total: Math.max(0, base - hintPenalty),
  };
}

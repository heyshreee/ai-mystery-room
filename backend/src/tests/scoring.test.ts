import { describe, expect, it } from "vitest";
import { calculateScore } from "../services/scoring.js";

describe("calculateScore", () => {
  it("awards 100 points for a correct accusation without hints", () => {
    expect(calculateScore(true, 0)).toEqual({
      base: 100,
      hintPenalty: 0,
      hintsUsed: 0,
      total: 100,
    });
  });

  it("subtracts ten points for each hint", () => {
    expect(calculateScore(true, 3)).toEqual({
      base: 100,
      hintPenalty: 30,
      hintsUsed: 3,
      total: 70,
    });
  });

  it("clamps a correct score at zero", () => {
    expect(calculateScore(true, 12)).toEqual({
      base: 100,
      hintPenalty: 120,
      hintsUsed: 12,
      total: 0,
    });
  });

  it("awards zero points to an incorrect accusation", () => {
    expect(calculateScore(false, 2)).toEqual({
      base: 0,
      hintPenalty: 0,
      hintsUsed: 2,
      total: 0,
    });
  });

  it("normalizes invalid or negative hint counts", () => {
    expect(calculateScore(true, -3).hintsUsed).toBe(0);
    expect(calculateScore(true, Number.NaN).hintsUsed).toBe(0);
    expect(calculateScore(true, 2.9).hintsUsed).toBe(2);
  });
});

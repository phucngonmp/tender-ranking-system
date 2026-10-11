import { computeRuleScore, clampScore } from './rule-score.util';

describe('computeRuleScore', () => {
  const baseCriteria = { preferredValueMin: null, preferredValueMax: null };

  it('applies urgent deadline penalty when less than 3 days left', () => {
    const deadline = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const result = computeRuleScore({
      tender: { submissionDeadline: deadline, estimatedValue: null },
      criteriaProfile: baseCriteria,
      riskFlagsCount: 0,
    });
    expect(result).toBe(-15);
  });

  it('applies soon deadline penalty when less than 7 days left', () => {
    const deadline = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    const result = computeRuleScore({
      tender: { submissionDeadline: deadline, estimatedValue: null },
      criteriaProfile: baseCriteria,
      riskFlagsCount: 0,
    });
    expect(result).toBe(-5);
  });

  it('applies no deadline penalty when far away', () => {
    const deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const result = computeRuleScore({
      tender: { submissionDeadline: deadline, estimatedValue: null },
      criteriaProfile: baseCriteria,
      riskFlagsCount: 0,
    });
    expect(result).toBe(0);
  });

  it('applies preferred value bonus when value within range', () => {
    const result = computeRuleScore({
      tender: { submissionDeadline: null, estimatedValue: 500 as any },
      criteriaProfile: { preferredValueMin: 100 as any, preferredValueMax: 1000 as any },
      riskFlagsCount: 0,
    });
    expect(result).toBe(10);
  });

  it('does not apply value bonus when outside range', () => {
    const result = computeRuleScore({
      tender: { submissionDeadline: null, estimatedValue: 5000 as any },
      criteriaProfile: { preferredValueMin: 100 as any, preferredValueMax: 1000 as any },
      riskFlagsCount: 0,
    });
    expect(result).toBe(0);
  });

  it('caps risk flag penalty at -15', () => {
    const result = computeRuleScore({
      tender: { submissionDeadline: null, estimatedValue: null },
      criteriaProfile: baseCriteria,
      riskFlagsCount: 10,
    });
    expect(result).toBe(-15);
  });

  it('combines multiple rule adjustments', () => {
    const deadline = new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
    const result = computeRuleScore({
      tender: { submissionDeadline: deadline, estimatedValue: 500 as any },
      criteriaProfile: { preferredValueMin: 100 as any, preferredValueMax: 1000 as any },
      riskFlagsCount: 1,
    });
    expect(result).toBe(-15 + 10 - 5);
  });
});

describe('clampScore', () => {
  it('clamps below 0 to 0', () => {
    expect(clampScore(-50)).toBe(0);
  });

  it('clamps above 100 to 100', () => {
    expect(clampScore(150)).toBe(100);
  });

  it('rounds fractional scores', () => {
    expect(clampScore(72.6)).toBe(73);
  });

  it('leaves in-range scores untouched', () => {
    expect(clampScore(42)).toBe(42);
  });
});

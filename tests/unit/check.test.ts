import { describe, expect, it } from 'vitest';
import { grade, groupsOf, respectsSteps, parseNumber, probesOf } from '~/assessment/check';
import type { Question } from '~/content.config';

const base = { objectives: ['OBJ-1.5-1'], qualitative: false, level: 'basic' as const, hints: [], confidence: true, shuffle: true };

const mc: Question = {
  ...base,
  id: 'Q-1.5-mc',
  type: 'mc',
  prompt: 'p',
  choices: [
    { text: 'a', correct: true, feedback: 'yes' },
    { text: 'b', correct: false, feedback: 'no', misconception: 'MC-x' },
  ],
};

describe('mc', () => {
  it('grades the correct choice and traces the distractor', () => {
    expect(grade(mc, { type: 'mc', choice: 0 })).toEqual({ correct: true, feedback: ['yes'], misconception: null });
    expect(grade(mc, { type: 'mc', choice: 1 })).toMatchObject({ correct: false, misconception: 'MC-x' });
  });
  it('lists the misconceptions a question probes', () => {
    expect(probesOf(mc)).toEqual(['MC-x']);
  });
});

describe('multi', () => {
  const q: Question = {
    ...base,
    id: 'Q-1.5-multi',
    type: 'multi',
    prompt: 'p',
    choices: [
      { text: 'a', correct: true, feedback: 'a!' },
      { text: 'b', correct: true, feedback: 'b!' },
      { text: 'c', correct: false, feedback: 'c?', misconception: 'MC-c' },
    ],
  };
  it('needs exactly the correct set', () => {
    expect(grade(q, { type: 'multi', choices: [0, 1] }).correct).toBe(true);
    expect(grade(q, { type: 'multi', choices: [0] }).correct).toBe(false);
    expect(grade(q, { type: 'multi', choices: [0, 1, 2] })).toMatchObject({ correct: false, misconception: 'MC-c' });
  });
});

describe('twotier', () => {
  const q: Question = {
    ...base,
    id: 'Q-1.5-tt',
    type: 'twotier',
    prompt: 'p',
    reasonPrompt: 'why',
    choices: [
      { text: 'a', correct: true, feedback: 'A' },
      { text: 'b', correct: false, feedback: 'B', misconception: 'MC-answer' },
    ],
    reasons: [
      { text: 'r1', correct: true, feedback: 'R1' },
      { text: 'r2', correct: false, feedback: 'R2', misconception: 'MC-reason' },
    ],
  };
  it('a right answer for a wrong reason is wrong, and the reason names the misconception', () => {
    expect(grade(q, { type: 'twotier', choice: 0, reason: 0 }).correct).toBe(true);
    expect(grade(q, { type: 'twotier', choice: 0, reason: 1 })).toMatchObject({ correct: false, misconception: 'MC-reason' });
    expect(grade(q, { type: 'twotier', choice: 1, reason: 1 }).misconception).toBe('MC-reason');
    expect(grade(q, { type: 'twotier', choice: 1, reason: 0 }).misconception).toBe('MC-answer');
  });
});

describe('numeric', () => {
  const q: Question = {
    ...base,
    id: 'Q-1.5-num',
    type: 'numeric',
    prompt: 'p',
    answer: 3.6e4,
    unit: 'N/C',
    tolerance: 0.03,
    correctFeedback: 'ok',
    wrongFeedback: 'try',
    commonWrong: [{ value: 1.08e4, feedback: 'you used r not r²', misconception: 'MC-r' }],
  };
  it('accepts values within the relative tolerance', () => {
    expect(grade(q, { type: 'numeric', value: 3.65e4 }).correct).toBe(true);
    expect(grade(q, { type: 'numeric', value: 3.8e4 }).correct).toBe(false);
  });
  it('recognises a known wrong value', () => {
    expect(grade(q, { type: 'numeric', value: 1.08e4 })).toMatchObject({ correct: false, misconception: 'MC-r' });
  });
  it('flags a power-of-ten slip', () => {
    expect(grade(q, { type: 'numeric', value: 3.6e7 }).feedback[0]).toContain('1000');
  });
});

describe('rank with ties', () => {
  const q: Question = {
    ...base,
    id: 'Q-1.5-rank',
    type: 'rank',
    prompt: 'p',
    items: [
      { id: 'A', label: 'A' },
      { id: 'B', label: 'B' },
      { id: 'C', label: 'C' },
    ],
    order: ['C', ['A', 'B']],
    correctFeedback: 'ok',
    wrongFeedback: 'no',
  };
  it('groups adjacent tied items', () => {
    expect(groupsOf(['C', 'A', 'B'], [false, true])).toEqual([['C'], ['A', 'B']]);
  });
  it('accepts any order inside a tie group but requires the tie', () => {
    expect(grade(q, { type: 'rank', order: ['C', 'B', 'A'], tied: [false, true] }).correct).toBe(true);
    expect(grade(q, { type: 'rank', order: ['C', 'A', 'B'], tied: [false, false] }).correct).toBe(false);
  });
});

describe('rank of proof steps (help present): a group is a set of independent steps', () => {
  const q: Question = {
    ...base,
    id: 'Q-1.5-steps',
    type: 'rank',
    prompt: 'p',
    help: 'סדרו את שלבי ההוכחה.',
    items: ['S', 'A', 'B', 'E'].map((id) => ({ id, label: id })),
    order: ['S', ['A', 'B'], 'E'],
    correctFeedback: 'ok',
    wrongFeedback: 'no',
  };
  const r = (order: string[], tied = [false, false, false]) => grade(q, { type: 'rank', order, tied }).correct;
  it('accepts the independent steps in either order, tied or not', () => {
    expect(r(['S', 'A', 'B', 'E'])).toBe(true);
    expect(r(['S', 'B', 'A', 'E'])).toBe(true);
    expect(r(['S', 'B', 'A', 'E'], [false, true, false])).toBe(true);
  });
  it('rejects a step moved past one it depends on, and a tie across groups', () => {
    expect(r(['A', 'S', 'B', 'E'])).toBe(false);
    expect(r(['S', 'A', 'E', 'B'])).toBe(false);
    expect(r(['S', 'A', 'B', 'E'], [true, false, false])).toBe(false);
  });
  it('agrees with respectsSteps directly', () => {
    expect(respectsSteps(['x', 'y'], [false], [['y'], ['x']])).toBe(false);
  });
});

describe('parseNumber', () => {
  it.each([
    ['2.5', 2.5],
    ['2,5', 2.5],
    ['-3', -3],
    ['−3', -3],
    ['2.5e-3', 2.5e-3],
    ['2.5*10^-3', 2.5e-3],
    ['2.5·10^-3', 2.5e-3],
    ['2.5 x 10^(-3)', 2.5e-3],
    ['10^5', 1e5],
    ['-10^5', -1e5],
    ['3.6·10⁴', 3.6e4],
    ['4·10⁻⁶', 4e-6],
    ['3/4', 0.75],
    ['-1/3', -1 / 3],
    [' 2 / −8 ', -0.25],
  ])('%s → %d', (s, v) => {
    expect(parseNumber(s)).toBeCloseTo(v, 12);
  });
  it.each(['', 'abc', '1..2', '10^', '--3', '1/0', '1/2/3', '/2'])('rejects %s', (s) => {
    expect(parseNumber(s)).toBeNull();
  });
});

describe('exact answers typed as expressions', () => {
  it.each([
    ['2π/3', (2 * Math.PI) / 3],
    ['2pi/3', (2 * Math.PI) / 3],
    ['-4π', -4 * Math.PI],
    ['π^2/6', Math.PI ** 2 / 6],
    ['√3/2', Math.sqrt(3) / 2],
    ['2√2', 2 * Math.SQRT2],
    ['sqrt(5)/5', Math.sqrt(5) / 5],
    ['(1+√5)/2', (1 + Math.sqrt(5)) / 2],
    ['3/(2π)', 3 / (2 * Math.PI)],
    ['2(1+π)', 2 * (1 + Math.PI)],
    ['π³/32', Math.PI ** 3 / 32],
    ['−2π/3', (-2 * Math.PI) / 3],
  ])('%s', (s, v) => {
    expect(parseNumber(s)).toBeCloseTo(v, 12);
  });
  it.each(['2π/', 'sqrt(-1)', '√', 'pie', '(2π', '2..5π'])('rejects %s', (s) => {
    expect(parseNumber(s)).toBeNull();
  });
});

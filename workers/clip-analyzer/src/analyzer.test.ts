import { describe, it, expect } from 'vitest';
import { analyzeSegment, mergeAdjacentSegments, analyzeTranscript } from './analyzer.js';
import type { TranscriptSegment } from '@clipper/shared';

function makeSegment(start: number, end: number, text: string): TranscriptSegment {
  return { start, end, text };
}

describe('analyzeSegment', () => {
  it('returns a ViralScore for a segment', () => {
    const segments = [makeSegment(0, 30, 'This is a normal sentence about something.')];
    const score = analyzeSegment(segments[0]!, 0, 1, segments);

    expect(score).toHaveProperty('total');
    expect(score).toHaveProperty('hookScore');
    expect(score).toHaveProperty('emotionScore');
    expect(score).toHaveProperty('engagementScore');
    expect(score).toHaveProperty('transcriptScore');
    expect(score).toHaveProperty('mostReplayed');
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(1);
  });

  it('boosts hook score for segments with hook keywords', () => {
    const segments = [makeSegment(0, 10, 'You won\'t believe this incredible secret!')];
    const score = analyzeSegment(segments[0]!, 0, 1, segments);

    expect(score.hookScore).toBeGreaterThan(0.5);
  });

  it('boosts emotion score for exclamations', () => {
    const segments = [makeSegment(0, 5, 'Wow! Amazing! Incredible!')];
    const score = analyzeSegment(segments[0]!, 0, 1, segments);

    expect(score.emotionScore).toBeGreaterThan(0.5);
  });

  it('scores middle segments higher for mostReplayed', () => {
    const segments = [
      makeSegment(0, 10, 'A'),
      makeSegment(10, 20, 'B'),
      makeSegment(20, 30, 'C'),
      makeSegment(30, 40, 'D'),
      makeSegment(40, 50, 'E'),
    ];

    const midScore = analyzeSegment(segments[2]!, 2, 5, segments);
    const edgeScore = analyzeSegment(segments[0]!, 0, 5, segments);

    expect(midScore.mostReplayed).toBeGreaterThan(edgeScore.mostReplayed);
  });
});

describe('mergeAdjacentSegments', () => {
  it('merges segments within max duration', () => {
    const segments = [
      makeSegment(0, 10, 'Hello'),
      makeSegment(10, 20, 'world'),
      makeSegment(20, 30, 'foo'),
    ];

    const merged = mergeAdjacentSegments(segments, 35);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe('Hello world foo');
  });

  it('splits segments exceeding max duration', () => {
    const segments = [
      makeSegment(0, 40, 'Long segment one'),
      makeSegment(40, 90, 'Long segment two'),
    ];

    const merged = mergeAdjacentSegments(segments, 50);

    expect(merged).toHaveLength(2);
  });

  it('returns empty array for empty input', () => {
    expect(mergeAdjacentSegments([], 60)).toEqual([]);
  });

  it('returns single segment unchanged', () => {
    const segments = [makeSegment(0, 30, 'Only one')];
    const merged = mergeAdjacentSegments(segments, 60);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.text).toBe('Only one');
  });
});

describe('analyzeTranscript', () => {
  it('returns clip candidates sorted by score descending', () => {
    const segments = [
      makeSegment(0, 20, 'You won\'t believe this incredible discovery!'),
      makeSegment(20, 40, 'This is just a normal boring sentence with no excitement.'),
      makeSegment(40, 60, 'Another amazing shocking moment! Wow!'),
    ];

    const candidates = analyzeTranscript(segments);

    expect(candidates.length).toBeGreaterThan(0);
    for (let i = 1; i < candidates.length; i++) {
      expect(candidates[i - 1]!.viralScore.total)
        .toBeGreaterThanOrEqual(candidates[i]!.viralScore.total);
    }
  });

  it('respects maxClips option', () => {
    const segments = Array.from({ length: 10 }, (_, i) =>
      makeSegment(i * 20, i * 20 + 19, `This is segment number ${i + 1} with some text.`)
    );

    const candidates = analyzeTranscript(segments, { maxClips: 3 });

    expect(candidates.length).toBeLessThanOrEqual(3);
  });

  it('filters segments below minDuration', () => {
    const segments = [
      makeSegment(0, 5, 'Short'),
      makeSegment(10, 40, 'Long enough segment with proper content for analysis'),
    ];

    const candidates = analyzeTranscript(segments, { minDuration: 10 });

    expect(candidates.every(c => (c.end - c.start) >= 10)).toBe(true);
  });

  it('returns candidates with reasoning', () => {
    const segments = [
      makeSegment(0, 30, 'This is an amazing incredible discovery! You won\'t believe!'),
    ];

    const candidates = analyzeTranscript(segments);

    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0]!.reasoning).toBeTruthy();
    expect(typeof candidates[0]!.reasoning).toBe('string');
  });

  it('returns empty array when all scores below threshold', () => {
    const segments = [
      makeSegment(0, 30, 'um uh well like you know just saying stuff whatever'),
    ];

    const candidates = analyzeTranscript(segments, { minScore: 0.9 });

    expect(candidates).toHaveLength(0);
  });
});

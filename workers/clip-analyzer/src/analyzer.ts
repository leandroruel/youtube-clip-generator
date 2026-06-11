import type { TranscriptSegment, ViralScore, ClipCandidate } from '@clipper/shared';
import { config } from './config.js';

const HOOK_KEYWORDS = [
  'you won\'t believe', 'incredible', 'amazing', 'shocking', 'crazy', 'wait till',
  'this is why', 'here\'s the thing', 'the truth is', 'look at this',
  'mind blowing', 'insane', 'unbelievable', 'epic', 'legendary',
  'number one', 'secret', 'warning', 'important', 'listen',
];

const HIGH_ENERGY_PATTERNS = /[!?]{1,}/g;
const PAUSE_PATTERN = /\.{3,}|—|–/g;

function calculateHookScore(text: string): number {
  const lower = text.toLowerCase();
  const matches = HOOK_KEYWORDS.filter(k => lower.includes(k)).length;
  return Math.min(matches / 3, 1);
}

function calculateEmotionScore(text: string): number {
  const exclamations = (text.match(/!/g) ?? []).length;
  const questions = (text.match(/\?/g) ?? []).length;
  const capsWords = text.split(' ').filter(w => w.length > 1 && w === w.toUpperCase()).length;

  const score = (exclamations * 0.4 + questions * 0.3 + capsWords * 0.05);
  return Math.min(score, 1);
}

function calculateEngagementScore(text: string): number {
  const words = text.split(/\s+/).length;
  const pauses = (text.match(PAUSE_PATTERN) ?? []).length;

  const densityScore = words > 5 && words < 30 ? 0.5 : 0.2;
  const pauseScore = Math.min(pauses * 0.2, 0.3);

  return Math.min(densityScore + pauseScore, 1);
}

function calculateTranscriptScore(text: string): number {
  const words = text.split(/\s+/).length;
  const avgWordLen = text.replace(/\s/g, '').length / Math.max(words, 1);

  const lengthScore = words >= 5 && words <= 40 ? 0.6 : 0.2;
  const complexityScore = avgWordLen >= 3 && avgWordLen <= 7 ? 0.4 : 0.1;

  return Math.min(lengthScore + complexityScore, 1);
}

function calculateMostReplayed(segmentIdx: number, totalSegments: number, segment: TranscriptSegment): number {
  const positionScore = 1 - Math.abs(segmentIdx / totalSegments - 0.5) * 2;
  const durationScore = Math.min((segment.end - segment.start) / 10, 1);

  return (positionScore * 0.5 + durationScore * 0.5);
}

export function analyzeSegment(
  segment: TranscriptSegment,
  segmentIdx: number,
  totalSegments: number,
  _allSegments: TranscriptSegment[],
): ViralScore {
  const mostReplayed = calculateMostReplayed(segmentIdx, totalSegments, segment);
  const transcriptScore = calculateTranscriptScore(segment.text);
  const hookScore = calculateHookScore(segment.text);
  const emotionScore = calculateEmotionScore(segment.text);
  const engagementScore = calculateEngagementScore(segment.text);

  const total = (
    mostReplayed * 0.15 +
    transcriptScore * 0.15 +
    hookScore * 0.30 +
    emotionScore * 0.20 +
    engagementScore * 0.20
  );

  return {
    mostReplayed: Math.round(mostReplayed * 100) / 100,
    transcriptScore: Math.round(transcriptScore * 100) / 100,
    hookScore: Math.round(hookScore * 100) / 100,
    emotionScore: Math.round(emotionScore * 100) / 100,
    engagementScore: Math.round(engagementScore * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function mergeAdjacentSegments(
  segments: TranscriptSegment[],
  maxDuration: number,
): TranscriptSegment[] {
  if (segments.length === 0) return [];

  const merged: TranscriptSegment[] = [];
  const first = segments[0];
  if (!first) return [];

  let current: TranscriptSegment = { start: first.start, end: first.end, text: first.text };

  for (let i = 1; i < segments.length; i++) {
    const next = segments[i];
    if (!next) continue;

    const mergedDuration = next.end - current.start;

    if (mergedDuration <= maxDuration) {
      current = {
        start: current.start,
        end: next.end,
        text: current.text + ' ' + next.text,
      };
    } else {
      merged.push(current);
      current = { start: next.start, end: next.end, text: next.text };
    }
  }
  merged.push(current);

  return merged;
}

export function analyzeTranscript(
  segments: TranscriptSegment[],
  options?: {
    maxClips?: number;
    minDuration?: number;
    maxDuration?: number;
    minScore?: number;
  },
): ClipCandidate[] {
  const maxClips = options?.maxClips ?? config.MAX_CLIPS;
  const minDuration = options?.minDuration ?? config.MIN_CLIP_DURATION;
  const maxDuration = options?.maxDuration ?? config.MAX_CLIP_DURATION;
  const minScore = options?.minScore ?? config.MIN_VIRAL_SCORE;

  const merged = mergeAdjacentSegments(segments, maxDuration);

  const candidates: ClipCandidate[] = merged
    .filter(s => (s.end - s.start) >= minDuration)
    .map((segment, idx) => {
      const viralScore = analyzeSegment(segment, idx, merged.length, merged);
      return {
        start: segment.start,
        end: segment.end,
        text: segment.text.trim(),
        viralScore,
        reasoning: buildReasoning(viralScore, segment),
      };
    })
    .filter(c => c.viralScore.total >= minScore)
    .sort((a, b) => b.viralScore.total - a.viralScore.total)
    .slice(0, maxClips);

  return candidates;
}

function buildReasoning(score: ViralScore, segment: TranscriptSegment): string {
  const reasons: string[] = [];

  if (score.hookScore > 0.5) reasons.push('strong hook language');
  if (score.emotionScore > 0.5) reasons.push('high emotional impact');
  if (score.engagementScore > 0.5) reasons.push('engaging delivery');
  if (score.mostReplayed > 0.7) reasons.push('optimal position in video');
  if (score.transcriptScore > 0.6) reasons.push('well-structured content');

  if (reasons.length === 0) reasons.push('moderate viral potential');

  return reasons.join(', ');
}

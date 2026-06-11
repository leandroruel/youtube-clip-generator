export interface ViralScore {
  mostReplayed: number;
  transcriptScore: number;
  hookScore: number;
  emotionScore: number;
  engagementScore: number;
  total: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ClipCandidate {
  start: number;
  end: number;
  text: string;
  viralScore: ViralScore;
  reasoning: string;
}

import { describe, it, expect } from 'vitest';
import { generateAssContent, type CaptionSegment } from './ass-generator.js';
import { CaptionAnimation, CaptionPosition } from '@clipper/shared';

const segments: CaptionSegment[] = [
  { start: 0, end: 2, text: 'Hello world' },
  { start: 3, end: 5, text: 'Test caption' },
];

describe('generateAssContent', () => {
  it('generates valid ASS header', () => {
    const ass = generateAssContent({ segments, style: {} as any });
    expect(ass).toContain('[Script Info]');
    expect(ass).toContain('ScriptType: v4.00+');
    expect(ass).toContain('[V4+ Styles]');
    expect(ass).toContain('[Events]');
  });

  it('includes all dialogue lines', () => {
    const ass = generateAssContent({ segments, style: {} as any });
    const lines = ass.split('\n').filter(l => l.startsWith('Dialogue:'));
    expect(lines).toHaveLength(2);
  });

  it('formats times correctly', () => {
    const ass = generateAssContent({ segments, style: {} as any });
    expect(ass).toContain('0:00:00.00');
    expect(ass).toContain('0:00:02.00');
    expect(ass).toContain('0:00:03.00');
    expect(ass).toContain('0:00:05.00');
  });

  it('applies font size', () => {
    const ass = generateAssContent({
      segments,
      style: { fontSize: 72, fontFamily: 'Arial', fontColor: '#FFFFFF', backgroundColor: '#000000', position: 'bottom', animation: 'none', outlineColor: '#000000', outlineWidth: 2 },
    });
    expect(ass).toContain('Arial,72');
  });

  it('applies font color', () => {
    const ass = generateAssContent({
      segments,
      style: { fontSize: 48, fontFamily: 'Arial', fontColor: '#FF5733', backgroundColor: '#000000', position: 'bottom', animation: 'none', outlineColor: '#000000', outlineWidth: 2 },
    });
    expect(ass).toContain('&H003357FF');
  });

  it('applies position alignment', () => {
    const top = generateAssContent({ segments, style: { fontSize: 48, fontFamily: 'Arial', fontColor: '#FFFFFF', backgroundColor: '#000000', position: CaptionPosition.TOP, animation: 'none', outlineColor: '#000000', outlineWidth: 2 } });
    expect(top).toContain(',8,');

    const mid = generateAssContent({ segments, style: { fontSize: 48, fontFamily: 'Arial', fontColor: '#FFFFFF', backgroundColor: '#000000', position: CaptionPosition.MIDDLE, animation: 'none', outlineColor: '#000000', outlineWidth: 2 } });
    expect(mid).toContain(',5,');

    const bot = generateAssContent({ segments, style: { fontSize: 48, fontFamily: 'Arial', fontColor: '#FFFFFF', backgroundColor: '#000000', position: CaptionPosition.BOTTOM, animation: 'none', outlineColor: '#000000', outlineWidth: 2 } });
    expect(bot).toContain(',2,');
  });

  it.each([
    ['fade', '\\fad('],
    ['bounce', '\\move('],
    ['slide_up', '\\move('],
    ['slide_left', '\\move('],
    ['scale', '\\fscx('],
    ['none', ''],
  ])('applies %s animation tags', (animation, expectedTag) => {
    const ass = generateAssContent({
      segments,
      style: { fontSize: 48, fontFamily: 'Arial', fontColor: '#FFFFFF', backgroundColor: '#000000', position: 'bottom', animation: animation as CaptionAnimation, outlineColor: '#000000', outlineWidth: 2 },
    });
    if (expectedTag) {
      expect(ass).toContain(expectedTag);
    } else {
      expect(ass).not.toContain('\\fad(');
      expect(ass).not.toContain('\\move(');
      expect(ass).not.toContain('\\fscx(');
    }
  });
});

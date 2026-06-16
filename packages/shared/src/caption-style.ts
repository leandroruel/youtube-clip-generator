export const CaptionPosition = {
  TOP: 'top',
  MIDDLE: 'middle',
  BOTTOM: 'bottom',
} as const;

export type CaptionPosition = (typeof CaptionPosition)[keyof typeof CaptionPosition];

export const CaptionAnimation = {
  FADE: 'fade',
  BOUNCE: 'bounce',
  SLIDE_UP: 'slide_up',
  SLIDE_LEFT: 'slide_left',
  TYPEWRITER: 'typewriter',
  SCALE: 'scale',
  HIGHLIGHT: 'highlight',
  NONE: 'none',
} as const;

export type CaptionAnimation = (typeof CaptionAnimation)[keyof typeof CaptionAnimation];

export interface CaptionStyle {
  fontFamily: string;
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  position: CaptionPosition;
  animation: CaptionAnimation;
  outlineColor?: string;
  outlineWidth?: number;
}

export const defaultCaptionStyle: CaptionStyle = {
  fontFamily: 'Arial',
  fontSize: 48,
  fontColor: '#FFFFFF',
  backgroundColor: '#000000',
  position: 'bottom',
  animation: 'fade',
  outlineColor: '#000000',
  outlineWidth: 2,
};

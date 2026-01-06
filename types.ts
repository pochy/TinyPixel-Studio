
export type Tool = 'pencil' | 'eraser' | 'bucket' | 'picker' | 'swap';

export interface Point {
  x: number;
  y: number;
}

export enum AnchorType {
  TOP_LEFT = 'TL', TOP_CENTER = 'TC', TOP_RIGHT = 'TR',
  MIDDLE_LEFT = 'ML', CENTER = 'C', MIDDLE_RIGHT = 'MR',
  BOTTOM_LEFT = 'BL', BOTTOM_CENTER = 'BC', BOTTOM_RIGHT = 'BR'
}

export enum ResizeMode {
  RESCALE_OBJECTS = 'RESCALE',
  FIX_TO_PAGE = 'FIX'
}

export enum PixelateMode {
  COVER = 'COVER',
  CONTAIN = 'CONTAIN',
  STRETCH = 'STRETCH'
}

export interface PixelateSettings {
  width: number;
  height: number;
  mode: PixelateMode;
  anchor: AnchorType;
  paletteSize: number;
  dither: boolean;
  bgColor: string;
}

export interface EditorState {
  grid: string[][];
  width: number;
  height: number;
  history: string[][][];
  historyIndex: number;
}

export const DEFAULT_SIZE = 32;
export const MAX_HISTORY = 50;

export const COLOR_PALETTE = [
  '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
  '#ffff00', '#00ffff', '#ff00ff', '#c0c0c0', '#808080',
  '#800000', '#808000', '#008000', '#800080', '#008080',
  '#000080', '#ffa500', '#a52a2a', '#800000', '#f0e68c'
];

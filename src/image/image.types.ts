export interface Size {
  width: number;
  height: number;
}

export interface Box extends Size {
  left: number;
  top: number;
}

export interface CaptionLayout {
  size: number;
  path: string;
  box: Box;
}

export type Color = 'white' | 'black';

export interface TextColors {
  fill: Color;
  shadow: Color;
}

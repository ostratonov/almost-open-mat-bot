export enum StatEvent {
  Picture = 'picture',
  Suggestion = 'suggestion',
}

export interface ActiveUser {
  name: string;
  pictures: number;
  suggestions: number;
}

export interface PeriodStats {
  pictures: number;
  groupPictures: number;
  suggestions: number;
  people: number;
  top: ActiveUser[];
}

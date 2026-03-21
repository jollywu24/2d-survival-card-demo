export type StatKey =
  | 'health'
  | 'hunger'
  | 'thirst'
  | 'temperature'
  | 'sanity'
  | 'fatigue';

export type CardType = 'resource' | 'action' | 'event' | 'tool';

export type Weather = 'sunny' | 'rain' | 'storm';
export type TimeOfDay = 'day' | 'night';
export type Terrain = 'beach' | 'jungle' | 'cave';

export interface PlayerState {
  health: number;
  hunger: number;
  thirst: number;
  temperature: number;
  sanity: number;
  fatigue: number;
}

export interface EnvironmentState {
  weather: Weather;
  timeOfDay: TimeOfDay;
  terrain: Terrain;
  day: number;
  turn: number;
}

export interface CardEffect {
  statChanges?: Partial<Record<StatKey, number>>;
  moveTerrain?: Terrain;
  changeWeather?: Weather;
  rest?: boolean;
  drawCards?: number;
  eventChanceBonus?: number;
}

export interface CardCondition {
  minStats?: Partial<Record<StatKey, number>>;
  allowedTerrains?: Terrain[];
  allowedTime?: TimeOfDay[];
  allowedWeather?: Weather[];
}

export interface CardDefinition {
  id: string;
  name: string;
  type: CardType;
  description: string;
  effect: CardEffect;
  condition?: CardCondition;
}

export interface EventOption {
  id: string;
  label: string;
  resultText: string;
  effect: CardEffect;
}

export interface EventDefinition {
  id: string;
  title: string;
  description: string;
  condition?: CardCondition;
  options: EventOption[];
}

export interface LogEntry {
  id: string;
  text: string;
}

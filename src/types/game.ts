export type StatKey =
  | 'health'
  | 'hunger'
  | 'thirst'
  | 'temperature'
  | 'sanity'
  | 'fatigue';

export type CardType = 'action' | 'resource' | 'recipe' | 'event' | 'skill';
export type ItemType = 'food' | 'water' | 'material' | 'tool' | 'medical';

export type Weather = 'sunny' | 'rain' | 'storm';
export type TimeOfDay = 'day' | 'dusk' | 'night';
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
  actionsRemaining: number;
  actionLimit: number;
}

export type EndingType = 'rescued' | 'survived' | 'dead';

export interface PrototypeGoal {
  id: string;
  day: number;
  title: string;
  description: string;
}

export interface JournalEntry {
  day: number;
  text: string;
}

export interface GameEnding {
  type: EndingType;
  title: string;
  description: string;
}

export interface PrototypeProgress {
  totalDays: number;
  shelterBuilt: boolean;
  jungleExplored: boolean;
  caveExplored: boolean;
  campfireCrafted: boolean;
  spearCrafted: boolean;
  beaconCrafted: boolean;
  lastActionSummary: string;
  resolvedCrises: string[];
  journal: JournalEntry[];
}

export interface ItemStackChange {
  itemId: string;
  amount: number;
}

export interface CraftingRecipe {
  id: string;
  name: string;
  description: string;
  requires: ItemStackChange[];
  preserves?: ItemStackChange[];
  produces: ItemStackChange[];
  category?: 'building' | 'food' | 'tool' | 'medical' | 'goal' | 'skill';
}

export interface CardEffect {
  statChanges?: Partial<Record<StatKey, number>>;
  moveTerrain?: Terrain;
  changeWeather?: Weather;
  rest?: boolean;
  drawCards?: number;
  eventChanceBonus?: number;
  gainItems?: ItemStackChange[];
  gainWorkbenchItems?: ItemStackChange[];
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
  actionCost?: number;
  effect: CardEffect;
  condition?: CardCondition;
}

export interface PrototypeCardSpec {
  id: string;
  name: string;
  type: CardType;
  actionCost: number;
  usageWindow: string;
  terrainFocus: string;
  functionBoundary: string;
  output: string;
  implementationStatus: 'implemented' | 'planned';
}

export interface PrototypeCardGroupSpec {
  type: CardType;
  label: string;
  targetCount: number;
  designBoundary: string;
  cards: PrototypeCardSpec[];
}

export interface ItemDefinition {
  id: string;
  name: string;
  type: ItemType;
  icon: string;
  description: string;
  effect?: CardEffect;
  maxStack: number;
  useActionCost?: number;
}

export interface BackpackSlot {
  slotIndex: number;
  itemId: string | null;
  amount: number;
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

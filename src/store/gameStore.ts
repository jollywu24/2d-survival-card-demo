import { create } from 'zustand';
import { randomEvents } from '../data/events';
import { starterDeck } from '../data/cards';
import type {
  CardCondition,
  CardDefinition,
  CardEffect,
  EnvironmentState,
  EventDefinition,
  LogEntry,
  PlayerState,
  StatKey,
} from '../types/game';

interface GameState {
  player: PlayerState;
  environment: EnvironmentState;
  deck: CardDefinition[];
  hand: CardDefinition[];
  activeEvent: EventDefinition | null;
  logs: LogEntry[];
  useCard: (cardId: string) => void;
  resolveEvent: (optionId: string) => void;
  nextTurn: () => void;
  resetGame: () => void;
}

const MAX_STAT = 100;
const MIN_STAT = 0;
const HAND_SIZE = 4;

const initialPlayer = (): PlayerState => ({
  health: 78,
  hunger: 62,
  thirst: 56,
  temperature: 58,
  sanity: 68,
  fatigue: 52,
});

const initialEnvironment = (): EnvironmentState => ({
  weather: 'sunny',
  timeOfDay: 'day',
  terrain: 'beach',
  day: 1,
  turn: 1,
});

const clamp = (value: number) => Math.max(MIN_STAT, Math.min(MAX_STAT, value));

const applyStatChanges = (
  player: PlayerState,
  statChanges: Partial<Record<StatKey, number>> = {},
): PlayerState => {
  const nextState = { ...player };

  (Object.keys(statChanges) as StatKey[]).forEach((key) => {
    nextState[key] = clamp(nextState[key] + (statChanges[key] ?? 0));
  });

  if (nextState.hunger < 30) {
    nextState.fatigue = clamp(nextState.fatigue - 6);
    nextState.health = clamp(nextState.health - 3);
  }

  if (nextState.thirst < 25) {
    nextState.health = clamp(nextState.health - 5);
    nextState.sanity = clamp(nextState.sanity - 4);
  }

  if (nextState.temperature < 35) {
    nextState.health = clamp(nextState.health - 4);
    nextState.fatigue = clamp(nextState.fatigue - 3);
  }

  if (nextState.fatigue < 25) {
    nextState.sanity = clamp(nextState.sanity - 5);
  }

  return nextState;
};

export const meetsCondition = (
  player: PlayerState,
  environment: EnvironmentState,
  condition?: CardCondition,
) => {
  if (!condition) {
    return true;
  }

  if (condition.minStats) {
    for (const [key, value] of Object.entries(condition.minStats) as [StatKey, number][]) {
      if (player[key] < value) {
        return false;
      }
    }
  }

  if (condition.allowedTerrains && !condition.allowedTerrains.includes(environment.terrain)) {
    return false;
  }

  if (condition.allowedTime && !condition.allowedTime.includes(environment.timeOfDay)) {
    return false;
  }

  if (condition.allowedWeather && !condition.allowedWeather.includes(environment.weather)) {
    return false;
  }

  return true;
};

const applyEffect = (
  player: PlayerState,
  environment: EnvironmentState,
  effect: CardEffect,
) => {
  const nextPlayer = applyStatChanges(player, effect.statChanges);
  const nextEnvironment: EnvironmentState = {
    ...environment,
    terrain: effect.moveTerrain ?? environment.terrain,
    weather: effect.changeWeather ?? environment.weather,
  };

  return { player: nextPlayer, environment: nextEnvironment };
};

const rotateDeck = (deck: CardDefinition[], hand: CardDefinition[], drawCount: number) => {
  const available = deck.filter((card) => !hand.some((handCard) => handCard.id === card.id));
  const nextHand = [...hand];

  for (let i = 0; i < drawCount; i += 1) {
    const candidate = available[i % Math.max(available.length, 1)];
    if (candidate && !nextHand.some((card) => card.id === candidate.id)) {
      nextHand.push(candidate);
    }
  }

  return nextHand.slice(0, HAND_SIZE);
};

const pickEvent = (player: PlayerState, environment: EnvironmentState) => {
  const candidates = randomEvents.filter((event) =>
    meetsCondition(player, environment, event.condition),
  );

  if (candidates.length === 0) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
};

const createLog = (text: string): LogEntry => ({
  id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
  text,
});

const createInitialState = () => ({
  player: initialPlayer(),
  environment: initialEnvironment(),
  deck: starterDeck,
  hand: starterDeck.slice(0, HAND_SIZE),
  activeEvent: null as EventDefinition | null,
  logs: [createLog('你在海滩醒来，身边只有零散的物资。')],
});

export const useGameStore = create<GameState>((set, get) => ({
  ...createInitialState(),

  useCard: (cardId) => {
    const state = get();
    const card = state.hand.find((item) => item.id === cardId);

    if (!card) {
      return;
    }

    if (!meetsCondition(state.player, state.environment, card.condition)) {
      set((current) => ({
        logs: [createLog(`【${card.name}】当前环境不满足使用条件。`), ...current.logs].slice(0, 8),
      }));
      return;
    }

    const applied = applyEffect(state.player, state.environment, card.effect);
    const nextHandBase = state.hand.filter((item) => item.id !== card.id);
    const nextHand = rotateDeck(
      state.deck,
      nextHandBase,
      1 + (card.effect.drawCards ?? 0),
    );

    const eventRoll = Math.random();
    const eventChance = 0.3 + (card.effect.eventChanceBonus ?? 0);
    const activeEvent = eventRoll < eventChance ? pickEvent(applied.player, applied.environment) : null;

    set((current) => ({
      player: applied.player,
      environment: applied.environment,
      hand: nextHand,
      activeEvent,
      logs: [
        createLog(`你使用了【${card.name}】。${card.description}`),
        ...(activeEvent ? [createLog(`事件触发：${activeEvent.title}`)] : []),
        ...current.logs,
      ].slice(0, 8),
    }));
  },

  resolveEvent: (optionId) => {
    const state = get();
    const event = state.activeEvent;
    const option = event?.options.find((item) => item.id === optionId);

    if (!event || !option) {
      return;
    }

    const applied = applyEffect(state.player, state.environment, option.effect);
    const nextHand = rotateDeck(state.deck, state.hand, option.effect.drawCards ?? 0);

    set((current) => ({
      player: applied.player,
      environment: applied.environment,
      hand: nextHand,
      activeEvent: null,
      logs: [
        createLog(`【${event.title}】${option.resultText}`),
        ...current.logs,
      ].slice(0, 8),
    }));
  },

  nextTurn: () => {
    const state = get();
    const nextTurn = state.environment.turn + 1;
    const isNight = nextTurn % 2 === 0;
    const nextEnvironment: EnvironmentState = {
      ...state.environment,
      turn: nextTurn,
      timeOfDay: isNight ? 'night' : 'day',
      day: state.environment.day + (isNight ? 0 : 1),
      weather: ['sunny', 'rain', 'storm'][Math.floor(Math.random() * 3)] as EnvironmentState['weather'],
    };

    const nextPlayer = applyStatChanges(state.player, {
      hunger: -8,
      thirst: -10,
      fatigue: isNight ? -6 : -3,
      temperature: nextEnvironment.weather === 'storm' ? -8 : nextEnvironment.weather === 'rain' ? -4 : 0,
      sanity: isNight ? -4 : 0,
    });

    set((current) => ({
      player: nextPlayer,
      environment: nextEnvironment,
      activeEvent: null,
      logs: [
        createLog(
          `进入第 ${nextEnvironment.day} 天 ${nextEnvironment.timeOfDay === 'day' ? '白天' : '夜晚'}，天气：${weatherLabel[nextEnvironment.weather]}`,
        ),
        ...current.logs,
      ].slice(0, 8),
    }));
  },

  resetGame: () => {
    set(createInitialState());
  },
}));

export const weatherLabel = {
  sunny: '晴天',
  rain: '雨天',
  storm: '风暴',
};

export const terrainLabel = {
  beach: '海滩',
  jungle: '丛林',
  cave: '洞穴',
};

export const timeLabel = {
  day: '白天',
  night: '夜晚',
};

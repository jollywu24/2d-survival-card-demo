import { create } from 'zustand';
import { starterDeck } from '../data/cards';
import { randomEvents } from '../data/events';
import { itemCatalog } from '../data/items';
import type {
  BackpackSlot,
  CardCondition,
  CardDefinition,
  CardEffect,
  CraftingRecipe,
  EnvironmentState,
  EventDefinition,
  ItemDefinition,
  ItemStackChange,
  LogEntry,
  PlayerState,
  StatKey,
} from '../types/game';

interface GameState {
  player: PlayerState;
  environment: EnvironmentState;
  deck: CardDefinition[];
  hand: CardDefinition[];
  backpack: BackpackSlot[];
  selectedBackpackSlot: number | null;
  activeEvent: EventDefinition | null;
  logs: LogEntry[];
  useCard: (cardId: string) => void;
  resolveEvent: (optionId: string) => void;
  selectBackpackSlot: (slotIndex: number) => void;
  moveSelectedToSlot: (slotIndex: number) => void;
  useBackpackItem: (slotIndex: number) => void;
  discardBackpackItem: (slotIndex: number) => void;
  craftRecipe: (recipeId: string) => void;
  nextTurn: () => void;
  resetGame: () => void;
}

const MAX_STAT = 100;
const MIN_STAT = 0;
const HAND_SIZE = 4;
const BACKPACK_SIZE = 16;

const itemById = new Map(itemCatalog.map((item) => [item.id, item]));

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

const createInitialBackpack = (): BackpackSlot[] =>
  Array.from({ length: BACKPACK_SIZE }, (_, slotIndex) => ({
    slotIndex,
    itemId: null,
    amount: 0,
  }));

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

const cloneBackpack = (backpack: BackpackSlot[]) => backpack.map((slot) => ({ ...slot }));

const addItemsToBackpack = (
  backpack: BackpackSlot[],
  gains: ItemStackChange[] = [],
): { backpack: BackpackSlot[]; overflow: string[] } => {
  const nextBackpack = cloneBackpack(backpack);
  const overflow: string[] = [];

  gains.forEach(({ itemId, amount }) => {
    const item = itemById.get(itemId);
    if (!item || amount <= 0) {
      return;
    }

    let remaining = amount;

    nextBackpack.forEach((slot) => {
      if (remaining === 0) {
        return;
      }
      if (slot.itemId !== itemId || slot.amount >= item.maxStack) {
        return;
      }

      const canAdd = Math.min(item.maxStack - slot.amount, remaining);
      slot.amount += canAdd;
      remaining -= canAdd;
    });

    nextBackpack.forEach((slot) => {
      if (remaining === 0) {
        return;
      }
      if (slot.itemId !== null) {
        return;
      }

      const canAdd = Math.min(item.maxStack, remaining);
      slot.itemId = itemId;
      slot.amount = canAdd;
      remaining -= canAdd;
    });

    if (remaining > 0) {
      overflow.push(`${item.name} x${remaining}`);
    }
  });

  return { backpack: nextBackpack, overflow };
};

const consumeOneFromSlot = (backpack: BackpackSlot[], slotIndex: number) => {
  const nextBackpack = cloneBackpack(backpack);
  const slot = nextBackpack[slotIndex];

  if (!slot || slot.itemId === null) {
    return nextBackpack;
  }

  slot.amount -= 1;
  if (slot.amount <= 0) {
    slot.itemId = null;
    slot.amount = 0;
  }

  return nextBackpack;
};

const swapBackpackSlots = (backpack: BackpackSlot[], fromIndex: number, toIndex: number) => {
  const nextBackpack = cloneBackpack(backpack);
  const fromSlot = nextBackpack[fromIndex];
  const toSlot = nextBackpack[toIndex];

  nextBackpack[fromIndex] = { ...toSlot, slotIndex: fromIndex };
  nextBackpack[toIndex] = { ...fromSlot, slotIndex: toIndex };
  return nextBackpack;
};

const craftingRecipes: CraftingRecipe[] = [
  {
    id: 'fiber-rope',
    name: '编制纤维绳',
    description: '把棕榈纤维搓成更牢固的绳索，便于后续制作工具。',
    requires: [{ itemId: 'palm-fiber', amount: 2 }],
    produces: [{ itemId: 'campfire-kit', amount: 1 }],
  },
  {
    id: 'field-medicine',
    name: '应急草药包',
    description: '用浆果和纤维打包成简易治疗包。',
    requires: [
      { itemId: 'berries', amount: 2 },
      { itemId: 'palm-fiber', amount: 1 },
    ],
    produces: [{ itemId: 'herb-bundle', amount: 1 }],
  },
  {
    id: 'fire-starter-pack',
    name: '野外引火包',
    description: '拆分木矛与纤维做成多份引火材料，便于夜间续火。',
    requires: [
      { itemId: 'spear', amount: 1 },
      { itemId: 'palm-fiber', amount: 2 },
    ],
    produces: [{ itemId: 'campfire-kit', amount: 2 }],
  },
];

const countBackpackItems = (backpack: BackpackSlot[]) => {
  const counts = new Map<string, number>();

  backpack.forEach((slot) => {
    if (!slot.itemId || slot.amount <= 0) {
      return;
    }
    counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + slot.amount);
  });

  return counts;
};

const canCraftRecipeFromBackpack = (backpack: BackpackSlot[], recipe: CraftingRecipe) => {
  const itemCounts = countBackpackItems(backpack);
  return recipe.requires.every((requirement) => (itemCounts.get(requirement.itemId) ?? 0) >= requirement.amount);
};

const consumeItemsFromBackpack = (backpack: BackpackSlot[], requirements: ItemStackChange[]) => {
  const nextBackpack = cloneBackpack(backpack);

  requirements.forEach(({ itemId, amount }) => {
    let remaining = amount;

    nextBackpack.forEach((slot) => {
      if (remaining <= 0 || slot.itemId !== itemId) {
        return;
      }

      const consumed = Math.min(slot.amount, remaining);
      slot.amount -= consumed;
      remaining -= consumed;

      if (slot.amount <= 0) {
        slot.itemId = null;
        slot.amount = 0;
      }
    });
  });

  return nextBackpack;
};

const createInitialState = () => {
  const seeded = addItemsToBackpack(createInitialBackpack(), [
    { itemId: 'berries', amount: 1 },
    { itemId: 'fresh-water', amount: 1 },
  ]).backpack;

  return {
    player: initialPlayer(),
    environment: initialEnvironment(),
    deck: starterDeck,
    hand: starterDeck.slice(0, HAND_SIZE),
    backpack: seeded,
    selectedBackpackSlot: null as number | null,
    activeEvent: null as EventDefinition | null,
    logs: [createLog('你在海滩醒来，身边只有零散的物资。')],
  };
};

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
        logs: [createLog(`【${card.name}】当前环境不满足使用条件。`), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const applied = applyEffect(state.player, state.environment, card.effect);
    const inventoryResult = addItemsToBackpack(state.backpack, card.effect.gainItems);
    const nextHandBase = state.hand.filter((item) => item.id !== card.id);
    const nextHand = rotateDeck(state.deck, nextHandBase, 1 + (card.effect.drawCards ?? 0));

    const eventRoll = Math.random();
    const eventChance = 0.3 + (card.effect.eventChanceBonus ?? 0);
    const activeEvent = eventRoll < eventChance ? pickEvent(applied.player, applied.environment) : null;
    const itemGainText =
      card.effect.gainItems && card.effect.gainItems.length > 0
        ? ` 获得：${card.effect.gainItems
            .map((entry) => `${itemById.get(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`)
            .join('、')}。`
        : '';
    const overflowText =
      inventoryResult.overflow.length > 0 ? ` 背包已满，掉落：${inventoryResult.overflow.join('、')}。` : '';

    set((current) => ({
      player: applied.player,
      environment: applied.environment,
      backpack: inventoryResult.backpack,
      hand: nextHand,
      activeEvent,
      logs: [
        createLog(`你使用了【${card.name}】。${card.description}${itemGainText}${overflowText}`),
        ...(activeEvent ? [createLog(`事件触发：${activeEvent.title}`)] : []),
        ...current.logs,
      ].slice(0, 10),
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
    const inventoryResult = addItemsToBackpack(state.backpack, option.effect.gainItems);
    const nextHand = rotateDeck(state.deck, state.hand, option.effect.drawCards ?? 0);

    set((current) => ({
      player: applied.player,
      environment: applied.environment,
      backpack: inventoryResult.backpack,
      hand: nextHand,
      activeEvent: null,
      logs: [
        createLog(`【${event.title}】${option.resultText}`),
        ...current.logs,
      ].slice(0, 10),
    }));
  },

  selectBackpackSlot: (slotIndex) => {
    set((state) => ({
      selectedBackpackSlot: state.selectedBackpackSlot === slotIndex ? null : slotIndex,
    }));
  },

  moveSelectedToSlot: (slotIndex) => {
    const state = get();
    const selected = state.selectedBackpackSlot;

    if (selected === null || selected === slotIndex) {
      return;
    }

    set((current) => ({
      backpack: swapBackpackSlots(current.backpack, selected, slotIndex),
      selectedBackpackSlot: slotIndex,
      logs: [createLog(`你重新整理了背包中的物品位置。`), ...current.logs].slice(0, 10),
    }));
  },

  useBackpackItem: (slotIndex) => {
    const state = get();
    const slot = state.backpack[slotIndex];
    if (!slot || slot.itemId === null) {
      return;
    }

    const item = itemById.get(slot.itemId);
    if (!item?.effect) {
      set((current) => ({
        logs: [createLog(`【${item?.name ?? '未知物品'}】当前只能摆放或丢弃。`), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const applied = applyEffect(state.player, state.environment, item.effect);
    const inventoryResult = addItemsToBackpack(consumeOneFromSlot(state.backpack, slotIndex), item.effect.gainItems);

    set((current) => ({
      player: applied.player,
      environment: applied.environment,
      backpack: inventoryResult.backpack,
      selectedBackpackSlot: current.selectedBackpackSlot === slotIndex ? null : current.selectedBackpackSlot,
      logs: [createLog(`你使用了背包物品【${item.name}】。`), ...current.logs].slice(0, 10),
    }));
  },

  discardBackpackItem: (slotIndex) => {
    const state = get();
    const slot = state.backpack[slotIndex];
    if (!slot || slot.itemId === null) {
      return;
    }

    const item = itemById.get(slot.itemId);
    const nextBackpack = cloneBackpack(state.backpack);
    nextBackpack[slotIndex] = { slotIndex, itemId: null, amount: 0 };

    set((current) => ({
      backpack: nextBackpack,
      selectedBackpackSlot: current.selectedBackpackSlot === slotIndex ? null : current.selectedBackpackSlot,
      logs: [createLog(`你丢弃了【${item?.name ?? '未知物品'}】。`), ...current.logs].slice(0, 10),
    }));
  },

  craftRecipe: (recipeId) => {
    const state = get();
    const recipe = craftingRecipes.find((entry) => entry.id === recipeId);

    if (!recipe) {
      return;
    }

    if (!canCraftRecipeFromBackpack(state.backpack, recipe)) {
      set((current) => ({
        logs: [createLog(`【${recipe.name}】材料不足，无法合成。`), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const consumedBackpack = consumeItemsFromBackpack(state.backpack, recipe.requires);
    const craftedResult = addItemsToBackpack(consumedBackpack, recipe.produces);
    const outputText = recipe.produces
      .map((entry) => `${itemById.get(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`)
      .join('、');
    const overflowText =
      craftedResult.overflow.length > 0 ? ` 背包空间不足，掉落：${craftedResult.overflow.join('、')}。` : '';

    set((current) => ({
      backpack: craftedResult.backpack,
      logs: [createLog(`你在工作台合成了【${recipe.name}】：${outputText}。${overflowText}`), ...current.logs].slice(0, 10),
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
        createLog(`进入第 ${nextEnvironment.day} 天 ${nextEnvironment.timeOfDay === 'day' ? '白天' : '夜晚'}，天气：${weatherLabel[nextEnvironment.weather]}`),
        ...current.logs,
      ].slice(0, 10),
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

export const getItemDefinition = (itemId: string | null): ItemDefinition | null => {
  if (!itemId) {
    return null;
  }
  return itemById.get(itemId) ?? null;
};

export const allCraftingRecipes = craftingRecipes;
export const canCraftInBackpack = (backpack: BackpackSlot[], recipe: CraftingRecipe) =>
  canCraftRecipeFromBackpack(backpack, recipe);

import { create } from 'zustand';
import { starterDeck } from '../data/cards';
import { randomEvents, scriptedEvents } from '../data/events';
import { itemCatalog } from '../data/items';
import type {
  BackpackSlot,
  CardCondition,
  CardDefinition,
  CardEffect,
  CraftingRecipe,
  EnvironmentState,
  EventDefinition,
  GameEnding,
  ItemDefinition,
  ItemStackChange,
  LogEntry,
  PlayerState,
  PrototypeGoal,
  PrototypeProgress,
  StatKey,
  WorkbenchCard,
} from '../types/game';

interface GameState {
  player: PlayerState;
  environment: EnvironmentState;
  progress: PrototypeProgress;
  deck: CardDefinition[];
  hand: CardDefinition[];
  backpack: BackpackSlot[];
  workbench: WorkbenchCard[];
  selectedBackpackSlot: number | null;
  selectedWorkbenchCardId: string | null;
  activeEvent: EventDefinition | null;
  ending: GameEnding | null;
  logs: LogEntry[];
  useCard: (cardId: string) => void;
  resolveEvent: (optionId: string) => void;
  setTerrain: (terrain: EnvironmentState['terrain']) => void;
  selectBackpackSlot: (slotIndex: number) => void;
  selectWorkbenchCard: (cardId: string | null) => void;
  moveSelectedToSlot: (slotIndex: number) => void;
  moveBackpackToWorkbench: (
    fromBackpackIndex: number,
    position?: { x: number; y: number },
    targetCardId?: string,
  ) => void;
  moveWorkbenchToBackpack: (workbenchCardId: string, toBackpackIndex?: number) => void;
  moveWorkbenchStack: (
    workbenchCardId: string,
    position?: { x: number; y: number },
    targetCardId?: string,
  ) => void;
  storeAllWorkbenchItems: () => void;
  useBackpackItem: (slotIndex: number) => void;
  useWorkbenchItem: (cardId: string) => void;
  discardBackpackItem: (slotIndex: number) => void;
  exploreTerrainDrops: (terrain: EnvironmentState['terrain']) => void;
  craftRecipe: (recipeId: string) => void;
  craftWorkbenchRecipe: () => void;
  sleepAndAdvance: () => void;
  nextTurn: () => void;
  resetGame: () => void;
}

const MAX_STAT = 100;
const MIN_STAT = 0;
const HAND_SIZE = 4;
const BACKPACK_SIZE = 12;
const BACKPACK_MAX_WEIGHT = 18;
const TOTAL_DAYS = 7;
const PHASE_ORDER: EnvironmentState['timeOfDay'][] = ['day', 'dusk', 'night'];
const PHASE_ACTION_LIMIT: Record<EnvironmentState['timeOfDay'], number> = {
  day: 12 * 60,
  dusk: 4 * 60,
  night: 8 * 60,
};
const TIME_PER_ACTION_POINT = 30;
const scriptedEventById = new Map(scriptedEvents.map((event) => [event.id, event]));

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
  actionsRemaining: PHASE_ACTION_LIMIT.day,
  actionLimit: PHASE_ACTION_LIMIT.day,
});

const initialProgress = (): PrototypeProgress => ({
  totalDays: TOTAL_DAYS,
  shelterBuilt: false,
  jungleExplored: false,
  caveExplored: false,
  campfireCrafted: false,
  spearCrafted: false,
  beaconCrafted: false,
  lastActionSummary: '你刚刚从海水里爬上岸，还没有真正开始求生。',
  resolvedCrises: [],
  journal: [],
});

const createInitialBackpack = (): BackpackSlot[] =>
  Array.from({ length: BACKPACK_SIZE }, (_, slotIndex) => ({
    slotIndex,
    itemId: null,
    amount: 0,
  }));

const createInitialWorkbench = (): WorkbenchCard[] => [];

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
const createEmptySlot = (slotIndex: number): BackpackSlot => ({
  slotIndex,
  itemId: null,
  amount: 0,
});

const defaultTypeWeight: Record<ItemDefinition['type'], number> = {
  material: 0.6,
  tool: 1.2,
  food: 0.5,
  water: 0.8,
  medical: 0.4,
};

const getItemWeight = (itemId: string) => {
  const item = itemById.get(itemId);
  if (!item) return 0;
  return item.weight ?? defaultTypeWeight[item.type] ?? 0;
};

const getBackpackWeight = (backpack: BackpackSlot[]) =>
  backpack.reduce((sum, slot) => {
    if (!slot.itemId || slot.amount <= 0) {
      return sum;
    }
    return sum + getItemWeight(slot.itemId) * slot.amount;
  }, 0);

const addItemsToBackpack = (
  backpack: BackpackSlot[],
  gains: ItemStackChange[] = [],
): { backpack: BackpackSlot[]; overflow: string[] } => {
  const nextBackpack = cloneBackpack(backpack);
  const overflow: string[] = [];
  let currentWeight = getBackpackWeight(nextBackpack);

  gains.forEach(({ itemId, amount }) => {
    const item = itemById.get(itemId);
    if (!item || amount <= 0) {
      return;
    }
    const singleWeight = getItemWeight(itemId);

    let remaining = amount;

    nextBackpack.forEach((slot) => {
      if (remaining === 0) {
        return;
      }
      if (slot.itemId !== itemId || slot.amount >= item.maxStack) {
        return;
      }
      const weightLimited =
        singleWeight > 0 ? Math.floor((BACKPACK_MAX_WEIGHT - currentWeight) / singleWeight) : remaining;
      const canAdd = Math.min(item.maxStack - slot.amount, remaining, Math.max(weightLimited, 0));
      if (canAdd <= 0) {
        return;
      }
      slot.amount += canAdd;
      remaining -= canAdd;
      currentWeight += canAdd * singleWeight;
    });

    nextBackpack.forEach((slot) => {
      if (remaining === 0) {
        return;
      }
      if (slot.itemId !== null) {
        return;
      }
      const weightLimited =
        singleWeight > 0 ? Math.floor((BACKPACK_MAX_WEIGHT - currentWeight) / singleWeight) : remaining;
      const canAdd = Math.min(item.maxStack, remaining, Math.max(weightLimited, 0));
      if (canAdd <= 0) {
        return;
      }
      slot.itemId = itemId;
      slot.amount = canAdd;
      remaining -= canAdd;
      currentWeight += canAdd * singleWeight;
    });

    if (remaining > 0) {
      overflow.push(`${item.name} x${remaining}`);
    }
  });

  return { backpack: nextBackpack, overflow };
};
const removeSingleUnitFromSlot = (
  backpack: BackpackSlot[],
  slotIndex: number,
): { slots: BackpackSlot[]; removedItemId: string | null } => {
  const nextBackpack = cloneBackpack(backpack);
  const slot = nextBackpack[slotIndex];

  if (!slot || slot.itemId === null || slot.amount <= 0) {
    return { slots: nextBackpack, removedItemId: null };
  }

  const removedItemId = slot.itemId;
  if (slot.amount <= 1) {
    nextBackpack[slotIndex] = createEmptySlot(slotIndex);
  } else {
    nextBackpack[slotIndex] = {
      ...slot,
      amount: slot.amount - 1,
    };
  }

  return { slots: nextBackpack, removedItemId };
};

const consumeOneFromSlot = (backpack: BackpackSlot[], slotIndex: number) =>
  removeSingleUnitFromSlot(backpack, slotIndex).slots;

const addSingleUnitToBackpackSlot = (
  backpack: BackpackSlot[],
  slotIndex: number,
  itemId: string,
): { backpack: BackpackSlot[]; added: boolean } => {
  const item = itemById.get(itemId);
  if (!item) {
    return { backpack: cloneBackpack(backpack), added: false };
  }

  const nextBackpack = cloneBackpack(backpack);
  const slot = nextBackpack[slotIndex];

  if (!slot) {
    return { backpack: nextBackpack, added: false };
  }
  const singleWeight = getItemWeight(itemId);
  const currentWeight = getBackpackWeight(nextBackpack);
  if (singleWeight > 0 && currentWeight + singleWeight > BACKPACK_MAX_WEIGHT + 1e-6) {
    return { backpack: nextBackpack, added: false };
  }

  if (slot.itemId === null) {
    nextBackpack[slotIndex] = {
      slotIndex,
      itemId,
      amount: 1,
    };
    return { backpack: nextBackpack, added: true };
  }

  if (slot.itemId !== itemId || slot.amount >= item.maxStack) {
    return { backpack: nextBackpack, added: false };
  }

  nextBackpack[slotIndex] = {
    ...slot,
    amount: slot.amount + 1,
  };

  return { backpack: nextBackpack, added: true };
};
const cloneWorkbench = (workbench: WorkbenchCard[]) => workbench.map((card) => ({ ...card }));

const createWorkbenchCard = (
  itemId: string,
  x: number,
  y: number,
  stackId?: string,
): WorkbenchCard => {
  const id = `${itemId}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  return {
    id,
    itemId,
    x,
    y,
    stackId: stackId ?? `${id}-stack`,
  };
};

const clampWorkbenchPosition = (position?: { x: number; y: number }) => ({
  x: Math.max(16, Math.min(1010, Math.round(position?.x ?? 32))),
  y: Math.max(16, Math.min(360, Math.round(position?.y ?? 32))),
});

const getWorkbenchCard = (workbench: WorkbenchCard[], cardId: string) =>
  workbench.find((card) => card.id === cardId) ?? null;

const getWorkbenchStackCards = (workbench: WorkbenchCard[], stackId: string) =>
  workbench.filter((card) => card.stackId === stackId);


const getWorkbenchCardGroupCards = (workbench: WorkbenchCard[], cardId: string) => {
  const sourceCard = getWorkbenchCard(workbench, cardId);
  if (!sourceCard) {
    return [] as WorkbenchCard[];
  }

  return workbench.filter(
    (card) => card.stackId === sourceCard.stackId && card.itemId === sourceCard.itemId,
  );
};
const addItemsToWorkbench = (
  workbench: WorkbenchCard[],
  gains: ItemStackChange[] = [],
  position?: { x: number; y: number },
  targetStackId?: string,
): WorkbenchCard[] => {
  const nextWorkbench = cloneWorkbench(workbench);
  const basePosition = clampWorkbenchPosition(position);
  const targetCard = targetStackId
    ? nextWorkbench.find((card) => card.stackId === targetStackId) ?? null
    : null;
  const totalGainCount = gains.reduce((total, entry) => total + Math.max(entry.amount, 0), 0);
  let offsetIndex = 0;

  gains.forEach(({ itemId, amount }) => {
    for (let i = 0; i < amount; i += 1) {
      if (targetCard) {
        nextWorkbench.push(createWorkbenchCard(itemId, targetCard.x, targetCard.y, targetStackId));
      } else {
        const column = totalGainCount === 1 ? 0 : offsetIndex % 7;
        const row = totalGainCount === 1 ? 0 : Math.floor(offsetIndex / 7);
        const spawnX = basePosition.x + column * 132;
        const spawnY = basePosition.y + row * 112;
        nextWorkbench.push(createWorkbenchCard(itemId, spawnX, spawnY));
      }
      offsetIndex += 1;
    }
  });

  return nextWorkbench;
};

const setWorkbenchStackPosition = (
  workbench: WorkbenchCard[],
  stackId: string,
  position?: { x: number; y: number },
) => {
  const nextWorkbench = cloneWorkbench(workbench);
  const nextPosition = clampWorkbenchPosition(position);
  return nextWorkbench.map((card) =>
    card.stackId === stackId
      ? {
          ...card,
          x: nextPosition.x,
          y: nextPosition.y,
        }
      : card,
  );
};

const moveWorkbenchSingleCard = (
  workbench: WorkbenchCard[],
  workbenchCardId: string,
  position?: { x: number; y: number },
  targetCardId?: string,
) => {
  const sourceCard = getWorkbenchCard(workbench, workbenchCardId);
  if (!sourceCard) {
    return cloneWorkbench(workbench);
  }

  const sourceStackCards = getWorkbenchStackCards(workbench, sourceCard.stackId);
  const movingWholeStack = sourceStackCards.length === 1;
  const targetCard =
    targetCardId && targetCardId !== workbenchCardId ? getWorkbenchCard(workbench, targetCardId) : null;
  const nextWorkbench = cloneWorkbench(workbench);

  if (targetCard) {
    if (targetCard.stackId === sourceCard.stackId) {
      return nextWorkbench;
    }

    return nextWorkbench.map((card) =>
      card.id === workbenchCardId
        ? {
            ...card,
            stackId: targetCard.stackId,
            x: targetCard.x,
            y: targetCard.y,
          }
        : card,
    );
  }

  const nextPosition = clampWorkbenchPosition(position);
  const nextStackId = movingWholeStack
    ? sourceCard.stackId
    : `${sourceCard.id}-split-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;

  return nextWorkbench.map((card) =>
    card.id === workbenchCardId
      ? {
          ...card,
          stackId: nextStackId,
          x: nextPosition.x,
          y: nextPosition.y,
        }
      : card,
  );
};

const removeWorkbenchCard = (workbench: WorkbenchCard[], cardId: string) =>
  cloneWorkbench(workbench).filter((card) => card.id !== cardId);
const findBackpackTargetSlot = (backpack: BackpackSlot[], itemId: string) => {
  const item = itemById.get(itemId);
  if (!item) {
    return -1;
  }

  const existingIndex = backpack.findIndex(
    (slot) => slot.itemId === itemId && slot.amount < item.maxStack,
  );
  if (existingIndex >= 0) {
    return existingIndex;
  }

  return backpack.findIndex((slot) => slot.itemId === null);
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
    id: 'stone-knife',
    name: '石刀',
    description: '把两块海滩小石子叠在一起，边缘磨出了一把最原始也最关键的石刀。',
    requires: [
      { itemId: 'pebble', amount: 2 },
    ],
    produces: [{ itemId: 'stone-knife', amount: 1 }],
    category: 'tool',
  },
  {
    id: 'open-green-coconut',
    name: '剖开青椰子',
    description: '石刀切开青椰子后，先得到可继续处理的椰体和一片粗糙的椰子皮。',
    requires: [
      { itemId: 'stone-knife', amount: 1 },
      { itemId: 'green-coconut', amount: 1 },
    ],
    preserves: [{ itemId: 'stone-knife', amount: 1 }],
    produces: [
      { itemId: 'opened-coconut', amount: 1 },
      { itemId: 'coconut-husk', amount: 1 },
    ],
    category: 'food',
  },
  {
    id: 'tap-coconut-water',
    name: '放出椰子水',
    description: '再切一刀，椰子水流了出来，剩下的椰体也变成了可以继续加工的带孔椰子。',
    requires: [
      { itemId: 'stone-knife', amount: 1 },
      { itemId: 'opened-coconut', amount: 1 },
    ],
    preserves: [{ itemId: 'stone-knife', amount: 1 }],
    produces: [
      { itemId: 'coconut-water', amount: 1 },
      { itemId: 'perforated-coconut', amount: 1 },
    ],
    category: 'food',
  },
  {
    id: 'scrape-coconut',
    name: '刮椰肉',
    description: '石刀顺着带孔椰子的内壁刮下椰肉，同时保留下两只还能当碗用的椰壳。',
    requires: [
      { itemId: 'stone-knife', amount: 1 },
      { itemId: 'perforated-coconut', amount: 1 },
    ],
    preserves: [{ itemId: 'stone-knife', amount: 1 }],
    produces: [
      { itemId: 'coconut-meat', amount: 1 },
      { itemId: 'coconut-bowl', amount: 2 },
    ],
    category: 'food',
  },
  {
    id: 'campfire',
    name: '篝火',
    description: '木材与燧石在工作台上堆出一个稳定火源，夜里终于有了真正的中心。',
    requires: [
      { itemId: 'driftwood', amount: 2 },
      { itemId: 'flint', amount: 1 },
    ],
    produces: [{ itemId: 'campfire', amount: 1 }],
    category: 'building',
  },
  {
    id: 'grilled-fish',
    name: '烤鱼',
    description: '把鲜鱼贴着篝火烤熟，火会留下，鱼会变成真正能撑人的热食。',
    requires: [
      { itemId: 'raw-fish', amount: 1 },
      { itemId: 'campfire', amount: 1 },
    ],
    preserves: [{ itemId: 'campfire', amount: 1 }],
    produces: [{ itemId: 'cooked-fish', amount: 1 }],
    category: 'food',
  },
  {
    id: 'temporary-shelter',
    name: '临时庇护所',
    description: '棕榈叶和藤蔓叠在一起，很自然就长成了一顶挡风避雨的小 shelter。',
    requires: [
      { itemId: 'palm-leaf', amount: 3 },
      { itemId: 'vine', amount: 2 },
    ],
    produces: [{ itemId: 'temporary-shelter', amount: 1 }],
    category: 'building',
  },
  {
    id: 'flint-knife',
    name: '燧石刀',
    description: '尖石加上藤蔓固定，很快就能做出第一把像样的切割工具。',
    requires: [
      { itemId: 'flint', amount: 2 },
      { itemId: 'vine', amount: 1 },
    ],
    produces: [{ itemId: 'flint-knife', amount: 1 }],
    category: 'tool',
  },
  {
    id: 'herb-salve',
    name: '草药药膏',
    description: '草药和净水揉在一起，做出的药膏终于能真正处理那些拖人的小伤。',
    requires: [
      { itemId: 'herb', amount: 2 },
      { itemId: 'fresh-water', amount: 1 },
    ],
    produces: [{ itemId: 'herb-salve', amount: 1 }],
    category: 'medical',
  },
  {
    id: 'water-collector',
    name: '集水装置',
    description: '竹节撑起棕榈叶之后，营地开始拥有第一件会自己工作的东西。',
    requires: [
      { itemId: 'bamboo', amount: 1 },
      { itemId: 'palm-leaf', amount: 2 },
    ],
    produces: [{ itemId: 'water-collector', amount: 1 }],
    category: 'building',
  },
  {
    id: 'simple-trap',
    name: '简易陷阱',
    description: '一根木材加几段藤蔓，已经足够搭出一个能赌运气的小机关。',
    requires: [
      { itemId: 'driftwood', amount: 1 },
      { itemId: 'vine', amount: 2 },
    ],
    produces: [{ itemId: 'simple-trap', amount: 1 }],
    category: 'tool',
  },
  {
    id: 'waterproof-wrap',
    name: '防水包裹',
    description: '把棕榈叶和藤蔓反复包扎，关键物资终于不再一淋就完蛋。',
    requires: [
      { itemId: 'palm-leaf', amount: 1 },
      { itemId: 'vine', amount: 1 },
    ],
    produces: [{ itemId: 'waterproof-wrap', amount: 1 }],
    category: 'tool',
  },
  {
    id: 'clean-container',
    name: '净水容器',
    description: '竹节和石块叠出一个粗糙但好用的容器，净化水源终于有了像样工具。',
    requires: [
      { itemId: 'bamboo', amount: 2 },
      { itemId: 'stone', amount: 1 },
    ],
    produces: [{ itemId: 'clean-container', amount: 1 }],
    category: 'tool',
  },
  {
    id: 'dried-meat',
    name: '肉干',
    description: '把多余的鱼肉借着篝火慢慢风干，得到一份能多撑几天的高价值食物。',
    requires: [
      { itemId: 'raw-fish', amount: 2 },
      { itemId: 'campfire', amount: 1 },
    ],
    preserves: [{ itemId: 'campfire', amount: 1 }],
    produces: [{ itemId: 'dried-meat', amount: 1 }],
    category: 'food',
  },
  {
    id: 'signal-beacon',
    name: '信号篝火',
    description: '篝火和兽皮叠成了巨大而显眼的信号装置，这是第七天最重要的一步。',
    requires: [
      { itemId: 'campfire', amount: 1 },
      { itemId: 'spear', amount: 1 },
      { itemId: 'beast-hide', amount: 1 },
    ],
    preserves: [{ itemId: 'campfire', amount: 1 }],
    produces: [{ itemId: 'signal-beacon', amount: 1 }],
    category: 'goal',
  },
  {
    id: 'spirit-totem',
    name: '精神支柱',
    description: '把三页日记叠在一起之后，它们不再只是文字，而成了撑住你的理由。',
    requires: [{ itemId: 'journal-page', amount: 3 }],
    produces: [{ itemId: 'spirit-totem', amount: 1 }],
    category: 'skill',
  },
];

const prototypeGoals: PrototypeGoal[] = [
  {
    id: 'stabilize-body',
    day: 1,
    title: '稳住基础生存',
    description: '让饱腹和水分都保持在 45 以上，先活过第一天。',
  },
  {
    id: 'prepare-fire',
    day: 2,
    title: '准备火源',
    description: '合成或收集火种包，为夜晚和恶劣天气做准备。',
  },
  {
    id: 'build-shelter',
    day: 3,
    title: '搭起庇护所',
    description: '至少完成一次搭建庇护所，证明你有了稳定营地。',
  },
  {
    id: 'explore-jungle',
    day: 4,
    title: '深入探索',
    description: '进入丛林一次，拿到新的资源与草药。',
  },
  {
    id: 'craft-weapon',
    day: 5,
    title: '准备自卫工具',
    description: '制作木矛，面对危机时不再赤手空拳。',
  },
  {
    id: 'signal-ready',
    day: 6,
    title: '搭建求救信号',
    description: '在工作台合成求救信标，为第七天做最后准备。',
  },
  {
    id: 'survive-until-rescue',
    day: 7,
    title: '撑到第七天',
    description: '保持生命值大于 0，等待救援或迎来最终结局。',
  },
];

const countSlotItems = (slots: BackpackSlot[]) => {
  const counts = new Map<string, number>();

  slots.forEach((slot) => {
    if (!slot.itemId || slot.amount <= 0) {
      return;
    }
    counts.set(slot.itemId, (counts.get(slot.itemId) ?? 0) + slot.amount);
  });

  return counts;
};

const countWorkbenchStackItems = (workbench: WorkbenchCard[], stackId: string) => {
  const counts = new Map<string, number>();

  workbench.forEach((card) => {
    if (card.stackId !== stackId) {
      return;
    }
    counts.set(card.itemId, (counts.get(card.itemId) ?? 0) + 1);
  });

  return counts;
};

const canCraftRecipeFromBackpack = (backpack: BackpackSlot[], recipe: CraftingRecipe) => {
  const itemCounts = countSlotItems(backpack);
  return recipe.requires.every((requirement) => (itemCounts.get(requirement.itemId) ?? 0) >= requirement.amount);
};

const getWorkbenchRecipeMatch = (
  workbench: WorkbenchCard[],
  selectedWorkbenchCardId: string | null,
) => {
  if (!selectedWorkbenchCardId) {
    return null;
  }

  const selectedCard = getWorkbenchCard(workbench, selectedWorkbenchCardId);
  if (!selectedCard) {
    return null;
  }

  const occupiedCounts = countWorkbenchStackItems(workbench, selectedCard.stackId);
  const entries = [...occupiedCounts.entries()];

  if (entries.length === 0) {
    return null;
  }

  return (
    craftingRecipes.find((recipe) => {
      if (entries.length !== recipe.requires.length) {
        return false;
      }

      return recipe.requires.every(
        (requirement) => occupiedCounts.get(requirement.itemId) === requirement.amount,
      );
    }) ?? null
  );
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

const removeWorkbenchCardsForRecipe = (
  workbench: WorkbenchCard[],
  stackId: string,
  recipe: CraftingRecipe,
) => {
  const preserveCounts = new Map<string, number>();
  (recipe.preserves ?? []).forEach((entry) => {
    preserveCounts.set(entry.itemId, (preserveCounts.get(entry.itemId) ?? 0) + entry.amount);
  });

  const consumeCounts = new Map<string, number>();
  recipe.requires.forEach((entry) => {
    consumeCounts.set(entry.itemId, (consumeCounts.get(entry.itemId) ?? 0) + entry.amount);
  });
  preserveCounts.forEach((amount, itemId) => {
    consumeCounts.set(itemId, Math.max(0, (consumeCounts.get(itemId) ?? 0) - amount));
  });

  return cloneWorkbench(workbench).filter((card) => {
    if (card.stackId !== stackId) {
      return true;
    }

    const preserveRemaining = preserveCounts.get(card.itemId) ?? 0;
    if (preserveRemaining > 0) {
      preserveCounts.set(card.itemId, preserveRemaining - 1);
      return true;
    }

    const consumeRemaining = consumeCounts.get(card.itemId) ?? 0;
    if (consumeRemaining > 0) {
      consumeCounts.set(card.itemId, consumeRemaining - 1);
      return false;
    }

    return true;
  });
};

const countTotalOwnedItem = (
  backpack: BackpackSlot[],
  workbench: WorkbenchCard[],
  itemId: string,
) => {
  const backpackCount = backpack.reduce((total, slot) => {
    if (slot.itemId !== itemId || slot.amount <= 0) {
      return total;
    }
    return total + slot.amount;
  }, 0);
  const workbenchCount = workbench.filter((card) => card.itemId === itemId).length;
  return backpackCount + workbenchCount;
};

const hasOwnedItem = (
  backpack: BackpackSlot[],
  workbench: WorkbenchCard[],
  itemId: string,
) => countTotalOwnedItem(backpack, workbench, itemId) > 0;

const mergeItemChanges = (...lists: Array<ItemStackChange[] | undefined>) => {
  const totals = new Map<string, number>();

  lists.forEach((list) => {
    (list ?? []).forEach((entry) => {
      totals.set(entry.itemId, (totals.get(entry.itemId) ?? 0) + entry.amount);
    });
  });

  return [...totals.entries()]
    .filter(([, amount]) => amount > 0)
    .map(([itemId, amount]) => ({ itemId, amount }));
};

const mergeEffects = (...effects: Array<CardEffect | undefined>): CardEffect => {
  const mergedStatChanges: Partial<Record<StatKey, number>> = {};
  let moveTerrain: EnvironmentState['terrain'] | undefined;
  let changeWeather: EnvironmentState['weather'] | undefined;
  let rest = false;
  let drawCards = 0;
  let eventChanceBonus = 0;

  effects.forEach((effect) => {
    if (!effect) {
      return;
    }

    Object.entries(effect.statChanges ?? {}).forEach(([key, value]) => {
      const statKey = key as StatKey;
      mergedStatChanges[statKey] = (mergedStatChanges[statKey] ?? 0) + (value ?? 0);
    });

    if (effect.moveTerrain) {
      moveTerrain = effect.moveTerrain;
    }
    if (effect.changeWeather) {
      changeWeather = effect.changeWeather;
    }
    rest = rest || !!effect.rest;
    drawCards += effect.drawCards ?? 0;
    eventChanceBonus += effect.eventChanceBonus ?? 0;
  });

  return {
    statChanges: Object.keys(mergedStatChanges).length > 0 ? mergedStatChanges : undefined,
    moveTerrain,
    changeWeather,
    rest: rest || undefined,
    drawCards: drawCards || undefined,
    eventChanceBonus: eventChanceBonus || undefined,
    gainItems: mergeItemChanges(...effects.map((effect) => effect?.gainItems)),
    gainWorkbenchItems: mergeItemChanges(...effects.map((effect) => effect?.gainWorkbenchItems)),
  };
};

const getPassiveTransitionOutcome = (
  backpack: BackpackSlot[],
  workbench: WorkbenchCard[],
  player: PlayerState,
  nextEnvironment: EnvironmentState,
  nextPhase: EnvironmentState['timeOfDay'],
  startOfNewDay: boolean,
) => {
  let nextPlayer = player;
  let nextBackpack = backpack;
  const logs: string[] = [];

  const hasCampfire = hasOwnedItem(backpack, workbench, 'campfire');
  const hasShelter = hasOwnedItem(backpack, workbench, 'temporary-shelter');
  const hasCollector = hasOwnedItem(backpack, workbench, 'water-collector');
  const hasTrap = hasOwnedItem(backpack, workbench, 'simple-trap');
  const hasWrap = hasOwnedItem(backpack, workbench, 'waterproof-wrap');
  const hasContainer = hasOwnedItem(backpack, workbench, 'clean-container');
  const hasTotem = hasOwnedItem(backpack, workbench, 'spirit-totem');

  if (hasCampfire && (nextPhase === 'dusk' || nextPhase === 'night')) {
    nextPlayer = applyStatChanges(nextPlayer, { temperature: 8, sanity: 4 });
    logs.push('篝火撑住了营地的温度。');
  }

  if (hasShelter && (nextPhase === 'night' || nextEnvironment.weather !== 'sunny')) {
    nextPlayer = applyStatChanges(nextPlayer, { temperature: 6, health: 2, sanity: 1 });
    logs.push('临时庇护所替你挡掉了部分风雨。');
  }

  if (hasWrap && (nextEnvironment.weather === 'rain' || nextEnvironment.weather === 'storm')) {
    nextPlayer = applyStatChanges(nextPlayer, { sanity: 3 });
    logs.push('防水包裹保住了关键物资。');
  }

  if (hasTotem && nextPhase === 'night') {
    nextPlayer = applyStatChanges(nextPlayer, { sanity: 6 });
    logs.push('精神支柱让你在夜里没有完全散掉。');
  }

  if (hasCollector && (nextEnvironment.weather === 'rain' || nextEnvironment.weather === 'storm')) {
    const waterYield = hasContainer ? 2 : 1;
    const collected = addItemsToBackpack(nextBackpack, [{ itemId: 'fresh-water', amount: waterYield }]);
    nextBackpack = collected.backpack;
    logs.push(
      collected.overflow.length > 0
        ? '集水装置接到了淡水，但背包太满没能全部收下。'
        : `集水装置接到了 ${waterYield} 份淡水。`,
    );
  }

  if (hasTrap && startOfNewDay) {
    const trapRoll = Math.random();
    if (trapRoll < 0.65) {
      const trappedItemId = trapRoll < 0.25 ? 'raw-fish' : trapRoll < 0.5 ? 'berries' : 'beast-hide';
      const trapped = addItemsToBackpack(nextBackpack, [{ itemId: trappedItemId, amount: 1 }]);
      nextBackpack = trapped.backpack;
      const trappedItemName = itemById.get(trappedItemId)?.name ?? trappedItemId;
      logs.push(
        trapped.overflow.length > 0
          ? `简易陷阱抓到了 ${trappedItemName}，但背包没地方放。`
          : `简易陷阱替你留下一份 ${trappedItemName}。`,
      );
    }
  }

  return { player: nextPlayer, backpack: nextBackpack, logs };
};

const getExploreBonusDrops = (
  backpack: BackpackSlot[],
  workbench: WorkbenchCard[],
  terrain: EnvironmentState['terrain'],
) => {
  const bonuses: string[] = [];
  const hasKnife =
    hasOwnedItem(backpack, workbench, 'stone-knife') ||
    hasOwnedItem(backpack, workbench, 'flint-knife');
  const hasSpear = hasOwnedItem(backpack, workbench, 'spear');
  const hasContainer = hasOwnedItem(backpack, workbench, 'clean-container');

  if (hasKnife) {
    bonuses.push(terrain === 'beach' ? 'pebble' : terrain === 'jungle' ? 'vine' : 'flint');
  }

  if (hasSpear) {
    if (terrain === 'beach') {
      bonuses.push('raw-fish');
    }
    if (terrain === 'jungle') {
      bonuses.push('beast-hide');
    }
  }

  if (hasContainer && terrain === 'cave') {
    bonuses.push('fresh-water');
  }

  return bonuses;
};

const getEventContextEffect = (
  backpack: BackpackSlot[],
  workbench: WorkbenchCard[],
  progress: PrototypeProgress,
  event: EventDefinition,
) => {
  const effects: CardEffect[] = [];
  const notes: string[] = [];
  const hasCampfire = hasOwnedItem(backpack, workbench, 'campfire');
  const hasCampfireKit = hasOwnedItem(backpack, workbench, 'campfire-kit');
  const hasShelter = hasOwnedItem(backpack, workbench, 'temporary-shelter');
  const hasWrap = hasOwnedItem(backpack, workbench, 'waterproof-wrap');
  const hasSpear = hasOwnedItem(backpack, workbench, 'spear');
  const hasTrap = hasOwnedItem(backpack, workbench, 'simple-trap');
  const hasContainer = hasOwnedItem(backpack, workbench, 'clean-container');
  const hasCollector = hasOwnedItem(backpack, workbench, 'water-collector');
  const hasKnife =
    hasOwnedItem(backpack, workbench, 'stone-knife') ||
    hasOwnedItem(backpack, workbench, 'flint-knife');

  if (event.id === 'first-night' && (hasCampfire || hasCampfireKit)) {
    effects.push({ statChanges: { temperature: 6, sanity: 4 } });
    notes.push('你提前准备的火源让第一夜没那么冷。');
  }

  if (event.id === 'storm-impact') {
    if (hasShelter) {
      effects.push({ statChanges: { temperature: 10, health: 4, sanity: 3 } });
      notes.push('庇护所扛住了最糟的一阵风。');
    }
    if (hasWrap) {
      effects.push({ statChanges: { sanity: 2 } });
      notes.push('防水包裹保住了关键物资。');
    }
  }

  if (event.id === 'forest-signs' && hasKnife) {
    effects.push({ gainItems: [{ itemId: 'herb', amount: 1 }] });
    notes.push('切割工具让你多带回了一点草药。');
  }

  if (event.id === 'boar-raid') {
    if (hasSpear) {
      effects.push({
        statChanges: { sanity: 5, health: 4 },
        gainItems: [{ itemId: 'beast-hide', amount: 1 }],
      });
      notes.push('木矛替你挡住了扑来的那一下，还留下了一块兽皮。');
    } else if (hasTrap) {
      effects.push({ statChanges: { sanity: 3 } });
      notes.push('营地边的陷阱拖慢了它冲进来的节奏。');
    }
  }

  if (event.id === 'dirty-water') {
    if (hasContainer) {
      effects.push({
        statChanges: { health: 4, thirst: 4 },
        gainItems: [{ itemId: 'fresh-water', amount: 1 }],
      });
      notes.push('净水容器把最坏的情况挡住了。');
    }
    if (hasCollector) {
      effects.push({ statChanges: { sanity: 2 } });
      notes.push('集水装置让你知道自己还没完全断水。');
    }
  }

  if (event.id === 'rescue-window' && progress.beaconCrafted) {
    effects.push({ statChanges: { sanity: 12, health: 6 } });
    notes.push('求救信标把火光抬得足够高，海面那头显然看见了。');
  }

  return {
    effect: mergeEffects(...effects),
    notes,
  };
};
const createInitialState = () => {
  const seeded = addItemsToBackpack(createInitialBackpack(), [
    { itemId: 'berries', amount: 1 },
    { itemId: 'fresh-water', amount: 1 },
    { itemId: 'driftwood', amount: 1 },
    { itemId: 'palm-leaf', amount: 1 },
  ]).backpack;

  return {
    player: initialPlayer(),
    environment: initialEnvironment(),
    progress: initialProgress(),
    deck: starterDeck,
    hand: starterDeck.slice(0, HAND_SIZE),
    backpack: seeded,
    workbench: createInitialWorkbench(),
    selectedBackpackSlot: null as number | null,
    selectedWorkbenchCardId: null as string | null,
    activeEvent: null as EventDefinition | null,
    ending: null as GameEnding | null,
    logs: [createLog('你在海滩醒来，身边只有零散的物资。')],
  };
};

const updateProgressFromAction = (
  progress: PrototypeProgress,
  cardId: string,
  actionSummary: string,
  gains: ItemStackChange[] = [],
) => ({
  ...progress,
  shelterBuilt: progress.shelterBuilt || cardId === 'build-shelter',
  jungleExplored: progress.jungleExplored || cardId === 'explore-jungle',
  caveExplored: progress.caveExplored || cardId === 'enter-cave',
  lastActionSummary: actionSummary,
  campfireCrafted:
    progress.campfireCrafted ||
    gains.some((entry) => entry.itemId === 'campfire'),
  spearCrafted:
    progress.spearCrafted ||
    cardId === 'craft-spear' ||
    gains.some((entry) => entry.itemId === 'spear'),
});

const appendJournalEntry = (
  journal: PrototypeProgress['journal'],
  day: number,
  player: PlayerState,
  progress: PrototypeProgress,
) => {
  const lowestStat = (
    Object.entries(player) as [StatKey, number][]
  ).sort((a, b) => a[1] - b[1])[0]?.[0];

  const lowStatLine =
    lowestStat === 'hunger'
      ? '胃里空得发紧，我知道明天一早必须先找吃的。'
      : lowestStat === 'thirst'
        ? '喉咙一直在发干，水的问题已经不能再拖。'
        : lowestStat === 'temperature'
          ? '一到风起的时候我就能感觉到寒意顺着背往里钻。'
          : lowestStat === 'sanity'
            ? '真正危险的不是眼前的岛，而是脑子里越来越吵的念头。'
            : '身体并不轻松，但至少还没彻底垮掉。';

  const tone =
    player.health < 35 || player.thirst < 30
      ? '今天几乎被荒野拖垮，我清楚地感觉到身体在报警。'
      : player.sanity < 40
        ? '真正难熬的不是饥饿，而是夜里那种无人回应的空旷感。'
        : '营地总算有了点秩序，我开始像个真正的求生者那样安排明天。';

  const milestone = progress.beaconCrafted
    ? '求救信标已经竖起来了，只差有人看见。'
    : progress.shelterBuilt
      ? '庇护所勉强成形，至少风雨来时不再完全暴露。'
      : '我还在和最基础的生存问题搏斗。';

  const crisisLine =
    progress.resolvedCrises.length > 0
      ? `今天最难忘的是${progress.resolvedCrises[0]}，我现在还能想起那一下心脏发紧的感觉。`
      : '今天没有彻底失控，这已经算是运气。';

  return [
    {
      day,
      text: `第 ${day} 天夜里。${progress.lastActionSummary}${tone}${lowStatLine}${milestone}${crisisLine}`,
    },
    ...journal,
  ].slice(0, TOTAL_DAYS);
};

const getGoalCompletion = (
  goalId: string,
  player: PlayerState,
  progress: PrototypeProgress,
) => {
  switch (goalId) {
    case 'stabilize-body':
      return player.hunger >= 45 && player.thirst >= 45;
    case 'prepare-fire':
      return progress.campfireCrafted;
    case 'build-shelter':
      return progress.shelterBuilt;
    case 'explore-jungle':
      return progress.jungleExplored;
    case 'craft-weapon':
      return progress.spearCrafted;
    case 'signal-ready':
      return progress.beaconCrafted;
    case 'survive-until-rescue':
      return player.health > 0;
    default:
      return false;
  }
};

const createEnding = (
  type: GameEnding['type'],
  progress: PrototypeProgress,
): GameEnding => {
  if (type === 'dead') {
    return {
      type,
      title: '求生失败',
      description: '你的生命值已经归零。这次荒野挑战止步于此，但日志会记住你撑到的每一天。',
    };
  }

  if (type === 'rescued') {
    return {
      type,
      title: '第七天：获救',
      description: '求救信标终于发挥作用。远处船只发现了你的火光，你带着这七天的痕迹离开了海岸。',
    };
  }

  return {
    type,
    title: '撑过七天',
    description: progress.beaconCrafted
      ? '你成功撑过七天，虽然救援没有立刻到来，但营地已经足够支撑你继续活下去。'
      : '你熬过了七天，却还没有建立起稳定的求救方案。这是生还，不是解脱。',
  };
};

const getScriptedEventIdForPhase = (day: number, phase: EnvironmentState['timeOfDay']) => {
  if (day === 1 && phase === 'night') {
    return 'first-night';
  }
  if (day === 2 && phase === 'dusk') {
    return 'tide-cache';
  }
  if (day === 3 && phase === 'night') {
    return 'storm-impact';
  }
  if (day === 4 && phase === 'dusk') {
    return 'forest-signs';
  }
  if (day === 5 && phase === 'night') {
    return 'boar-raid';
  }
  if (day === 6 && phase === 'day') {
    return 'dirty-water';
  }
  if (day === 7 && phase === 'dusk') {
    return 'rescue-window';
  }
  return null;
};

const getPhaseForeshadow = (day: number, phase: EnvironmentState['timeOfDay']) => {
  if (day === 1 && phase === 'dusk') {
    return '太阳下去得很快，今晚会是你真正意义上的第一夜。';
  }
  if (day === 2 && phase === 'day') {
    return '退潮后海滩上露出了新的漂流痕迹，也许能翻出点真正有用的东西。';
  }
  if (day === 3 && phase === 'dusk') {
    return '天边的云层压得很低，今晚恐怕不是普通的雨夜。';
  }
  if (day === 4 && phase === 'day') {
    return '内陆边缘出现了新折断的枝叶，里面像是有资源，也像是有风险。';
  }
  if (day === 5 && phase === 'dusk') {
    return '营地附近出现了翻动泥土的痕迹，像是有大型动物在徘徊。';
  }
  if (day === 6 && phase === 'day') {
    return '你发现存下来的淡水味道不太对，也许水源正在变坏。';
  }
  if (day === 7 && phase === 'day') {
    return '海平面今天格外清晰，如果要被看见，机会多半就在今天。';
  }
  return null;
};
const getNextPhase = (current: EnvironmentState['timeOfDay']) => {
  const index = PHASE_ORDER.indexOf(current);
  return PHASE_ORDER[(index + 1) % PHASE_ORDER.length];
};

const isStartOfNewDay = (current: EnvironmentState['timeOfDay'], next: EnvironmentState['timeOfDay']) =>
  current === 'night' && next === 'day';

const getPhaseStatDecay = (
  phase: EnvironmentState['timeOfDay'],
  weather: EnvironmentState['weather'],
): Partial<Record<StatKey, number>> => {
  const weatherTemperaturePenalty =
    weather === 'storm' ? -8 : weather === 'rain' ? -4 : 0;

  if (phase === 'day') {
    return {
      hunger: -5,
      thirst: -6,
      fatigue: -3,
      temperature: weatherTemperaturePenalty,
    };
  }

  if (phase === 'dusk') {
    return {
      hunger: -3,
      thirst: -4,
      fatigue: -4,
      temperature: weatherTemperaturePenalty - 2,
      sanity: -2,
    };
  }

  return {
    hunger: -4,
    thirst: -5,
    fatigue: -6,
    temperature: weatherTemperaturePenalty - 4,
    sanity: -4,
  };
};

const canAffordAction = (environment: EnvironmentState, cost: number) =>
  environment.actionsRemaining >= cost;
const toTimeCost = (costPoints: number) => Math.max(TIME_PER_ACTION_POINT, costPoints * TIME_PER_ACTION_POINT);

const spendActions = (environment: EnvironmentState, cost: number): EnvironmentState => ({
  ...environment,
  actionsRemaining: Math.max(0, environment.actionsRemaining - cost),
});

const applyEffortDrain = (player: PlayerState, timeCost: number) =>
  applyStatChanges(player, {
    fatigue: -(timeCost * 7),
    thirst: -(timeCost * 2),
    hunger: -(timeCost * 1),
  });

const applySleepRecovery = (player: PlayerState) =>
  applyStatChanges(player, {
    fatigue: 34,
    sanity: 10,
    health: 4,
  });
const terrainDropPool: Record<EnvironmentState['terrain'], string[]> = {
  beach: ['green-coconut', 'driftwood', 'pebble', 'palm-leaf', 'fresh-water'],
  jungle: ['driftwood', 'vine', 'herb', 'bamboo', 'berries'],
  cave: ['flint', 'stone', 'herb', 'fresh-water', 'pebble'],
};
const pickRandomTerrainDrops = (terrain: EnvironmentState['terrain']) => {
  const pool = terrainDropPool[terrain];
  const count = 3 + Math.floor(Math.random() * 3);
  return Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]);
};

const phaseSummaryLabel = (phase: EnvironmentState['timeOfDay']) => {
  if (phase === 'day') {
    return '白天';
  }
  if (phase === 'dusk') {
    return '黄昏';
  }
  return '夜里';
};

export const useGameStore = create<GameState>((set, get) => ({
  ...createInitialState(),

  useCard: (cardId) => {
    const state = get();
    if (state.ending) {
      return;
    }
    if (state.activeEvent) {
      set((current) => ({
        logs: [createLog('请先处理当前事件，再执行新的行动。'), ...current.logs].slice(0, 10),
      }));
      return;
    }
    const card = state.hand.find((item) => item.id === cardId);

    if (!card) {
      return;
    }

    const actionCost = card.actionCost ?? 1;
    const timeCost = toTimeCost(actionCost);
    if (!canAffordAction(state.environment, timeCost)) {
      set((current) => ({
        logs: [
          createLog(`【${card.name}】需要 ${timeCost} 分钟，但当前时段只剩 ${state.environment.actionsRemaining} 分钟。`),
          ...current.logs,
        ].slice(0, 10),
      }));
      return;
    }

    if (!meetsCondition(state.player, state.environment, card.condition)) {
      set((current) => ({
        logs: [createLog(`【${card.name}】当前环境不满足使用条件。`), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const applied = applyEffect(state.player, state.environment, card.effect);
    const playerAfterEffort = applyEffortDrain(applied.player, actionCost);
    const environmentAfterAction = spendActions(applied.environment, timeCost);
    const inventoryResult = addItemsToBackpack(state.backpack, card.effect.gainItems);
    const nextWorkbench = addItemsToWorkbench(
      state.workbench,
      card.effect.gainWorkbenchItems,
      { x: 182, y: 72 },
    );
    const nextSelectedWorkbenchCardId = nextWorkbench[nextWorkbench.length - 1]?.id ?? null;
    const nextProgress = updateProgressFromAction(
      state.progress,
      card.id,
      `${phaseSummaryLabel(state.environment.timeOfDay)}的主要精力花在了“${card.name}”上。`,
      [...(card.effect.gainItems ?? []), ...(card.effect.gainWorkbenchItems ?? [])],
    );
    const nextHandBase = state.hand.filter((item) => item.id !== card.id);
    const nextHand = rotateDeck(state.deck, nextHandBase, 1 + (card.effect.drawCards ?? 0));

    const eventRoll = Math.random();
    const eventChance = 0.3 + (card.effect.eventChanceBonus ?? 0);
    const activeEvent = eventRoll < eventChance ? pickEvent(applied.player, environmentAfterAction) : null;
    const itemGainText =
      card.effect.gainItems && card.effect.gainItems.length > 0
        ? ` 获得：${card.effect.gainItems
            .map((entry) => `${itemById.get(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`)
            .join('、')}。`
        : '';
    const workbenchGainText =
      card.effect.gainWorkbenchItems && card.effect.gainWorkbenchItems.length > 0
        ? ` 工作台翻出：${card.effect.gainWorkbenchItems
            .map((entry) => `${itemById.get(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`)
            .join('、')}。`
        : '';
    const overflowText =
      inventoryResult.overflow.length > 0 ? ` 背包已满，掉落：${inventoryResult.overflow.join('、')}。` : '';

    set((current) => ({
      player: playerAfterEffort,
      environment: environmentAfterAction,
      progress: nextProgress,
      backpack: inventoryResult.backpack,
      workbench: nextWorkbench,
      selectedWorkbenchCardId: nextSelectedWorkbenchCardId,
      hand: nextHand,
      activeEvent,
      logs: [
        createLog(`你使用了【${card.name}】。${card.description}${itemGainText}${workbenchGainText}${overflowText}`),
        ...(activeEvent ? [createLog(`事件触发：${activeEvent.title}`)] : []),
        ...current.logs,
      ].slice(0, 10),
    }));

    if (!activeEvent && environmentAfterAction.actionsRemaining <= 0) {
      get().nextTurn();
    }
  },

  resolveEvent: (optionId) => {
    const state = get();
    if (state.ending) {
      return;
    }
    const event = state.activeEvent;
    const option = event?.options.find((item) => item.id === optionId);

    if (!event || !option) {
      return;
    }

    const contextBonus = getEventContextEffect(state.backpack, state.workbench, state.progress, event);
    const finalEffect = mergeEffects(option.effect, contextBonus.effect);
    const applied = applyEffect(state.player, state.environment, finalEffect);
    const inventoryResult = addItemsToBackpack(state.backpack, finalEffect.gainItems);
    const nextHand = rotateDeck(state.deck, state.hand, finalEffect.drawCards ?? 0);
    const overflowText =
      inventoryResult.overflow.length > 0 ? ` 背包太满，没能收下：${inventoryResult.overflow.join('、')}。` : '';
    const bonusText = contextBonus.notes.length > 0 ? ` ${contextBonus.notes.join('')}` : '';

    set((current) => ({
      player: applied.player,
      environment: applied.environment,
      progress: {
        ...current.progress,
        lastActionSummary: `我最终选择了“${option.label}”来应对${event.title}。`,
        resolvedCrises: [event.title, ...current.progress.resolvedCrises].slice(0, 6),
      },
      backpack: inventoryResult.backpack,
      hand: nextHand,
      activeEvent: null,
      logs: [
        createLog(`【${event.title}】${option.resultText}${bonusText}${overflowText}`),
        ...current.logs,
      ].slice(0, 10),
    }));
  },
  setTerrain: (terrain) => {
    const state = get();
    if (state.ending || state.activeEvent) {
      return;
    }

    if (state.environment.terrain === terrain) {
      return;
    }

    set((current) => ({
      environment: {
        ...current.environment,
        terrain,
      },
      progress: {
        ...current.progress,
        lastActionSummary: `我把今天的注意力转向了${terrainLabel[terrain]}。`,
      },
      logs: [createLog(`你转向了${terrainLabel[terrain]}。`), ...current.logs].slice(0, 10),
    }));
  },

  selectBackpackSlot: (slotIndex) => {
    set((state) => ({
      selectedBackpackSlot: state.ending
        ? state.selectedBackpackSlot
        : state.selectedBackpackSlot === slotIndex
          ? null
          : slotIndex,
      selectedWorkbenchCardId: state.ending ? state.selectedWorkbenchCardId : null,
    }));
  },

  selectWorkbenchCard: (cardId) => {
    set((state) => ({
      selectedWorkbenchCardId: state.ending
        ? state.selectedWorkbenchCardId
        : state.selectedWorkbenchCardId === cardId
          ? null
          : cardId,
      selectedBackpackSlot: state.ending ? state.selectedBackpackSlot : null,
    }));
  },

  moveSelectedToSlot: (slotIndex) => {
    const state = get();
    if (state.ending) {
      return;
    }
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

  moveBackpackToWorkbench: (fromBackpackIndex, position, targetCardId) => {
    const state = get();
    if (state.ending) {
      return;
    }

    const sourceSlot = state.backpack[fromBackpackIndex];
    if (!sourceSlot?.itemId) {
      return;
    }

    const targetCard = targetCardId ? getWorkbenchCard(state.workbench, targetCardId) : null;
    const removed = removeSingleUnitFromSlot(state.backpack, fromBackpackIndex);
    if (!removed.removedItemId) {
      return;
    }

    const nextWorkbench = addItemsToWorkbench(
      state.workbench,
      [{ itemId: removed.removedItemId, amount: 1 }],
      position,
      targetCard?.stackId,
    );
    const nextSelectedCardId = targetCardId ?? nextWorkbench[nextWorkbench.length - 1]?.id ?? null;
    const movedItemName = itemById.get(removed.removedItemId ?? '')?.name ?? removed.removedItemId ?? '未知物品';

    set((current) => ({
      backpack: removed.slots,
      workbench: nextWorkbench,
      selectedBackpackSlot: null,
      selectedWorkbenchCardId: nextSelectedCardId,
      logs: [
        createLog(
          targetCard
            ? `你把【${movedItemName}】叠到了已有卡堆上。`
            : `你把【${movedItemName}】放上了工作台。`,
        ),
        ...current.logs,
      ].slice(0, 10),
    }));
  },

  moveWorkbenchToBackpack: (workbenchCardId, toBackpackIndex) => {
    const state = get();
    if (state.ending) {
      return;
    }

    const sourceCard = getWorkbenchCard(state.workbench, workbenchCardId);
    if (!sourceCard) {
      return;
    }

    const targetIndex =
      typeof toBackpackIndex === 'number'
        ? toBackpackIndex
        : findBackpackTargetSlot(state.backpack, sourceCard.itemId);

    if (targetIndex < 0) {
      set((current) => ({
        logs: [createLog('背包没有空位，工作台上的卡暂时收不回去。'), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const inserted = addSingleUnitToBackpackSlot(state.backpack, targetIndex, sourceCard.itemId);
    if (!inserted.added) {
      set((current) => ({
        logs: [createLog('目标背包格无法接收这张卡（可能超出负重或堆叠限制）。'), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const nextWorkbench = removeWorkbenchCard(state.workbench, workbenchCardId);

    set((current) => ({
      backpack: inserted.backpack,
      workbench: nextWorkbench,
      selectedWorkbenchCardId:
        current.selectedWorkbenchCardId === workbenchCardId ? null : current.selectedWorkbenchCardId,
      selectedBackpackSlot: targetIndex,
      logs: [
        createLog(`你把【${itemById.get(sourceCard.itemId)?.name ?? sourceCard.itemId}】收回了背包。`),
        ...current.logs,
      ].slice(0, 10),
    }));
  },

  moveWorkbenchStack: (workbenchCardId, position, targetCardId) => {
    const state = get();
    if (state.ending) {
      return;
    }

    const sourceCard = getWorkbenchCard(state.workbench, workbenchCardId);
    if (!sourceCard) {
      return;
    }

    const sourceStackCards = getWorkbenchStackCards(state.workbench, sourceCard.stackId);
    const movingWholeStack = sourceStackCards.length === 1;
    const targetCard =
      targetCardId && targetCardId !== workbenchCardId
        ? getWorkbenchCard(state.workbench, targetCardId)
        : null;

    const nextWorkbench = moveWorkbenchSingleCard(
      state.workbench,
      workbenchCardId,
      position,
      targetCardId,
    );

    set((current) => ({
      workbench: nextWorkbench,
      selectedWorkbenchCardId: targetCard?.id ?? workbenchCardId,
      logs: [
        createLog(
          targetCard
            ? movingWholeStack
              ? '你把这张卡拖到了另一叠上。'
              : '你把这张卡从原堆里拖出来，叠到了另一叠上。'
            : movingWholeStack
              ? '你挪动了这张卡的位置。'
              : '你把这张卡从原堆里拖了出来。',
        ),
        ...current.logs,
      ].slice(0, 10),
    }));
  },

  storeAllWorkbenchItems: () => {
    const state = get();
    if (state.ending) {
      return;
    }

    let nextBackpack = cloneBackpack(state.backpack);
    const blockedItems: string[] = [];
    const remainingWorkbench: WorkbenchCard[] = [];

    state.workbench.forEach((card) => {
      const targetIndex = findBackpackTargetSlot(nextBackpack, card.itemId);
      if (targetIndex < 0) {
        blockedItems.push(itemById.get(card.itemId)?.name ?? card.itemId);
        remainingWorkbench.push(card);
        return;
      }

      const inserted = addSingleUnitToBackpackSlot(nextBackpack, targetIndex, card.itemId);
      if (!inserted.added) {
        blockedItems.push(itemById.get(card.itemId)?.name ?? card.itemId);
        remainingWorkbench.push(card);
        return;
      }

      nextBackpack = inserted.backpack;
    });

    set((current) => ({
      backpack: nextBackpack,
      workbench: remainingWorkbench,
      selectedWorkbenchCardId: remainingWorkbench.some((card) => card.id === current.selectedWorkbenchCardId)
        ? current.selectedWorkbenchCardId
        : null,
      logs: [
        createLog(
          blockedItems.length > 0
            ? `工作台已尽量清空，但这些卡没法放回背包（空间或负重不足）：${blockedItems.join('、')}。`
            : '你把工作台上的卡都收回了背包。',
        ),
        ...current.logs,
      ].slice(0, 10),
    }));
  },
  useBackpackItem: (slotIndex) => {
    const state = get();
    if (state.ending) {
      return;
    }
    if (state.activeEvent) {
      set((current) => ({
        logs: [createLog('请先处理当前事件，再使用背包物品。'), ...current.logs].slice(0, 10),
      }));
      return;
    }
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

    const actionCost =
      item.useActionCost ?? (item.type === 'food' || item.type === 'water' ? 0 : 1);
    const timeCost = actionCost === 0 ? 0 : toTimeCost(actionCost);
    if (!canAffordAction(state.environment, timeCost)) {
      set((current) => ({
        logs: [
          createLog(`本阶段时间不足，无法使用【${item.name}】。`),
          ...current.logs,
        ].slice(0, 10),
      }));
      return;
    }

    const applied = applyEffect(state.player, state.environment, item.effect);
    const playerAfterEffort = applyEffortDrain(applied.player, actionCost);
    const environmentAfterAction = spendActions(applied.environment, timeCost);
    const inventoryResult = addItemsToBackpack(
      consumeOneFromSlot(state.backpack, slotIndex),
      item.effect.gainItems,
    );
    const gainText =
      item.effect.gainItems && item.effect.gainItems.length > 0
        ? ` 并留下了 ${item.effect.gainItems
            .map((entry) => `${itemById.get(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`)
            .join('、')}。`
        : '';

    set((current) => ({
      player: playerAfterEffort,
      environment: environmentAfterAction,
      progress: {
        ...current.progress,
        lastActionSummary: `我从背包里拿出了${item.name}，希望这一步足够值得。`,
      },
      backpack: inventoryResult.backpack,
      selectedBackpackSlot: current.selectedBackpackSlot === slotIndex ? null : current.selectedBackpackSlot,
      logs: [createLog(`你使用了背包物品【${item.name}】。${gainText}`), ...current.logs].slice(0, 10),
    }));
  },

  useWorkbenchItem: (cardId) => {
    const state = get();
    if (state.ending) {
      return;
    }
    if (state.activeEvent) {
      set((current) => ({
        logs: [createLog('请先处理当前事件，再使用工作台上的物品。'), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const card = getWorkbenchCard(state.workbench, cardId);
    if (!card) {
      return;
    }

    const item = itemById.get(card.itemId);
    if (!item?.effect) {
      set((current) => ({
        logs: [createLog(`【${item?.name ?? '未知物品'}】现在还不能直接从工作台使用。`), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const actionCost =
      item.useActionCost ?? (item.type === 'food' || item.type === 'water' ? 0 : 1);
    const timeCost = actionCost === 0 ? 0 : toTimeCost(actionCost);
    if (!canAffordAction(state.environment, timeCost)) {
      set((current) => ({
        logs: [
          createLog(`本阶段时间不足，无法使用【${item.name}】。`),
          ...current.logs,
        ].slice(0, 10),
      }));
      return;
    }

    const applied = applyEffect(state.player, state.environment, item.effect);
    const playerAfterEffort = applyEffortDrain(applied.player, actionCost);
    const environmentAfterAction = spendActions(applied.environment, timeCost);
    const nextWorkbench = removeWorkbenchCard(state.workbench, cardId);
    const inventoryResult = addItemsToBackpack(state.backpack, item.effect.gainItems);
    const gainText =
      item.effect.gainItems && item.effect.gainItems.length > 0
        ? ` 并留下了 ${item.effect.gainItems
            .map((entry) => `${itemById.get(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`)
            .join('、')}。`
        : '';

    set((current) => ({
      player: playerAfterEffort,
      environment: environmentAfterAction,
      progress: {
        ...current.progress,
        lastActionSummary: `我直接在工作台上处理了${item.name}。`,
      },
      backpack: inventoryResult.backpack,
      workbench: nextWorkbench,
      selectedWorkbenchCardId:
        current.selectedWorkbenchCardId === cardId ? null : current.selectedWorkbenchCardId,
      logs: [createLog(`你直接在工作台上使用了【${item.name}】。${gainText}`), ...current.logs].slice(0, 10),
    }));
  },
  discardBackpackItem: (slotIndex) => {
    const state = get();
    if (state.ending) {
      return;
    }
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
  exploreTerrainDrops: (terrain) => {
    const state = get();
    if (state.ending || state.activeEvent) {
      return;
    }
    const actionCost = terrain === 'cave' ? 3 : terrain === 'jungle' ? 2 : 2;
    const timeCost = toTimeCost(actionCost);
    if (!canAffordAction(state.environment, timeCost)) {
      set((current) => ({
        logs: [createLog(`本阶段时间不足，无法继续探索${terrainLabel[terrain]}。`), ...current.logs].slice(0, 10),
      }));
      return;
    }
    const bonusDrops = getExploreBonusDrops(state.backpack, state.workbench, terrain);
    const drops = [...pickRandomTerrainDrops(terrain), ...bonusDrops];
    const dropEntries = drops.map((itemId) => ({ itemId, amount: 1 }));
    const baseX = 120 + Math.floor(Math.random() * 60);
    const baseY = 70 + Math.floor(Math.random() * 40);
    const nextWorkbench = addItemsToWorkbench(
      state.workbench,
      dropEntries,
      { x: baseX, y: baseY },
    );
    const bonusText =
      bonusDrops.length > 0
        ? ` 工具额外带回：${bonusDrops.map((id) => itemById.get(id)?.name ?? id).join('、')}。`
        : '';
    set((current) => ({
      environment: spendActions(current.environment, timeCost),
      player: applyEffortDrain(current.player, actionCost),
      workbench: nextWorkbench,
      selectedWorkbenchCardId: nextWorkbench[nextWorkbench.length - 1]?.id ?? null,
      logs: [
        createLog(`你探索了${terrainLabel[terrain]}，发现：${drops.map((id) => itemById.get(id)?.name ?? id).join('、')}。${bonusText}`),
        ...current.logs,
      ].slice(0, 10),
    }));
  },
  craftRecipe: (recipeId) => {
    const state = get();
    if (state.ending) {
      return;
    }
    if (state.activeEvent) {
      set((current) => ({
        logs: [createLog('请先处理当前事件，再进行合成。'), ...current.logs].slice(0, 10),
      }));
      return;
    }
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

    const actionCost = 1;
    const timeCost = toTimeCost(actionCost);
    if (!canAffordAction(state.environment, timeCost)) {
      set((current) => ({
        logs: [
          createLog(`本阶段时间不足，无法合成【${recipe.name}】。`),
          ...current.logs,
        ].slice(0, 10),
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
    const nextProgress: PrototypeProgress = {
      ...state.progress,
      campfireCrafted:
        state.progress.campfireCrafted ||
        recipe.produces.some((entry) => entry.itemId === 'campfire'),
      shelterBuilt:
        state.progress.shelterBuilt ||
        recipe.produces.some((entry) => entry.itemId === 'temporary-shelter'),
      beaconCrafted:
        state.progress.beaconCrafted ||
        recipe.produces.some((entry) => entry.itemId === 'signal-beacon'),
      lastActionSummary: `我把零散材料拼成了“${recipe.name}”，营地终于多了一点像样的准备。`,
    };

    set((current) => ({
      progress: nextProgress,
      environment: spendActions(current.environment, timeCost),
      player: applyEffortDrain(current.player, actionCost),
      backpack: craftedResult.backpack,
      logs: [createLog(`你在工作台合成了【${recipe.name}】：${outputText}。${overflowText}`), ...current.logs].slice(0, 10),
    }));
  },

  craftWorkbenchRecipe: () => {
    const state = get();
    if (state.ending) {
      return;
    }
    if (state.activeEvent) {
      return;
    }

    const recipe = getWorkbenchRecipeMatch(state.workbench, state.selectedWorkbenchCardId);
    if (!recipe || !state.selectedWorkbenchCardId) {
      return;
    }

    const selectedCard = getWorkbenchCard(state.workbench, state.selectedWorkbenchCardId);
    if (!selectedCard) {
      return;
    }
    const actionCost = 1;
    const timeCost = toTimeCost(actionCost);
    if (!canAffordAction(state.environment, timeCost)) {
      set((current) => ({
        logs: [createLog(`本阶段时间不足，无法手动合成【${recipe.name}】。`), ...current.logs].slice(0, 10),
      }));
      return;
    }

    const basePosition = { x: selectedCard.x, y: selectedCard.y };
    const nextWorkbenchBase = removeWorkbenchCardsForRecipe(
      state.workbench,
      selectedCard.stackId,
      recipe,
    );
    const spreadBase = { x: basePosition.x, y: basePosition.y };
    const nextWorkbench = addItemsToWorkbench(
      nextWorkbenchBase,
      recipe.produces,
      spreadBase,
    );
    const nextSelectedWorkbenchCardId = nextWorkbench[nextWorkbench.length - 1]?.id ?? null;
    const outputText = recipe.produces
      .map((entry) => `${itemById.get(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`)
      .join('、');
    const nextProgress: PrototypeProgress = {
      ...state.progress,
      campfireCrafted:
        state.progress.campfireCrafted ||
        recipe.produces.some((entry) => entry.itemId === 'campfire'),
      shelterBuilt:
        state.progress.shelterBuilt ||
        recipe.produces.some((entry) => entry.itemId === 'temporary-shelter'),
      beaconCrafted:
        state.progress.beaconCrafted ||
        recipe.produces.some((entry) => entry.itemId === 'signal-beacon'),
      lastActionSummary: `我把材料在工作台上叠到一起，手动完成了“${recipe.name}”。`,
    };

    set((current) => ({
      progress: nextProgress,
      environment: spendActions(current.environment, timeCost),
      player: applyEffortDrain(current.player, actionCost),
      backpack: current.backpack,
      workbench: nextWorkbench,
      selectedWorkbenchCardId: nextSelectedWorkbenchCardId,
      selectedBackpackSlot: null,
      logs: [
        createLog(`手动合成成功：${recipe.name}。产出 ${outputText}。`),
        ...current.logs,
      ].slice(0, 10),
    }));
  },
  sleepAndAdvance: () => {
    const state = get();
    if (state.ending) {
      return;
    }
    if (state.activeEvent) {
      set((current) => ({
        logs: [createLog('当前危机还没有处理，无法安心睡觉。'), ...current.logs].slice(0, 10),
      }));
      return;
    }
    set((current) => ({
      player: applySleepRecovery(current.player),
      logs: [createLog('你睡了一觉，恢复了不少精力。'), ...current.logs].slice(0, 10),
    }));
    get().nextTurn();
  },
  nextTurn: () => {
    const state = get();
    if (state.ending) {
      return;
    }
    if (state.activeEvent) {
      set((current) => ({
        logs: [createLog('当前危机还没有处理，今晚不能就这么糊弄过去。'), ...current.logs].slice(0, 10),
      }));
      return;
    }

    if (state.player.health <= 0) {
      set({
        ending: createEnding('dead', state.progress),
      });
      return;
    }

    const nextTurn = state.environment.turn + 1;
    const nextPhase = getNextPhase(state.environment.timeOfDay);
    const startOfNewDay = isStartOfNewDay(state.environment.timeOfDay, nextPhase);
    const nextDay = state.environment.day + (startOfNewDay ? 1 : 0);
    const nextEnvironment: EnvironmentState = {
      ...state.environment,
      turn: nextTurn,
      timeOfDay: nextPhase,
      day: nextDay,
      weather: ['sunny', 'rain', 'storm'][Math.floor(Math.random() * 3)] as EnvironmentState['weather'],
      actionsRemaining: PHASE_ACTION_LIMIT[nextPhase],
      actionLimit: PHASE_ACTION_LIMIT[nextPhase],
    };

    const playerAfterDecay = applyStatChanges(
      state.player,
      getPhaseStatDecay(nextPhase, nextEnvironment.weather),
    );
    const passiveOutcome = getPassiveTransitionOutcome(
      state.backpack,
      state.workbench,
      playerAfterDecay,
      nextEnvironment,
      nextPhase,
      startOfNewDay,
    );
    const nextPlayer = passiveOutcome.player;

    const progressAfterTurn: PrototypeProgress = {
      ...state.progress,
      journal: state.environment.timeOfDay === 'night'
        ? appendJournalEntry(state.progress.journal, state.environment.day, nextPlayer, state.progress)
        : state.progress.journal,
    };

    const foreshadowText = getPhaseForeshadow(nextDay, nextPhase);
    const scriptedEventId = getScriptedEventIdForPhase(nextDay, nextPhase);
    const scriptedEvent =
      scriptedEventId && !progressAfterTurn.resolvedCrises.includes(scriptedEventById.get(scriptedEventId)?.title ?? '')
        ? scriptedEventById.get(scriptedEventId) ?? null
        : null;

    const shouldEndByDeath = nextPlayer.health <= 0;
    const shouldResolveSevenDayRun =
      state.environment.day === TOTAL_DAYS &&
      state.environment.timeOfDay === 'night' &&
      nextPhase === 'day';
    const ending = shouldEndByDeath
      ? createEnding('dead', progressAfterTurn)
      : shouldResolveSevenDayRun
        ? createEnding(progressAfterTurn.beaconCrafted ? 'rescued' : 'survived', progressAfterTurn)
        : null;

    const currentGoal = prototypeGoals.find(
      (goal) => goal.day === Math.min(state.environment.day, TOTAL_DAYS),
    );
    const goalLog =
      startOfNewDay && currentGoal
        ? [
            createLog(
              getGoalCompletion(currentGoal.id, nextPlayer, progressAfterTurn)
                ? `今日目标完成：${currentGoal.title}`
                : `今日目标未完成：${currentGoal.title}`,
            ),
          ]
        : [];
    const scriptedEventLogs = scriptedEvent
      ? [createLog(`危机爆发：${scriptedEvent.title}`)]
      : [];
    const foreshadowLogs = foreshadowText ? [createLog(`征兆：${foreshadowText}`)] : [];
    const passiveLogs = passiveOutcome.logs.map((text) => createLog(text));

    set((current) => ({
      player: nextPlayer,
      environment: nextEnvironment,
      progress: progressAfterTurn,
      backpack: passiveOutcome.backpack,
      activeEvent: ending ? null : scriptedEvent,
      ending,
      logs: [
        createLog(
          `进入第 ${nextEnvironment.day} 天 ${timeLabel[nextEnvironment.timeOfDay]}，天气：${weatherLabel[nextEnvironment.weather]}，当前时段可用 ${nextEnvironment.actionLimit} 分钟。`,
        ),
        ...passiveLogs,
        ...foreshadowLogs,
        ...scriptedEventLogs,
        ...goalLog,
        ...(ending ? [createLog(`结局：${ending.title}`)] : []),
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
  dusk: '黄昏',
  night: '夜晚',
};

export const getItemDefinition = (itemId: string | null): ItemDefinition | null => {
  if (!itemId) {
    return null;
  }
  return itemById.get(itemId) ?? null;
};

export const allCraftingRecipes = craftingRecipes;
export const backpackMaxWeight = BACKPACK_MAX_WEIGHT;
export const getBackpackCurrentWeight = (backpack: BackpackSlot[]) => getBackpackWeight(backpack);
export const getItemCarryWeight = (itemId: string | null) => (itemId ? getItemWeight(itemId) : 0);
export const canCraftInBackpack = (backpack: BackpackSlot[], recipe: CraftingRecipe) =>
  canCraftRecipeFromBackpack(backpack, recipe);
export const getWorkbenchRecipePreview = (
  workbench: WorkbenchCard[],
  selectedWorkbenchCardId: string | null,
) => getWorkbenchRecipeMatch(workbench, selectedWorkbenchCardId);
export const allPrototypeGoals = prototypeGoals;
export const isPrototypeGoalComplete = (
  goal: PrototypeGoal,
  player: PlayerState,
  progress: PrototypeProgress,
) => getGoalCompletion(goal.id, player, progress);







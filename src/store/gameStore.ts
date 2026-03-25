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
} from '../types/game';

interface GameState {
  player: PlayerState;
  environment: EnvironmentState;
  progress: PrototypeProgress;
  deck: CardDefinition[];
  hand: CardDefinition[];
  backpack: BackpackSlot[];
  selectedBackpackSlot: number | null;
  activeEvent: EventDefinition | null;
  ending: GameEnding | null;
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
const TOTAL_DAYS = 7;
const PHASE_ORDER: EnvironmentState['timeOfDay'][] = ['day', 'dusk', 'night'];
const PHASE_ACTION_LIMIT: Record<EnvironmentState['timeOfDay'], number> = {
  day: 2,
  dusk: 1,
  night: 1,
};
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
  {
    id: 'signal-beacon',
    name: '求救信标',
    description: '将木矛、火种和纤维绑成显眼的求救信标，等待远处船只发现。',
    requires: [
      { itemId: 'spear', amount: 1 },
      { itemId: 'campfire-kit', amount: 1 },
      { itemId: 'palm-fiber', amount: 3 },
    ],
    produces: [{ itemId: 'signal-beacon', amount: 1 }],
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
    progress: initialProgress(),
    deck: starterDeck,
    hand: starterDeck.slice(0, HAND_SIZE),
    backpack: seeded,
    selectedBackpackSlot: null as number | null,
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
  if (day === 3 && phase === 'night') {
    return 'storm-impact';
  }
  if (day === 5 && phase === 'night') {
    return 'boar-raid';
  }
  if (day === 6 && (phase === 'day' || phase === 'dusk')) {
    return 'dirty-water';
  }
  return null;
};

const getPhaseForeshadow = (day: number, phase: EnvironmentState['timeOfDay']) => {
  if (day === 3 && phase === 'dusk') {
    return '天边的云层压得很低，今晚恐怕不是普通的雨夜。';
  }
  if (day === 5 && phase === 'dusk') {
    return '营地附近出现了翻动泥土的痕迹，像是有大型动物在徘徊。';
  }
  if (day === 6 && phase === 'day') {
    return '你发现存下来的淡水味道不太对，也许水源正在变坏。';
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

const spendActions = (environment: EnvironmentState, cost: number): EnvironmentState => ({
  ...environment,
  actionsRemaining: Math.max(0, environment.actionsRemaining - cost),
});

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
    if (!canAffordAction(state.environment, actionCost)) {
      set((current) => ({
        logs: [
          createLog(`【${card.name}】需要 ${actionCost} 点行动次数，但本阶段只剩 ${state.environment.actionsRemaining} 点。`),
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
    const environmentAfterAction = spendActions(applied.environment, actionCost);
    const inventoryResult = addItemsToBackpack(state.backpack, card.effect.gainItems);
    const nextProgress = updateProgressFromAction(
      state.progress,
      card.id,
      `${phaseSummaryLabel(state.environment.timeOfDay)}的主要精力花在了“${card.name}”上。`,
      card.effect.gainItems,
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
    const overflowText =
      inventoryResult.overflow.length > 0 ? ` 背包已满，掉落：${inventoryResult.overflow.join('、')}。` : '';

    set((current) => ({
      player: applied.player,
      environment: environmentAfterAction,
      progress: nextProgress,
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
    if (state.ending) {
      return;
    }
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
      progress: {
        ...current.progress,
        lastActionSummary: `我最终选择了“${option.label}”来应对${event.title}。`,
        resolvedCrises: [event.title, ...current.progress.resolvedCrises].slice(0, 3),
      },
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
      selectedBackpackSlot: state.ending
        ? state.selectedBackpackSlot
        : state.selectedBackpackSlot === slotIndex
          ? null
          : slotIndex,
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

    const actionCost = 1;
    if (!canAffordAction(state.environment, actionCost)) {
      set((current) => ({
        logs: [
          createLog(`本阶段行动次数不足，无法使用【${item.name}】。`),
          ...current.logs,
        ].slice(0, 10),
      }));
      return;
    }

    const applied = applyEffect(state.player, state.environment, item.effect);
    const environmentAfterAction = spendActions(applied.environment, actionCost);
    const inventoryResult = addItemsToBackpack(consumeOneFromSlot(state.backpack, slotIndex), item.effect.gainItems);

    set((current) => ({
      player: applied.player,
      environment: environmentAfterAction,
      progress: {
        ...current.progress,
        lastActionSummary: `我从背包里拿出了${item.name}，希望这一步足够值得。`,
      },
      backpack: inventoryResult.backpack,
      selectedBackpackSlot: current.selectedBackpackSlot === slotIndex ? null : current.selectedBackpackSlot,
      logs: [createLog(`你使用了背包物品【${item.name}】。`), ...current.logs].slice(0, 10),
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
    if (!canAffordAction(state.environment, actionCost)) {
      set((current) => ({
        logs: [
          createLog(`本阶段行动次数不足，无法合成【${recipe.name}】。`),
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
        recipe.produces.some((entry) => entry.itemId === 'campfire-kit'),
      beaconCrafted:
        state.progress.beaconCrafted ||
        recipe.produces.some((entry) => entry.itemId === 'signal-beacon'),
      lastActionSummary: `我把零散材料拼成了“${recipe.name}”，营地终于多了一点像样的准备。`,
    };

    set((current) => ({
      progress: nextProgress,
      environment: spendActions(current.environment, actionCost),
      backpack: craftedResult.backpack,
      logs: [createLog(`你在工作台合成了【${recipe.name}】：${outputText}。${overflowText}`), ...current.logs].slice(0, 10),
    }));
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

    const nextPlayer = applyStatChanges(
      state.player,
      getPhaseStatDecay(nextPhase, nextEnvironment.weather),
    );

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

    set((current) => ({
      player: nextPlayer,
      environment: nextEnvironment,
      progress: progressAfterTurn,
      activeEvent: ending ? null : scriptedEvent,
      ending,
      logs: [
        createLog(
          `进入第 ${nextEnvironment.day} 天 ${timeLabel[nextEnvironment.timeOfDay]}，天气：${weatherLabel[nextEnvironment.weather]}，可行动 ${nextEnvironment.actionLimit} 次。`,
        ),
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
export const canCraftInBackpack = (backpack: BackpackSlot[], recipe: CraftingRecipe) =>
  canCraftRecipeFromBackpack(backpack, recipe);
export const allPrototypeGoals = prototypeGoals;
export const isPrototypeGoalComplete = (
  goal: PrototypeGoal,
  player: PlayerState,
  progress: PrototypeProgress,
) => getGoalCompletion(goal.id, player, progress);

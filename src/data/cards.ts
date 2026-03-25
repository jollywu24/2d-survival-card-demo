import type { CardDefinition } from '../types/game';

export const starterDeck: CardDefinition[] = [
  {
    id: 'gather-berries',
    name: '采集浆果',
    type: 'resource',
    actionCost: 1,
    description: '在附近搜寻可食用浆果，补充食物并带回一些存货。',
    effect: {
      statChanges: { hunger: 8, fatigue: -6, sanity: 2 },
      gainItems: [{ itemId: 'berries', amount: 2 }],
    },
    condition: {
      allowedTerrains: ['beach', 'jungle'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'collect-rainwater',
    name: '收集淡水',
    type: 'resource',
    actionCost: 1,
    description: '利用叶片和容器收集雨水，为背包补充可饮用的淡水。',
    effect: {
      statChanges: { thirst: 8, fatigue: -4 },
      gainItems: [{ itemId: 'fresh-water', amount: 2 }],
    },
    condition: {
      allowedTime: ['day', 'dusk'],
      allowedWeather: ['rain', 'storm'],
    },
  },
  {
    id: 'fish-shore',
    name: '岸边捕鱼',
    type: 'action',
    actionCost: 2,
    description: '在海滩尝试捕鱼，成功的话能把鲜鱼带回背包。',
    effect: {
      statChanges: { fatigue: -10 },
      gainItems: [{ itemId: 'raw-fish', amount: 1 }],
    },
    condition: {
      allowedTerrains: ['beach'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'light-fire',
    name: '生火取暖',
    type: 'tool',
    actionCost: 1,
    description: '保持体温并稳定精神，夜晚尤其有用。',
    effect: {
      statChanges: { temperature: 16, sanity: 6, fatigue: -4 },
    },
    condition: {
      allowedTime: ['dusk', 'night'],
    },
  },
  {
    id: 'build-shelter',
    name: '搭建庇护所',
    type: 'tool',
    actionCost: 2,
    description: '临时庇护所让你更安全，也会留下些可重复利用的材料。',
    effect: {
      statChanges: { sanity: 8, fatigue: -8, health: 4 },
      gainItems: [{ itemId: 'palm-fiber', amount: 2 }],
    },
    condition: {
      allowedTerrains: ['beach', 'jungle'],
      allowedTime: ['day', 'dusk'],
    },
  },
  {
    id: 'explore-jungle',
    name: '探索丛林',
    type: 'action',
    actionCost: 2,
    description: '进入丛林寻找资源，有机会发现草药与新机会。',
    effect: {
      statChanges: { fatigue: -10, thirst: -6 },
      moveTerrain: 'jungle',
      drawCards: 1,
      eventChanceBonus: 0.15,
      gainItems: [{ itemId: 'herb-bundle', amount: 1 }],
    },
    condition: {
      allowedTerrains: ['beach'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'enter-cave',
    name: '进入洞穴',
    type: 'action',
    actionCost: 1,
    description: '洞穴更安全，但也会带来未知风险。',
    effect: {
      statChanges: { sanity: -4, temperature: 10 },
      moveTerrain: 'cave',
      eventChanceBonus: 0.1,
    },
  },
  {
    id: 'rest',
    name: '闭眼休息',
    type: 'action',
    actionCost: 1,
    description: '恢复体力，但时间会流逝，夜里恢复效果更好。',
    effect: {
      statChanges: { fatigue: 18, sanity: 6, hunger: -4, thirst: -4 },
      rest: true,
    },
    condition: {
      allowedTime: ['dusk', 'night'],
    },
  },
  {
    id: 'observe-sky',
    name: '观察天色',
    type: 'event',
    actionCost: 1,
    description: '留意云层和海风，提升对环境的把握。',
    effect: {
      statChanges: { sanity: 4 },
      drawCards: 1,
    },
    condition: {
      allowedTime: ['day', 'dusk'],
    },
  },
  {
    id: 'craft-spear',
    name: '制作木矛',
    type: 'tool',
    actionCost: 2,
    description: '简单工具能让后续生存更容易，并会进入你的背包。',
    effect: {
      statChanges: { sanity: 5, fatigue: -6 },
      drawCards: 1,
      gainItems: [{ itemId: 'spear', amount: 1 }],
    },
    condition: {
      allowedTerrains: ['beach', 'jungle'],
      allowedTime: ['day', 'dusk'],
    },
  },
];

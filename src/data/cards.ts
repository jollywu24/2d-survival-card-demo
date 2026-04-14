import type { CardDefinition } from '../types/game';

export const starterDeck: CardDefinition[] = [
  {
    id: 'beachcombing',
    name: '随便逛逛',
    type: 'action',
    actionCost: 1,
    description: '沿着海滩低头慢走，把最容易忽略的小东西翻到工作台上。',
    effect: {
      statChanges: { fatigue: -4, sanity: 1 },
      eventChanceBonus: -0.3,
      gainWorkbenchItems: [
        { itemId: 'pebble', amount: 2 },
        { itemId: 'green-coconut', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['beach'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'gather-berries',
    name: '采集浆果',
    type: 'action',
    actionCost: 1,
    description: '在附近搜寻可食用浆果，补充食物并带回一些存货。',
    effect: {
      statChanges: { hunger: 8, fatigue: -6, sanity: 2 },
      gainItems: [
        { itemId: 'berries', amount: 1 },
        { itemId: 'palm-leaf', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['beach', 'jungle'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'collect-rainwater',
    name: '收集淡水',
    type: 'action',
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
      gainItems: [
        { itemId: 'raw-fish', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['beach'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'light-fire',
    name: '生火取暖',
    type: 'action',
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
    type: 'recipe',
    actionCost: 2,
    description: '临时庇护所让你更安全，也会留下些可重复利用的材料。',
    effect: {
      statChanges: { sanity: 8, fatigue: -8, health: 4 },
      gainItems: [
        { itemId: 'palm-leaf', amount: 2 },
        { itemId: 'vine', amount: 1 },
      ],
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
      statChanges: { fatigue: -12, thirst: -8 },
      moveTerrain: 'jungle',
      drawCards: 1,
      eventChanceBonus: 0.15,
      gainItems: [
        { itemId: 'herb', amount: 1 },
        { itemId: 'vine', amount: 1 },
        { itemId: 'bamboo', amount: 1 },
      ],
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
      statChanges: { sanity: -6, temperature: 8, fatigue: -4 },
      moveTerrain: 'cave',
      eventChanceBonus: 0.1,
      gainItems: [
        { itemId: 'flint', amount: 1 },
        { itemId: 'stone', amount: 1 },
      ],
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
    id: 'write-journal',
    name: '写日记',
    type: 'skill',
    actionCost: 0,
    description: '把这一天真正写下来。文字不能喂饱你，但能帮你熬过很多夜晚。',
    effect: {
      statChanges: { sanity: 15 },
      gainItems: [{ itemId: 'journal-page', amount: 1 }],
    },
    condition: {
      allowedTime: ['night'],
    },
  },
  {
    id: 'observe-sky',
    name: '观察天色',
    type: 'skill',
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
    type: 'recipe',
    actionCost: 2,
    description: '简单工具能让后续生存更容易，并会进入你的背包。',
    effect: {
      statChanges: { sanity: 5, fatigue: -6 },
      drawCards: 1,
      gainItems: [
        { itemId: 'spear', amount: 1 },
        { itemId: 'driftwood', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['beach', 'jungle'],
      allowedTime: ['day', 'dusk'],
    },
  },
  {
    id: 'chop-driftwood',
    name: '砍伐木材',
    type: 'action',
    actionCost: 2,
    description: '沿着潮线和林边收集可用的木材，为火源和工具做准备。',
    effect: {
      statChanges: { fatigue: -8, thirst: -3 },
      gainItems: [{ itemId: 'driftwood', amount: 2 }],
    },
    condition: {
      allowedTerrains: ['beach', 'jungle'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'gather-herbs',
    name: '采集草药',
    type: 'action',
    actionCost: 1,
    description: '在湿润地带辨认可用草药，为后续处理伤口和坏水做准备。',
    effect: {
      statChanges: { sanity: 2, fatigue: -5 },
      gainItems: [
        { itemId: 'herb', amount: 2 },
        { itemId: 'berries', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['jungle', 'cave'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'scavenge-wreckage',
    name: '捡拾漂流物',
    type: 'action',
    actionCost: 1,
    description: '翻找潮水送来的碎片，有时能捡到现成的引火物和绑扎材料。',
    effect: {
      statChanges: { fatigue: -4, sanity: 1 },
      eventChanceBonus: 0.05,
      gainItems: [
        { itemId: 'driftwood', amount: 1 },
        { itemId: 'vine', amount: 1 },
        { itemId: 'campfire-kit', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['beach'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'dig-cave',
    name: '挖掘洞穴',
    type: 'action',
    actionCost: 2,
    description: '沿着洞口和碎石带继续挖找，补齐做刀和容器最缺的矿料。',
    effect: {
      statChanges: { fatigue: -9, sanity: -2 },
      gainItems: [
        { itemId: 'flint', amount: 1 },
        { itemId: 'stone', amount: 1 },
        { itemId: 'pebble', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['cave'],
      allowedTime: ['day'],
    },
  },
  {
    id: 'observe-rest',
    name: '观景休憩',
    type: 'skill',
    actionCost: 0,
    description: '暂时停下来听海风和浪声，让脑子别一直绷在求生模式里。',
    effect: {
      statChanges: { sanity: 10, fatigue: 6 },
    },
    condition: {
      allowedTerrains: ['beach'],
      allowedTime: ['day', 'dusk'],
    },
  },
  {
    id: 'follow-tracks',
    name: '循迹狩猎',
    type: 'action',
    actionCost: 2,
    description: '沿着林地里的踩踏痕迹慢慢追，运气好能带回求救线最缺的兽皮。',
    effect: {
      statChanges: { fatigue: -10, thirst: -5, sanity: -1 },
      gainItems: [
        { itemId: 'beast-hide', amount: 1 },
        { itemId: 'vine', amount: 1 },
      ],
    },
    condition: {
      allowedTerrains: ['jungle'],
      allowedTime: ['day', 'dusk'],
    },
  },
  {
    id: 'purify-water',
    name: '净化水源',
    type: 'recipe',
    actionCost: 1,
    description: '把现有容器和火源利用起来，把不放心的水处理成能入口的样子。',
    effect: {
      statChanges: { thirst: 10, sanity: 2, fatigue: -3 },
      gainItems: [{ itemId: 'fresh-water', amount: 1 }],
    },
    condition: {
      allowedTime: ['day', 'dusk'],
    },
  },
  {
    id: 'reinforce-camp',
    name: '加固营地',
    type: 'recipe',
    actionCost: 2,
    description: '把现有营地再缠紧一点，至少让今晚的风雨别直接灌进来。',
    effect: {
      statChanges: { sanity: 4, fatigue: -6 },
      gainItems: [
        { itemId: 'waterproof-wrap', amount: 1 },
        { itemId: 'palm-leaf', amount: 1 },
      ],
    },
    condition: {
      allowedTime: ['day', 'dusk'],
    },
  },
];


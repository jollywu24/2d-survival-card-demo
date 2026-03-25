import type { EventDefinition } from '../types/game';

export const randomEvents: EventDefinition[] = [
  {
    id: 'sudden-rain',
    title: '骤雨来袭',
    description: '乌云突然聚集，雨水冲刷了你的营地。',
    condition: {
      allowedTime: ['day'],
      allowedTerrains: ['beach', 'jungle'],
    },
    options: [
      {
        id: 'collect-water',
        label: '趁机接水',
        resultText: '你成功收集到淡水，但被淋得有些疲惫。',
        effect: {
          statChanges: { thirst: 18, fatigue: -5, temperature: -4 },
          changeWeather: 'rain',
        },
      },
      {
        id: 'seek-cover',
        label: '赶紧避雨',
        resultText: '你保住了体温，情绪却有些烦躁。',
        effect: {
          statChanges: { temperature: 8, sanity: -2 },
          moveTerrain: 'cave',
          changeWeather: 'rain',
        },
      },
    ],
  },
  {
    id: 'strange-sound',
    title: '夜里的异响',
    description: '黑暗里传来不明动物的叫声，让人神经紧绷。',
    condition: {
      allowedTime: ['dusk', 'night'],
    },
    options: [
      {
        id: 'stay-alert',
        label: '保持警戒',
        resultText: '你没有受伤，但整晚都没睡踏实。',
        effect: {
          statChanges: { fatigue: -8, sanity: -6 },
        },
      },
      {
        id: 'light-fire',
        label: '点火驱赶',
        resultText: '火光让你安心不少，寒意也退去了。',
        effect: {
          statChanges: { sanity: 8, temperature: 10, fatigue: -3 },
        },
      },
    ],
  },
  {
    id: 'fruit-tree',
    title: '发现果树',
    description: '你在一片空地边上发现了结实的野果树。',
    condition: {
      allowedTerrains: ['jungle'],
      allowedTime: ['day'],
    },
    options: [
      {
        id: 'eat-now',
        label: '立刻食用',
        resultText: '野果让你恢复了不少精力。',
        effect: {
          statChanges: { hunger: 16, sanity: 4 },
        },
      },
      {
        id: 'store-later',
        label: '带走备用',
        resultText: '你没有马上吃，但准备更充分了。',
        effect: {
          statChanges: { sanity: 6 },
          drawCards: 1,
        },
      },
    ],
  },
];

export const scriptedEvents: EventDefinition[] = [
  {
    id: 'storm-impact',
    title: '暴风雨压境',
    description: '狂风把营地吹得东倒西歪，你必须马上决定如何撑过今晚。',
    condition: {
      allowedTime: ['night'],
    },
    options: [
      {
        id: 'hold-shelter',
        label: '死守营地',
        resultText: '你咬牙撑住了这一夜，庇护所替你挡下了最狠的一阵风。',
        effect: {
          statChanges: { sanity: -3, fatigue: -6, temperature: -4, health: -2 },
        },
      },
      {
        id: 'retreat-cave',
        label: '退入洞穴',
        resultText: '你狼狈地躲进了洞穴，保住了体温，却丢了些营地秩序。',
        effect: {
          statChanges: { temperature: 8, sanity: -4 },
          moveTerrain: 'cave',
        },
      },
    ],
  },
  {
    id: 'boar-raid',
    title: '野猪袭营',
    description: '夜色里有东西冲撞营地边缘，听上去像一头暴躁的野猪。',
    condition: {
      allowedTime: ['night'],
    },
    options: [
      {
        id: 'scare-away',
        label: '举火驱赶',
        resultText: '你用火光和叫喊逼退了它，但整夜神经紧绷。',
        effect: {
          statChanges: { sanity: -2, fatigue: -6, temperature: 4 },
        },
      },
      {
        id: 'hide-quietly',
        label: '躲着不动',
        resultText: '你没有受伤，但它带走了营地边的一些东西，你心里很不是滋味。',
        effect: {
          statChanges: { sanity: -5, hunger: -4 },
        },
      },
    ],
  },
  {
    id: 'dirty-water',
    title: '淡水发苦',
    description: '你发现储存的淡水开始发苦，如果继续喝下去可能会出问题。',
    condition: {
      allowedTime: ['day', 'dusk'],
    },
    options: [
      {
        id: 'boil-water',
        label: '赶紧处理',
        resultText: '你用现有材料勉强处理了水源，虽然麻烦，但风险降了下来。',
        effect: {
          statChanges: { fatigue: -4, thirst: 6 },
        },
      },
      {
        id: 'drink-anyway',
        label: '先喝再说',
        resultText: '短时间缓解了口渴，但肚子明显开始难受。',
        effect: {
          statChanges: { thirst: 12, health: -6, sanity: -4 },
        },
      },
    ],
  },
];

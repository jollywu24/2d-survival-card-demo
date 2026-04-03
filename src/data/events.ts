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
    id: 'first-night',
    title: '第一个夜晚',
    description: '海风一落下来，第一晚的寒意比白天想象得更难熬。你必须决定怎么撑过去。',
    condition: {
      allowedTime: ['night'],
    },
    options: [
      {
        id: 'endure-cold',
        label: '蜷缩着硬熬',
        resultText: '你勉强熬过来了，但这一夜让你彻底明白火和庇护所不是奢侈品。',
        effect: {
          statChanges: { temperature: -10, sanity: -8, health: -4 },
        },
      },
      {
        id: 'burn-scraps',
        label: '烧点材料取暖',
        resultText: '温度稍微回来了些，你也终于能把呼吸稳下来。',
        effect: {
          statChanges: { temperature: 6, sanity: 2, fatigue: -3 },
        },
      },
    ],
  },
  {
    id: 'tide-cache',
    title: '退潮后的漂流物',
    description: '第二天的退潮露出一截被海藻缠住的漂流物，里面也许有你最缺的火源材料。',
    condition: {
      allowedTime: ['dusk'],
    },
    options: [
      {
        id: 'salvage-now',
        label: '马上翻找',
        resultText: '你在天黑前抢回了一些能直接用的材料。',
        effect: {
          statChanges: { fatigue: -4, thirst: -2 },
          gainItems: [
            { itemId: 'driftwood', amount: 2 },
            { itemId: 'flint', amount: 1 },
          ],
        },
      },
      {
        id: 'mark-and-return',
        label: '先记住位置',
        resultText: '你没有冒险摸黑搬运，但心里记下了明天的优先事项。',
        effect: {
          statChanges: { sanity: 3 },
          drawCards: 1,
        },
      },
    ],
  },
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
    id: 'forest-signs',
    title: '丛林深处的痕迹',
    description: '第四天，丛林边缘出现了新鲜折断的枝条和一小片被踩平的草，里面显然有值得进去一趟的东西。',
    condition: {
      allowedTime: ['dusk'],
    },
    options: [
      {
        id: 'follow-tracks',
        label: '沿着痕迹找',
        resultText: '你冒着风险多走了一段，带回了几样很关键的内陆材料。',
        effect: {
          statChanges: { fatigue: -5, thirst: -3 },
          gainItems: [
            { itemId: 'herb', amount: 1 },
            { itemId: 'vine', amount: 1 },
            { itemId: 'bamboo', amount: 1 },
          ],
        },
      },
      {
        id: 'stay-near-camp',
        label: '保守返回营地',
        resultText: '你选择不冒进，虽然收获少些，但人是稳的。',
        effect: {
          statChanges: { sanity: 4, temperature: 2 },
          gainItems: [{ itemId: 'berries', amount: 1 }],
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
  {
    id: 'rescue-window',
    title: '海面上的帆影',
    description: '第七天傍晚，海平面上终于出现了一道缓慢移动的帆影。现在你做的一切，都会决定对方能不能注意到这里。',
    condition: {
      allowedTime: ['dusk'],
    },
    options: [
      {
        id: 'hold-beacon',
        label: '守住营地火光',
        resultText: '你把所有注意力都放在维持信号上，等着对方看见。',
        effect: {
          statChanges: { sanity: 8, temperature: 4, fatigue: -4 },
        },
      },
      {
        id: 'rush-shore',
        label: '冲向岸边示意',
        resultText: '你拼命跑向海边挥手，但身体也几乎被掏空了。',
        effect: {
          statChanges: { fatigue: -8, sanity: -3, health: -2 },
        },
      },
    ],
  },
];

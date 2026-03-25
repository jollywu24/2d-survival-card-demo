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

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import {
  allCraftingRecipes,
  allPrototypeGoals,
  canCraftInBackpack,
  getItemDefinition,
  getWorkbenchRecipePreview,
  isPrototypeGoalComplete,
  terrainLabel,
  timeLabel,
  useGameStore,
  weatherLabel,
} from './store/gameStore';
import type { BackpackSlot, EnvironmentState, StatKey, WorkbenchCard } from './types/game';

const coreNeedMeta: Array<{
  key: Extract<StatKey, 'hunger' | 'thirst' | 'temperature' | 'sanity'>;
  label: string;
  className: string;
}> = [
  { key: 'hunger', label: '饱腹', className: 'n-hunger' },
  { key: 'thirst', label: '水分', className: 'n-water' },
  { key: 'temperature', label: '体温', className: 'n-temp' },
  { key: 'sanity', label: '精神', className: 'n-mind' },
];

const bodyMeta: Array<{ key: Extract<StatKey, 'health' | 'fatigue'>; label: string }> = [
  { key: 'health', label: '生命' },
  { key: 'fatigue', label: '疲劳' },
];

const weatherIcon: Record<EnvironmentState['weather'], string> = {
  sunny: '☀',
  rain: '☔',
  storm: '⛈',
};

const phaseLabel = {
  day: '白昼',
  dusk: '黄昏',
  night: '深夜',
} as const;

const itemTypeLabel = {
  material: '材料',
  tool: '工具',
  food: '食物',
  water: '饮水',
  medical: '药品',
} as const;
const phaseMinuteRange = {
  day: { start: 6 * 60, length: 12 * 60 },
  dusk: { start: 18 * 60, length: 4 * 60 },
  night: { start: 22 * 60, length: 8 * 60 },
} as const;

const terrainActionContext = {
  beach: '海滩：可以游泳放松、翻找潮汐带或处理椰子。',
  jungle: '丛林：更容易获取木材与纤维，但也更消耗体力。',
  cave: '洞穴：高风险高回报，适合采矿与探索。',
} as const;

const terrainEncounterCards: Record<
  EnvironmentState['terrain'],
  { main: string; action: string; children: string[]; objects: string[] }
> = {
  beach: {
    main: '海湾',
    action: '随便逛逛',
    children: ['沙滩', '大海'],
    objects: ['棕榈树', '小棕树', '野生芦苇'],
  },
  jungle: {
    main: '河畔林隙',
    action: '沿岸探索',
    children: ['浅滩', '灌木区'],
    objects: ['树根', '藤蔓', '蘑菇'],
  },
  cave: {
    main: '洞口营地',
    action: '深入探路',
    children: ['洞口', '暗河'],
    objects: ['钟乳石', '湿苔', '碎矿石'],
  },
};

const DEFAULT_WORKBENCH_DROP = { x: 28, y: 28 };
const CARD_STACK_OFFSET_X = 12;
const CARD_STACK_OFFSET_Y = 8;
const WORKBENCH_CARD_WIDTH = 120;
const WORKBENCH_CARD_HEIGHT = 84;
const STACK_HOLD_MS = 700;

interface WorkbenchVisualCard {
  id: string;
  itemId: string;
  stackId: string;
  x: number;
  y: number;
  order: number;
  sameItemCount: number;
}

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const {
    player,
    environment,
    progress,
    backpack,
    workbench,
    selectedBackpackSlot,
    selectedWorkbenchCardId,
    activeEvent,
    ending,
    logs,
    sleepAndAdvance,
    resetGame,
    resolveEvent,
    setTerrain,
    selectBackpackSlot,
    selectWorkbenchCard,
    moveSelectedToSlot,
    moveBackpackToWorkbench,
    moveWorkbenchToBackpack,
    moveWorkbenchStack,
    storeAllWorkbenchItems,
    useBackpackItem,
    useWorkbenchItem,
    discardBackpackItem,
    exploreTerrainDrops,
    craftWorkbenchRecipe,
  } = useGameStore();
  const [journalOpen, setJournalOpen] = useState(false);
  const [dragSource, setDragSource] = useState<
    | { kind: 'backpack'; slotIndex: number }
    | { kind: 'workbench'; cardId: string }
    | null
  >(null);
  const [stackHold, setStackHold] = useState<{ targetCardId: string; startedAt: number } | null>(
    null,
  );
  const [stackProgress, setStackProgress] = useState(0);
  const [selectedActionTerrain, setSelectedActionTerrain] = useState<EnvironmentState['terrain'] | null>(
    null,
  );
  const [locationModalOpen, setLocationModalOpen] = useState(false);

  const selectedBackpackSlotData =
    selectedBackpackSlot !== null ? backpack[selectedBackpackSlot] ?? null : null;
  const selectedBackpackItem = getItemDefinition(selectedBackpackSlotData?.itemId ?? null);
  const selectedWorkbenchCard =
    selectedWorkbenchCardId !== null
      ? workbench.find((card) => card.id === selectedWorkbenchCardId) ?? null
      : null;
  const selectedWorkbenchItem = getItemDefinition(selectedWorkbenchCard?.itemId ?? null);
  const selectedWorkbenchStack = useMemo(
    () =>
      selectedWorkbenchCard
        ? workbench.filter((card) => card.stackId === selectedWorkbenchCard.stackId)
        : [],
    [selectedWorkbenchCard, workbench],
  );
  const selectedWorkbenchSameItemCount = useMemo(
    () =>
      selectedWorkbenchCard
        ? selectedWorkbenchStack.filter((card) => card.itemId === selectedWorkbenchCard.itemId).length
        : 0,
    [selectedWorkbenchCard, selectedWorkbenchStack],
  );
  const workbenchRecipe = getWorkbenchRecipePreview(workbench, selectedWorkbenchCardId);
  const craftableBackpackRecipes = useMemo(
    () => allCraftingRecipes.filter((recipe) => canCraftInBackpack(backpack, recipe)),
    [backpack],
  );
  const activeGoal = allPrototypeGoals.find(
    (goal) => goal.day === Math.min(environment.day, progress.totalDays),
  );
  const completedGoalCount = allPrototypeGoals.filter((goal) =>
    isPrototypeGoalComplete(goal, player, progress),
  ).length;
  const energyPips = useMemo(
    () => {
      const pipCount = 12;
      const ratio =
        environment.actionLimit > 0 ? environment.actionsRemaining / environment.actionLimit : 0;
      const activeCount = Math.round(pipCount * ratio);
      return Array.from({ length: pipCount }, (_, index) => index < activeCount);
    },
    [environment.actionLimit, environment.actionsRemaining],
  );
  const currentClock = useMemo(() => {
    const range = phaseMinuteRange[environment.timeOfDay];
    const elapsed = Math.max(0, range.length - environment.actionsRemaining);
    const minutes = (range.start + elapsed) % (24 * 60);
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  }, [environment.timeOfDay, environment.actionsRemaining]);

  const workbenchVisualCards = useMemo(() => {
    const stackMap = new Map<string, WorkbenchCard[]>();

    workbench.forEach((card) => {
      const cards = stackMap.get(card.stackId) ?? [];
      cards.push(card);
      stackMap.set(card.stackId, cards);
    });

    const visuals: WorkbenchVisualCard[] = [];

    stackMap.forEach((cards, stackId) => {
      const grouped = new Map<string, WorkbenchCard[]>();
      cards.forEach((card) => {
        const same = grouped.get(card.itemId) ?? [];
        same.push(card);
        grouped.set(card.itemId, same);
      });

      Array.from(grouped.entries()).forEach(([itemId, sameCards], order) => {
        const representative = sameCards[0];
        visuals.push({
          id: representative.id,
          itemId,
          stackId,
          x: representative.x,
          y: representative.y,
          order,
          sameItemCount: sameCards.length,
        });
      });
    });

    return visuals.sort((left, right) => left.y - right.y || left.x - right.x || left.order - right.order);
  }, [workbench]);
  const workbenchCraftHints = useMemo(() => {
    const seen = new Set<string>();
    const hints: Array<{ stackId: string; recipeId: string; recipeName: string }> = [];

    workbenchVisualCards.forEach((card) => {
      const recipe = getWorkbenchRecipePreview(workbench, card.id);
      if (!recipe || seen.has(recipe.id)) {
        return;
      }
      seen.add(recipe.id);
      hints.push({ stackId: card.stackId, recipeId: recipe.id, recipeName: recipe.name });
    });

    return hints;
  }, [workbench, workbenchVisualCards]);
  const activeWorkbenchHint = workbenchCraftHints[0] ?? null;

  const actionOptionsEnabled = selectedActionTerrain === environment.terrain;
  const activeTerrain = selectedActionTerrain ?? environment.terrain;
  const activeTerrainCards = terrainEncounterCards[activeTerrain];


  const canStackOnCard = (targetCardId: string) => {
    if (!dragSource) {
      return false;
    }

    const targetCard = workbench.find((card) => card.id === targetCardId);
    if (!targetCard) {
      return false;
    }

    if (dragSource.kind === 'backpack') {
      const slot = backpack[dragSource.slotIndex];
      return !!slot?.itemId;
    }

    const sourceCard = workbench.find((card) => card.id === dragSource.cardId);
    if (!sourceCard) {
      return false;
    }

    return sourceCard.id !== targetCard.id && sourceCard.stackId !== targetCard.stackId;
  };

  useEffect(() => {
    if (!dragSource || !stackHold || !canStackOnCard(stackHold.targetCardId)) {
      if (stackProgress !== 0) {
        setStackProgress(0);
      }
      return;
    }

    let frameId = 0;
    let committed = false;

    const tick = () => {
      const progressValue = Math.min((performance.now() - stackHold.startedAt) / STACK_HOLD_MS, 1);
      setStackProgress(progressValue);

      if (progressValue >= 1 && !committed) {
        committed = true;
        if (dragSource.kind === 'backpack') {
          moveBackpackToWorkbench(dragSource.slotIndex, undefined, stackHold.targetCardId);
        } else {
          moveWorkbenchStack(dragSource.cardId, undefined, stackHold.targetCardId);
        }
        setDragSource(null);
        setStackHold(null);
        setStackProgress(0);
        return;
      }

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [dragSource, moveBackpackToWorkbench, moveWorkbenchStack, stackHold, stackProgress, workbench, backpack]);

  const clearStackHold = () => {
    setStackHold(null);
    setStackProgress(0);
  };

  const getBoardPoint = (event: DragEvent<HTMLElement>) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) {
      return DEFAULT_WORKBENCH_DROP;
    }

    const x = Math.max(
      16,
      Math.min(rect.width - WORKBENCH_CARD_WIDTH - 16, event.clientX - rect.left - WORKBENCH_CARD_WIDTH / 2),
    );
    const y = Math.max(
      16,
      Math.min(rect.height - WORKBENCH_CARD_HEIGHT - 16, event.clientY - rect.top - 30),
    );

    return { x, y };
  };

  const beginStackHold = (targetCardId: string) => {
    if (!canStackOnCard(targetCardId)) {
      clearStackHold();
      return;
    }

    setStackHold((current) =>
      current?.targetCardId === targetCardId
        ? current
        : {
            targetCardId,
            startedAt: performance.now(),
          },
    );
  };

  const handleBackpackClick = (slot: BackpackSlot) => {
    if (selectedBackpackSlot !== null && selectedBackpackSlot !== slot.slotIndex) {
      moveSelectedToSlot(slot.slotIndex);
      return;
    }

    selectBackpackSlot(slot.slotIndex);
  };

  const handleWorkbenchCardClick = (card: WorkbenchVisualCard) => {
    if (selectedBackpackSlot !== null) {
      moveBackpackToWorkbench(selectedBackpackSlot, undefined, card.id);
      return;
    }

    if (selectedWorkbenchCardId && selectedWorkbenchCardId !== card.id) {
      moveWorkbenchStack(selectedWorkbenchCardId, undefined, card.id);
      return;
    }

    selectWorkbenchCard(card.id);
  };

  const handleBackpackDrop = (targetIndex: number) => {
    clearStackHold();
    if (!dragSource) {
      return;
    }

    if (dragSource.kind === 'workbench') {
      moveWorkbenchToBackpack(dragSource.cardId, targetIndex);
    }

    setDragSource(null);
  };

  const handleWorkbenchBoardDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    clearStackHold();
    if (!dragSource) {
      return;
    }

    const point = getBoardPoint(event);
    if (dragSource.kind === 'backpack') {
      moveBackpackToWorkbench(dragSource.slotIndex, point);
    } else {
      moveWorkbenchStack(dragSource.cardId, point);
    }

    setDragSource(null);
  };

  const handleWorkbenchCardDrop = (event: DragEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    clearStackHold();
    setDragSource(null);
  };

  const handleExploreTerrain = () => {
    if (!actionOptionsEnabled || !!activeEvent || !!ending) {
      return;
    }
    exploreTerrainDrops(activeTerrain);
  };

  const renderBackpackCard = (slot: BackpackSlot) => {
    const item = getItemDefinition(slot.itemId);
    return (
      <button
        key={`backpack-${slot.slotIndex}`}
        type="button"
        draggable={!!item}
        className={`item-card backpack-card ${item ? 'filled' : ''} ${
          selectedBackpackSlot === slot.slotIndex ? 'selected' : ''
        }`}
        onClick={() => handleBackpackClick(slot)}
        onDragStart={() => {
          clearStackHold();
          item && setDragSource({ kind: 'backpack', slotIndex: slot.slotIndex });
        }}
        onDragEnd={() => {
          clearStackHold();
          setDragSource(null);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleBackpackDrop(slot.slotIndex)}
      >
        <span className="slot-index">B{slot.slotIndex + 1}</span>
        {item ? (
          <>
            <span className="item-card-icon">{item.icon}</span>
            <span className="item-card-name">{item.name}</span>
            <span className="item-card-type">{itemTypeLabel[item.type]}</span>
            {slot.amount > 1 && <span className="slot-amount">x{slot.amount}</span>}
          </>
        ) : (
          <span className="item-card-empty">空卡位</span>
        )}
      </button>
    );
  };

  const renderWorkbenchCard = (card: WorkbenchVisualCard) => {
    const item = getItemDefinition(card.itemId);
    const isSelected =
      selectedWorkbenchCard?.stackId === card.stackId && selectedWorkbenchCard?.itemId === card.itemId;
    const isHoldingTarget = stackHold?.targetCardId === card.id;
    const style = {
      left: `${card.x + card.order * CARD_STACK_OFFSET_X}px`,
      top: `${card.y + card.order * CARD_STACK_OFFSET_Y}px`,
      zIndex: 10 + card.order,
    } as CSSProperties;
    const ringStyle = {
      background: `conic-gradient(rgba(201, 168, 76, 0.95) ${stackProgress * 360}deg, rgba(255, 255, 255, 0.08) 0deg)`,
    } as CSSProperties;

    return (
      <button
        key={card.id}
        type="button"
        draggable
        className={`item-card workbench-card ${isSelected ? 'selected' : ''} ${
          isHoldingTarget ? 'stack-target' : ''
        }`}
        style={style}
        onClick={() => handleWorkbenchCardClick(card)}
        onDragStart={() => {
          clearStackHold();
          setDragSource({ kind: 'workbench', cardId: card.id });
        }}
        onDragEnd={() => {
          clearStackHold();
          setDragSource(null);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          beginStackHold(card.id);
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          beginStackHold(card.id);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (stackHold?.targetCardId === card.id) {
            clearStackHold();
          }
        }}
        onDrop={handleWorkbenchCardDrop}
      >
        <span className="slot-index">W</span>
        {item ? (
          <>
            <span className="item-card-icon">{item.icon}</span>
            <span className="item-card-name">{item.name}</span>
            <span className="item-card-type">{itemTypeLabel[item.type]}</span>
            {card.sameItemCount > 1 && <span className="stack-amount">x{card.sameItemCount}</span>}
            {isHoldingTarget && (
              <span className="stack-progress" aria-hidden="true">
                <span className="stack-progress-ring" style={ringStyle} />
                <span className="stack-progress-core" />
              </span>
            )}
          </>
        ) : (
          <span className="item-card-empty">空堆</span>
        )}
      </button>
    );
  };

  return (
    <>
      <main className="game-shell">
        <header className="top-bar">
          <div className="game-title">
            荒野求生：漂流者
            <span>storm journal prototype</span>
          </div>
          <div className="day-counter">
            <span className="day-label">Day</span>
            <span className="day-num">{environment.day}</span>
          </div>
            <div className={`phase-badge phase-${environment.timeOfDay}`}>{phaseLabel[environment.timeOfDay]}</div>
            <div className="clock-pill">{currentClock}</div>
          <div className="top-right">
            <div className="weather-box">
              <span className="weather-icon">{weatherIcon[environment.weather]}</span>
              <span>{weatherLabel[environment.weather]}</span>
            </div>
            <button type="button" className="btn-journal" onClick={() => setJournalOpen(true)}>
              日记
            </button>
            <button type="button" className="btn-journal" onClick={resetGame}>
              重开
            </button>
            <button type="button" className="btn-end-day" onClick={sleepAndAdvance}>
              主动休息
            </button>
          </div>
        </header>

        <aside className="panel-needs">
          <div className="panel-label">生存刻痕</div>
          {coreNeedMeta.map((need) => {
            const value = player[need.key];
            const status = getNeedStatus(need.key, value);
            return (
              <div key={need.key} className={`need-row ${need.className}`}>
                <div className="need-header">
                  <div className="need-name">
                    <span className="need-dot" />
                    <span>{need.label}</span>
                  </div>
                  <div className="need-val">{Math.round(value)}</div>
                </div>
                <div className="need-track">
                  <div
                    className={`need-fill ${status.level === 'crit' ? 'critical' : ''}`}
                    style={{ width: `${value}%` }}
                  />
                </div>
                <div className={`need-status ${status.level}`}>{status.text}</div>
              </div>
            );
          })}

          <div className="energy-block">
            <div className="panel-label compact">时间余量</div>
            <div className="energy-pips">
              {energyPips.map((active, index) => (
                <div key={index} className={`pip ${active ? 'active' : 'used'}`} />
              ))}
            </div>
            <div className="energy-label">
              剩余 {environment.actionsRemaining} 分钟 / 时段总计 {environment.actionLimit} 分钟
            </div>
          </div>

          <div className="left-note">
            <strong>今日目标</strong>
            <p>{activeGoal?.title ?? '已经抵达 7 天原型终局'}</p>
            <span>{activeGoal?.description ?? '第七天夜晚结束后会根据营地准备情况结算。'}</span>
            <span className="goal-progress">
              完成度 {completedGoalCount} / {allPrototypeGoals.length}
            </span>
          </div>
        </aside>

        <section className="panel-field">

          <div className="terrain-switch">
            {(['beach', 'jungle', 'cave'] as const).map((terrain) => (
              <button
                key={`top-terrain-${terrain}`}
                type="button"
                className={`terrain-chip ${environment.terrain === terrain ? 'active' : ''}`}
                onClick={() => {
                  setTerrain(terrain);
                  setSelectedActionTerrain(terrain);
                }}
              >
                <span className={`terrain-dot t-${terrain}`} />
                <span className="terrain-name">{terrainLabel[terrain]}</span>
              </button>
            ))}
          </div>

          <div className="location-lane">
            <button
              type="button"
              className={`location-card main ${selectedActionTerrain ? 'selected' : ''}`}
              onClick={() => {
                setSelectedActionTerrain(environment.terrain);
                setLocationModalOpen(true);
              }}
            >
              <span className="location-title">{activeTerrainCards.main}</span>
              <span className="location-meta">{terrainLabel[activeTerrain]} · 主地点</span>
            </button>
            {activeTerrainCards.children.map((entry) => (
              <div key={entry} className="location-card child">
                <span className="location-title">{entry}</span>
                <span className="location-meta">子地点</span>
              </div>
            ))}
            {activeTerrainCards.objects.map((entry) => (
              <div key={entry} className="location-card object">
                <span className="location-title">{entry}</span>
                <span className="location-meta">子物件</span>
              </div>
            ))}
          </div>
          <div className="card-workspace">
            <div className="workspace-header">
              <div>
                <div className="workspace-title">自由工作台</div>
                <div className="workspace-subtitle">
                  开出来的卡会横向排开。拖住一张卡悬停到另一张卡上，环形进度条走满才会真正堆叠；移开即可取消。
                </div>
                {activeWorkbenchHint && (
                  <div className="workbench-craft-hint">
                    <span className="hint-icon">🔨</span>
                    <span>可合成：{activeWorkbenchHint.recipeName}</span>
                    <span className="hint-progress">
                      {workbenchCraftHints.length}/{allCraftingRecipes.length}
                    </span>
                    {workbenchCraftHints.length > 1 && <span>+{workbenchCraftHints.length - 1}</span>}
                  </div>
                )}
              </div>
              <button type="button" className="btn-subtle" onClick={storeAllWorkbenchItems}>
                收回台面
              </button>
            </div>

            <div className={`drop-zone ${dragSource ? 'active' : ''}`}>
              {dragSource ? '拖到空白处摆放，悬停到卡牌上进行堆叠' : '工作台是整片自由区域，不再有固定格子'}
            </div>

            <div
              ref={boardRef}
              className={`workspace-board ${dragSource ? 'dragging' : ''}`}
              onDragOver={(event) => {
                event.preventDefault();
                clearStackHold();
              }}
              onDrop={handleWorkbenchBoardDrop}
              onClick={() => selectWorkbenchCard(null)}
            >
              {workbenchVisualCards.map((card) => renderWorkbenchCard(card))}
            </div>

            <div className="workspace-bottom">
              <div className={`recipe-preview ${workbenchRecipe ? 'matched' : ''}`}>
                <div className="recipe-title">当前卡堆</div>
                {selectedWorkbenchCard ? (
                  <>
                    <div className="recipe-name">
                      {selectedWorkbenchStack.length} 张卡 · {selectedWorkbenchItem?.name ?? '未知物品'} 起堆
                    </div>
                    {workbenchRecipe ? (
                      <>
                        <div className="recipe-line">{workbenchRecipe.description}</div>
                        <div className="recipe-eq">
                          {workbenchRecipe.requires.map((entry) => (
                            <span key={`req-${entry.itemId}`} className="recipe-token">
                              {getItemDefinition(entry.itemId)?.name ?? entry.itemId} x{entry.amount}
                            </span>
                          ))}
                          <span className="recipe-arrow">→</span>
                          {workbenchRecipe.produces.map((entry) => (
                            <span key={`pro-${entry.itemId}`} className="recipe-token recipe-result">
                              {getItemDefinition(entry.itemId)?.name ?? entry.itemId} x{entry.amount}
                            </span>
                          ))}
                        </div>
                        {workbenchRecipe.preserves && workbenchRecipe.preserves.length > 0 && (
                          <div className="recipe-line subtle">
                            保留：
                            {workbenchRecipe.preserves
                              .map(
                                (entry) =>
                                  `${getItemDefinition(entry.itemId)?.name ?? entry.itemId} x${entry.amount}`,
                              )
                              .join(' + ')}
                          </div>
                        )}
                        <button type="button" className="btn-paper craft-button" onClick={craftWorkbenchRecipe}>
                          手动合成当前卡堆
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="recipe-line">这叠卡还不能直接形成配方。</div>
                        <div className="recipe-line subtle">
                          海滩最短链：小石子 + 小石子，然后石刀 + 青椰子。
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="recipe-line">先选中一张工作台上的卡，预览只针对当前堆叠。</div>
                    <div className="recipe-line subtle">
                      不会自动合成。必须先形成卡堆，再手动点击按钮结算。
                    </div>
                  </>
                )}
              </div>

              <div className="selected-paper">
                {selectedBackpackItem && selectedBackpackSlotData ? (
                  <>
                    <div className="paper-kicker">背包卡</div>
                    <h3>{selectedBackpackItem.name}</h3>
                    <p>{selectedBackpackItem.description}</p>
                    <div className="paper-meta">
                      <span>数量 x{selectedBackpackSlotData.amount}</span>
                      <span>类型 {itemTypeLabel[selectedBackpackItem.type]}</span>
                    </div>
                    <div className="paper-actions">
                      {selectedBackpackItem.effect && (
                        <button
                          type="button"
                          className="btn-paper"
                          disabled={!!activeEvent || !!ending}
                          onClick={() => useBackpackItem(selectedBackpackSlotData.slotIndex)}
                        >
                          使用
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-paper secondary-ink"
                        disabled={!!ending}
                        onClick={() => moveBackpackToWorkbench(selectedBackpackSlotData.slotIndex, DEFAULT_WORKBENCH_DROP)}
                      >
                        放上工作台
                      </button>
                      <button
                        type="button"
                        className="btn-paper secondary-ink"
                        onClick={() => discardBackpackItem(selectedBackpackSlotData.slotIndex)}
                      >
                        丢弃
                      </button>
                    </div>
                  </>
                ) : selectedWorkbenchCard && selectedWorkbenchItem ? (
                  <>
                    <div className="paper-kicker">工作台卡</div>
                    <h3>{selectedWorkbenchItem.name}</h3>
                    <p>{selectedWorkbenchItem.description}</p>
                    <div className="paper-meta">
                      <span>所在卡堆 {selectedWorkbenchStack.length} 张</span>
                      <span>同名 x{selectedWorkbenchSameItemCount}</span>
                      <span>类型 {itemTypeLabel[selectedWorkbenchItem.type]}</span>
                    </div>
                    <div className="paper-actions">
                      {selectedWorkbenchItem.effect && (
                        <button
                          type="button"
                          className="btn-paper"
                          disabled={!!activeEvent || !!ending}
                          onClick={() => useWorkbenchItem(selectedWorkbenchCard.id)}
                        >
                          直接使用
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn-paper secondary-ink"
                        onClick={() => moveWorkbenchToBackpack(selectedWorkbenchCard.id)}
                      >
                        收回背包
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="paper-kicker">工作札记</div>
                    <h3>先摆开，再叠上去</h3>
                    <p>工作台上的物品会先分开排开。拖住卡牌悬停到目标卡上，环形进度走满才会完成堆叠，过程中随时可以挪开取消。</p>
                  </>
                )}
              </div>
            </div>
          </div>


          <div className="field-backpack-row">
            <div className="field-backpack-head">
              <span>背包（仅此区域会随你离开主地点）</span>
              <span>
                已占用 {backpack.filter((slot) => !!slot.itemId).length}/{backpack.length}
              </span>
            </div>
            <div className="field-backpack-grid">{backpack.map((slot) => renderBackpackCard(slot))}</div>

          </div>
        </section>

        <aside className="panel-info">
          <div className="info-section">
            <div className="info-head">身体</div>
            <div className="body-grid">
              {bodyMeta.map((entry) => (
                <div key={entry.key} className="body-chip">
                  <span>{entry.label}</span>
                  <strong>{Math.round(player[entry.key])}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="info-section">
            <div className="info-head">最近记录</div>
            <div className="log-stack">
              {logs.slice(0, 4).map((log, index) => (
                <div key={log.id} className={`log-entry ${index === 0 ? 'fresh' : ''}`}>
                  <span className="log-day">D{environment.day}</span>
                  {log.text}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      <div className={`location-action-modal ${locationModalOpen ? 'open' : ''}`} onClick={() => setLocationModalOpen(false)}>
        <div className="location-action-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="location-action-hero">
            <div className="location-action-title">{activeTerrainCards.main}</div>
            <div className="location-action-sub">
              {selectedActionTerrain ? terrainActionContext[selectedActionTerrain] : '选择地点后行动'}
            </div>
          </div>
          <div className="location-action-list">
            <button
              type="button"
              className={`action-option ${!actionOptionsEnabled || !!activeEvent || !!ending ? 'disabled' : ''}`}
              disabled={!actionOptionsEnabled || !!activeEvent || !!ending}
              onClick={() => {
                handleExploreTerrain();
                setLocationModalOpen(false);
              }}
            >
              <span className="action-option-name">{activeTerrainCards.action}</span>
              <span className="action-option-desc">随机翻出 3~5 张资源牌到工作台，自动横向分开摆放。</span>
              <span className="action-option-meta">
                <span className="hand-card-tag type-action">探索</span>
                <span className="hand-card-cost">消耗时间与精力</span>
              </span>
            </button>
          </div>
          <button type="button" className="location-action-close" onClick={() => setLocationModalOpen(false)}>
            关闭
          </button>
        </div>
      </div>

      <div className={`journal-overlay ${journalOpen ? 'open' : ''}`} onClick={() => setJournalOpen(false)}>
        <div className="journal-book" onClick={(event) => event.stopPropagation()}>
          <div className="journal-header">
            <div className="journal-title">求生日记</div>
            <div className="journal-sub">那些真正熬过去的夜晚，最后都会留下字迹。</div>
            <button type="button" className="journal-close" onClick={() => setJournalOpen(false)}>
              合上
            </button>
          </div>
          <div className="journal-body">
            {progress.journal.length > 0 ? (
              progress.journal.map((entry) => (
                <div key={entry.day} className="journal-page">
                  <div className="je-day">第 {entry.day} 天</div>
                  <div className="je-text">{entry.text}</div>
                  <div className="je-stats">
                    <span className="je-stat">{timeLabel[environment.timeOfDay]}</span>
                    <span className="je-stat">{weatherLabel[environment.weather]}</span>
                    <span className="je-stat">精神 {Math.round(player.sanity)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="journal-page">
                <div className="je-day">还没有写下第一页</div>
                <div className="je-text">
                  先撑过今晚吧。到了真正的夜里，系统会把今天最尖锐的情绪写进纸页里。
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeEvent && (
        <div className="crisis-overlay">
          <div className="crisis-card">
            <div className="crisis-header">
              <div className="crisis-icon">危</div>
              <div>
                <div className="crisis-name">{activeEvent.title}</div>
                <div className="crisis-tag">危机事件 · 必须先处理</div>
              </div>
            </div>
            <div className="crisis-body">
              <div className="crisis-desc">{activeEvent.description}</div>
              <div className="crisis-choices">
                {activeEvent.options.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    className="crisis-choice"
                    onClick={() => resolveEvent(option.id)}
                  >
                    <div className="choice-letter">{String.fromCharCode(65 + index)}</div>
                    <div>
                      <div className="choice-text">{option.label}</div>
                      <div className="choice-cost">{option.resultText}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function getNeedStatus(
  key: Extract<StatKey, 'hunger' | 'thirst' | 'temperature' | 'sanity'>,
  value: number,
) {
  if (key === 'hunger') {
    if (value < 25) return { text: '危险 · 明早必须找吃的', level: 'crit' };
    if (value < 50) return { text: '偏低 · 今天别再硬撑', level: 'warn' };
    return { text: '尚可 · 还撑得住', level: '' };
  }

  if (key === 'thirst') {
    if (value < 25) return { text: '危险 · 身体已经开始报警', level: 'crit' };
    if (value < 45) return { text: '偏低 · 优先补水', level: 'warn' };
    return { text: '正常 · 还能继续找资源', level: '' };
  }

  if (key === 'temperature') {
    if (value < 30) return { text: '危险 · 已经接近失温', level: 'crit' };
    if (value < 50) return { text: '偏低 · 黄昏前最好生火', level: 'warn' };
    return { text: '正常 · 风还扛得住', level: '' };
  }

  if (value < 30) return { text: '危险 · 不要一个人想太久', level: 'crit' };
  if (value < 50) return { text: '波动 · 夜里容易崩', level: 'warn' };
  return { text: '稳定 · 还没有乱掉', level: '' };
}

export default App;

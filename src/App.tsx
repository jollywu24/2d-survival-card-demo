import { useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react';
import { CardCanvas } from './components/CardCanvas';
import {
  allPrototypeGoals,
  getItemDefinition,
  getWorkbenchRecipePreview,
  isPrototypeGoalComplete,
  meetsCondition,
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

const cardTypeLabel = {
  action: '行动',
  resource: '资源',
  recipe: '配方',
  event: '事件',
  skill: '技能',
} as const;

const itemTypeLabel = {
  material: '材料',
  tool: '工具',
  food: '食物',
  water: '饮水',
  medical: '药品',
} as const;

const DEFAULT_WORKBENCH_DROP = { x: 170, y: 86 };
const CARD_STACK_OFFSET_X = 10;
const CARD_STACK_OFFSET_Y = 8;
const WORKBENCH_CARD_WIDTH = 112;
const WORKBENCH_CARD_HEIGHT = 78;

function App() {
  const boardRef = useRef<HTMLDivElement | null>(null);
  const {
    player,
    environment,
    progress,
    hand,
    backpack,
    workbench,
    selectedBackpackSlot,
    selectedWorkbenchCardId,
    activeEvent,
    ending,
    logs,
    nextTurn,
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
    craftWorkbenchRecipe,
    useCard,
  } = useGameStore();
  const [journalOpen, setJournalOpen] = useState(false);
  const [dragSource, setDragSource] = useState<
    | { kind: 'backpack'; slotIndex: number }
    | { kind: 'workbench'; cardId: string }
    | null
  >(null);

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
  const workbenchRecipe = getWorkbenchRecipePreview(workbench, selectedWorkbenchCardId);
  const activeGoal = allPrototypeGoals.find(
    (goal) => goal.day === Math.min(environment.day, progress.totalDays),
  );
  const completedGoalCount = allPrototypeGoals.filter((goal) =>
    isPrototypeGoalComplete(goal, player, progress),
  ).length;
  const energyPips = useMemo(
    () =>
      Array.from(
        { length: environment.actionLimit },
        (_, index) => index < environment.actionsRemaining,
      ),
    [environment.actionLimit, environment.actionsRemaining],
  );

  const stackCardIndex = useMemo(() => {
    const indexMap = new Map<string, number>();
    const counters = new Map<string, number>();

    workbench.forEach((card) => {
      const index = counters.get(card.stackId) ?? 0;
      indexMap.set(card.id, index);
      counters.set(card.stackId, index + 1);
    });

    return indexMap;
  }, [workbench]);

  const getBoardPoint = (event: DragEvent<HTMLElement>) => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) {
      return DEFAULT_WORKBENCH_DROP;
    }

    const x = Math.max(
      12,
      Math.min(rect.width - WORKBENCH_CARD_WIDTH - 12, event.clientX - rect.left - 56),
    );
    const y = Math.max(
      12,
      Math.min(rect.height - WORKBENCH_CARD_HEIGHT - 12, event.clientY - rect.top - 28),
    );

    return { x, y };
  };

  const handleBackpackClick = (slot: BackpackSlot) => {
    if (selectedBackpackSlot !== null && selectedBackpackSlot !== slot.slotIndex) {
      moveSelectedToSlot(slot.slotIndex);
      return;
    }

    selectBackpackSlot(slot.slotIndex);
  };

  const handleWorkbenchCardClick = (card: WorkbenchCard) => {
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

  const handleWorkbenchCardDrop = (
    event: DragEvent<HTMLButtonElement>,
    targetCardId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    if (!dragSource) {
      return;
    }

    if (dragSource.kind === 'backpack') {
      moveBackpackToWorkbench(dragSource.slotIndex, undefined, targetCardId);
    } else if (dragSource.cardId !== targetCardId) {
      moveWorkbenchStack(dragSource.cardId, undefined, targetCardId);
    }

    setDragSource(null);
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
        onDragStart={() => item && setDragSource({ kind: 'backpack', slotIndex: slot.slotIndex })}
        onDragEnd={() => setDragSource(null)}
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

  const renderWorkbenchCard = (card: WorkbenchCard) => {
    const item = getItemDefinition(card.itemId);
    const stackIndex = stackCardIndex.get(card.id) ?? 0;
    const style = {
      left: `${card.x + stackIndex * CARD_STACK_OFFSET_X}px`,
      top: `${card.y + stackIndex * CARD_STACK_OFFSET_Y}px`,
      zIndex: 10 + stackIndex,
    } as CSSProperties;

    return (
      <button
        key={card.id}
        type="button"
        draggable
        className={`item-card workbench-card ${
          selectedWorkbenchCardId === card.id ? 'selected' : ''
        }`}
        style={style}
        onClick={() => handleWorkbenchCardClick(card)}
        onDragStart={() => setDragSource({ kind: 'workbench', cardId: card.id })}
        onDragEnd={() => setDragSource(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => handleWorkbenchCardDrop(event, card.id)}
      >
        <span className="slot-index">W</span>
        {item ? (
          <>
            <span className="item-card-icon">{item.icon}</span>
            <span className="item-card-name">{item.name}</span>
            <span className="item-card-type">{itemTypeLabel[item.type]}</span>
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
          <div className={`phase-badge phase-${environment.timeOfDay}`}>
            {phaseLabel[environment.timeOfDay]}
          </div>
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
            <button type="button" className="btn-end-day" onClick={nextTurn}>
              推进阶段
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
            <div className="panel-label compact">行动余量</div>
            <div className="energy-pips">
              {energyPips.map((active, index) => (
                <div key={index} className={`pip ${active ? 'active' : 'used'}`} />
              ))}
            </div>
            <div className="energy-label">
              {environment.actionsRemaining} / {environment.actionLimit} 可用行动
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
          <div className={`scene-strip terrain-${environment.terrain} weather-${environment.weather}`}>
            <div className="scene-tint" />
            <div className="horizon" />
            <div className="terrain-svg">
              <div className={`terrain-silhouette silhouette-${environment.terrain}`} />
            </div>
            {(environment.weather === 'rain' || environment.weather === 'storm') && (
              <div className="rain-container">
                {Array.from({ length: environment.weather === 'storm' ? 22 : 14 }, (_, index) => (
                  <span
                    key={index}
                    className="particle"
                    style={
                      {
                        '--left': `${(index * 7) % 100}%`,
                        '--delay': `${(index % 6) * 0.14}s`,
                        '--duration': `${0.8 + (index % 5) * 0.12}s`,
                      } as CSSProperties
                    }
                  />
                ))}
              </div>
            )}
            <div className="terrain-label">{terrainLabel[environment.terrain]}</div>
            {activeEvent && <div className="event-banner">危机逼近：{activeEvent.title}</div>}
          </div>

          <div className="card-workspace">
            <div className="workspace-header">
              <div>
                <div className="workspace-title">自由堆叠工作台</div>
                <div className="workspace-subtitle">
                  拖到另一张卡上就是堆叠，只有明确点击“合成”才会结算，不再自动触发。
                </div>
              </div>
              <button type="button" className="btn-subtle" onClick={storeAllWorkbenchItems}>
                收回台面
              </button>
            </div>

            <div className={`drop-zone ${dragSource ? 'active' : ''}`}>
              {dragSource ? '松手放入工作台' : '把背包卡拖进整片区域，自由摆放和堆叠'}
            </div>

            <div
              ref={boardRef}
              className={`workspace-board ${dragSource ? 'dragging' : ''}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleWorkbenchBoardDrop}
              onClick={() => selectWorkbenchCard(null)}
            >
              {workbench.map((card) => renderWorkbenchCard(card))}
              {workbench.length === 0 && (
                <div className="workspace-hint">
                  这里不再有固定格。
                  <br />
                  从背包或手牌翻出的物品拖进来，然后把卡牌叠到一起。
                </div>
              )}
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
                      不会再自动合成。只有手动点击按钮，才会把当前卡堆结算成产物。
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
                    <h3>拖进来，再堆上去</h3>
                    <p>把卡拖进整片工作台区域，再拖到另一张卡上形成卡堆。当前只会手动合成，不会自动结算。</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="panel-info">
          <div className="info-section">
            <div className="info-head">地形</div>
            {(['beach', 'jungle', 'cave'] as const).map((terrain) => (
              <button
                key={terrain}
                type="button"
                className={`terrain-chip ${environment.terrain === terrain ? 'active' : ''}`}
                onClick={() => setTerrain(terrain)}
              >
                <span className={`terrain-dot t-${terrain}`} />
                <span className="terrain-name">{terrainLabel[terrain]}</span>
                <span className="terrain-ap">{environment.actionsRemaining} AP</span>
              </button>
            ))}
          </div>

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
            <div className="info-head">背包</div>
            <div className="backpack-grid">{backpack.map((slot) => renderBackpackCard(slot))}</div>
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

        <section className="panel-hand">
          <div className="hand-head">
            <div className="hand-label">当前手牌</div>
            <div className="hand-count">{hand.length} 张</div>
          </div>
          {hand.map((card) => {
            const actionCost = card.actionCost ?? 1;
            const disabled =
              !meetsCondition(player, environment, card.condition) ||
              !!activeEvent ||
              !!ending ||
              environment.actionsRemaining < actionCost;
            return (
              <div key={card.id} className="hand-card-wrap">
                <CardCanvas card={card} disabled={disabled} onClick={() => useCard(card.id)} />
                <div className="hand-card-meta">
                  <div className={`hand-card-tag type-${card.type}`}>{cardTypeLabel[card.type]}</div>
                  <div className="hand-card-cost">{actionCost > 0 ? `精力 ${actionCost}` : '无消耗'}</div>
                </div>
              </div>
            );
          })}
        </section>
      </main>

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


import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { CardCanvas } from './components/CardCanvas';
import {
  allCraftingRecipes,
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
import type { BackpackSlot, EnvironmentState, StatKey } from './types/game';

const coreNeedMeta: Array<{
  key: Extract<StatKey, 'hunger' | 'thirst' | 'temperature' | 'sanity'>;
  label: string;
  icon: string;
  className: string;
}> = [
  { key: 'hunger', label: '饱腹', icon: '肉', className: 'n-hunger' },
  { key: 'thirst', label: '水分', icon: '水', className: 'n-water' },
  { key: 'temperature', label: '体温', icon: '火', className: 'n-temp' },
  { key: 'sanity', label: '精神', icon: '心', className: 'n-mind' },
];

const bodyMeta: Array<{ key: Extract<StatKey, 'health' | 'fatigue'>; label: string }> = [
  { key: 'health', label: '生命' },
  { key: 'fatigue', label: '体力' },
];

const weatherIcon: Record<EnvironmentState['weather'], string> = {
  sunny: '晴',
  rain: '雨',
  storm: '暴',
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

const recipeCategoryLabel = {
  building: '建筑',
  food: '食物',
  tool: '工具',
  medical: '医疗',
  goal: '目标',
  skill: '技能',
} as const;

function App() {
  const {
    player,
    environment,
    progress,
    hand,
    backpack,
    workbench,
    selectedBackpackSlot,
    selectedWorkbenchSlot,
    activeEvent,
    ending,
    logs,
    nextTurn,
    resetGame,
    resolveEvent,
    setTerrain,
    selectBackpackSlot,
    selectWorkbenchSlot,
    moveSelectedToSlot,
    moveBackpackToWorkbench,
    moveWorkbenchToBackpack,
    moveWorkbenchItem,
    storeAllWorkbenchItems,
    useBackpackItem,
    discardBackpackItem,
    craftWorkbenchRecipe,
    useCard,
  } = useGameStore();
  const [journalOpen, setJournalOpen] = useState(false);
  const [dragSource, setDragSource] = useState<{
    kind: 'backpack' | 'workbench';
    index: number;
  } | null>(null);

  const workbenchRecipe = getWorkbenchRecipePreview(workbench);
  const selectedBackpackSlotData =
    selectedBackpackSlot !== null ? backpack[selectedBackpackSlot] ?? null : null;
  const selectedBackpackItem = getItemDefinition(selectedBackpackSlotData?.itemId ?? null);
  const selectedWorkbenchSlotData =
    selectedWorkbenchSlot !== null ? workbench[selectedWorkbenchSlot] ?? null : null;
  const selectedWorkbenchItem = getItemDefinition(selectedWorkbenchSlotData?.itemId ?? null);
  const activeGoal = allPrototypeGoals.find(
    (goal) => goal.day === Math.min(environment.day, progress.totalDays),
  );
  const completedGoalCount = allPrototypeGoals.filter((goal) =>
    isPrototypeGoalComplete(goal, player, progress),
  ).length;
  const energyPips = useMemo(
    () => Array.from({ length: environment.actionLimit }, (_, index) => index < environment.actionsRemaining),
    [environment.actionLimit, environment.actionsRemaining],
  );
  const firstEmptyWorkbenchSlot =
    workbench.find((slot) => slot.itemId === null)?.slotIndex ?? -1;

  useEffect(() => {
    if (!workbenchRecipe || activeEvent || ending || environment.actionsRemaining < 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      craftWorkbenchRecipe();
    }, 650);

    return () => window.clearTimeout(timer);
  }, [
    activeEvent,
    craftWorkbenchRecipe,
    ending,
    environment.actionsRemaining,
    workbenchRecipe,
  ]);

  const handleBackpackClick = (slot: BackpackSlot) => {
    if (selectedWorkbenchSlot !== null) {
      moveWorkbenchToBackpack(selectedWorkbenchSlot, slot.slotIndex);
      return;
    }

    if (selectedBackpackSlot !== null && selectedBackpackSlot !== slot.slotIndex) {
      moveSelectedToSlot(slot.slotIndex);
      return;
    }

    selectBackpackSlot(slot.slotIndex);
  };

  const handleWorkbenchClick = (slot: BackpackSlot) => {
    if (selectedBackpackSlot !== null) {
      moveBackpackToWorkbench(selectedBackpackSlot, slot.slotIndex);
      return;
    }

    if (selectedWorkbenchSlot !== null && selectedWorkbenchSlot !== slot.slotIndex) {
      moveWorkbenchItem(selectedWorkbenchSlot, slot.slotIndex);
      return;
    }

    selectWorkbenchSlot(slot.slotIndex);
  };

  const handleBackpackDrop = (targetIndex: number) => {
    if (!dragSource) {
      return;
    }

    if (dragSource.kind === 'workbench') {
      moveWorkbenchToBackpack(dragSource.index, targetIndex);
    }

    setDragSource(null);
  };

  const handleWorkbenchDrop = (targetIndex: number) => {
    if (!dragSource) {
      return;
    }

    if (dragSource.kind === 'backpack') {
      moveBackpackToWorkbench(dragSource.index, targetIndex);
    } else {
      moveWorkbenchItem(dragSource.index, targetIndex);
    }

    setDragSource(null);
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
              求生日记
            </button>
            <button type="button" className="btn-end-day" onClick={nextTurn}>
              结束阶段
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
                    id={`bar-${need.key}`}
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
            <p>{activeGoal?.title ?? '已经走到原型终局'}</p>
            <span>
              {activeGoal?.description ?? '第七天结束后将根据营地准备情况给出结局。'}
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
            {activeEvent && <div className="event-banner">危机正在逼近：{activeEvent.title}</div>}
          </div>

          <div className="card-workspace">
            <div className="workspace-header">
              <div>
                <div className="workspace-title">堆叠合成工作台</div>
                <div className="workspace-subtitle">
                  把材料拖进同一个区域，像翻动一页湿透的生存笔记那样慢慢拼出营地。
                </div>
              </div>
              <button type="button" className="btn-subtle" onClick={storeAllWorkbenchItems}>
                收回台面
              </button>
            </div>

            <div className={`drop-zone ${dragSource ? 'active' : ''}`}>
              {dragSource ? '松手放入叠放区' : '把资源拖到这里进行叠放'}
            </div>

            <div className="workspace-board">
              {workbench.map((slot) => {
                const item = getItemDefinition(slot.itemId);
                return (
                  <button
                    key={slot.slotIndex}
                    type="button"
                    draggable={!!item}
                    className={`work-card slot-${slot.slotIndex} ${
                      selectedWorkbenchSlot === slot.slotIndex ? 'selected' : ''
                    } ${item ? 'filled' : ''}`}
                    onClick={() => handleWorkbenchClick(slot)}
                    onDragStart={() =>
                      item && setDragSource({ kind: 'workbench', index: slot.slotIndex })
                    }
                    onDragEnd={() => setDragSource(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleWorkbenchDrop(slot.slotIndex)}
                  >
                    {item ? (
                      <>
                        <span className="work-card-icon">{item.icon}</span>
                        <span className="work-card-name">{item.name}</span>
                      </>
                    ) : (
                      <span className="work-card-empty">空位</span>
                    )}
                  </button>
                );
              })}
              {!workbench.some((slot) => slot.itemId) && (
                <div className="workspace-hint">
                  荒野里没有面板，只有你手里能摆出来的东西。
                  <br />
                  从背包里拖材料上来试试。
                </div>
              )}
            </div>

            <div className="workspace-bottom">
              <div className={`recipe-preview ${workbenchRecipe ? 'matched' : ''}`}>
                <div className="recipe-title">配方预感</div>
                {workbenchRecipe ? (
                  <>
                    <div className="recipe-name">{workbenchRecipe.name}</div>
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
                  </>
                ) : (
                  <>
                    <div className="recipe-line">还没形成可识别组合。</div>
                    <div className="recipe-line subtle">
                      常见做法：木材 + 木材 + 燧石，或棕榈叶 + 藤蔓。
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
                      <span>类型 {selectedBackpackItem.type}</span>
                    </div>
                    <div className="paper-actions">
                      <button
                        type="button"
                        className="btn-paper"
                        disabled={!!activeEvent || environment.actionsRemaining < 1 || !!ending}
                        onClick={() => useBackpackItem(selectedBackpackSlotData.slotIndex)}
                      >
                        使用
                      </button>
                      <button
                        type="button"
                        className="btn-paper secondary-ink"
                        disabled={firstEmptyWorkbenchSlot < 0 || !!ending}
                        onClick={() =>
                          firstEmptyWorkbenchSlot >= 0 &&
                          moveBackpackToWorkbench(
                            selectedBackpackSlotData.slotIndex,
                            firstEmptyWorkbenchSlot,
                          )
                        }
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
                ) : selectedWorkbenchItem && selectedWorkbenchSlotData ? (
                  <>
                    <div className="paper-kicker">台面卡</div>
                    <h3>{selectedWorkbenchItem.name}</h3>
                    <p>{selectedWorkbenchItem.description}</p>
                    <div className="paper-meta">
                      <span>工作台位 W{selectedWorkbenchSlotData.slotIndex + 1}</span>
                      <span>等待继续叠放</span>
                    </div>
                    <div className="paper-actions">
                      <button
                        type="button"
                        className="btn-paper secondary-ink"
                        onClick={() => moveWorkbenchToBackpack(selectedWorkbenchSlotData.slotIndex)}
                      >
                        收回背包
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="paper-kicker">工作札记</div>
                    <h3>从卡开始摆</h3>
                    <p>选中背包里的物品可以直接放上工作台，也可以拖拽到中央叠放区。</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside className="panel-info">
          <div className="info-section">
            <div className="info-head">地形区域</div>
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
            <div className="info-head">身体状态</div>
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
            <div className="info-head">求生目标</div>
            <div className="goal-paper">
              <strong>{activeGoal?.title ?? '终局已触发'}</strong>
              <p>
                {activeGoal?.description ?? '接下来只需要看营地准备是否足够，让结局自己发生。'}
              </p>
              <span>
                已完成 {completedGoalCount} / {allPrototypeGoals.length}
              </span>
            </div>
          </div>

          <div className="info-section">
            <div className="info-head">已知配方</div>
            <div className="recipe-scroll">
              {allCraftingRecipes.map((recipe) => (
                <div key={recipe.id} className="recipe-mini">
                  <strong>{recipe.name}</strong>
                  <p>{recipe.category ? recipeCategoryLabel[recipe.category] : '配方'}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="info-section">
            <div className="info-head">最近记录</div>
            <div className="log-stack">
              {logs.slice(0, 6).map((log, index) => (
                <div key={log.id} className={`log-entry ${index === 0 ? 'fresh' : ''}`}>
                  <span className="log-day">D{environment.day}</span>
                  {log.text}
                </div>
              ))}
            </div>
          </div>
        </aside>

        <section className="panel-hand">
          <div className="hand-label">当前手牌</div>
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
                  <div className="hand-card-cost">
                    {actionCost > 0 ? `精力 ${actionCost}` : '无消耗'}
                  </div>
                </div>
              </div>
            );
          })}

          <div className="action-row">
            <button type="button" className="btn-end-day" onClick={nextTurn}>
              结束今天
            </button>
            <button type="button" className="btn-journal" onClick={() => setJournalOpen(true)}>
              打开日记
            </button>
            <button type="button" className="btn-journal" onClick={resetGame}>
              重开原型
            </button>
          </div>
        </section>
      </main>

      <div
        className={`journal-overlay ${journalOpen ? 'open' : ''}`}
        onClick={() => setJournalOpen(false)}
      >
        <div className="journal-book" onClick={(event) => event.stopPropagation()}>
          <div className="journal-header">
            <div className="journal-title">求生日记</div>
            <div className="journal-sub">那些真正熬过去的夜晚，都会留下字迹</div>
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
                <div className="je-day">尚未记下任何一页</div>
                <div className="je-text">
                  还没有走到第一个夜晚。等天色真正暗下来，系统会自动替你写下当天最尖锐的感受。
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
                <div className="crisis-tag">危机事件 · 必须处理</div>
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
    if (value < 25) return { text: '危险 · 明早必须找食物', level: 'crit' };
    if (value < 50) return { text: '偏低 · 今日别再硬撑', level: 'warn' };
    return { text: '尚可 · 还能继续行动', level: '' };
  }

  if (key === 'thirst') {
    if (value < 25) return { text: '危险 · 身体已经开始报警', level: 'crit' };
    if (value < 45) return { text: '偏低 · 优先补水', level: 'warn' };
    return { text: '正常 · 还没到发干的时候', level: '' };
  }

  if (key === 'temperature') {
    if (value < 30) return { text: '危险 · 失温边缘', level: 'crit' };
    if (value < 50) return { text: '偏低 · 黄昏前要准备火', level: 'warn' };
    return { text: '正常 · 风还扛得住', level: '' };
  }

  if (value < 30) return { text: '危险 · 不要一个人想太久', level: 'crit' };
  if (value < 50) return { text: '波动 · 夜里容易崩', level: 'warn' };
  return { text: '稳定 · 心还撑得住', level: '' };
}

export default App;

import { useEffect, useState, type CSSProperties } from 'react';
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
import type { BackpackSlot, StatKey } from './types/game';

const statMeta: Record<
  StatKey,
  { label: string; icon: string; tone: string; shortLabel: string }
> = {
  health: { label: '生命', shortLabel: 'HP', icon: '♥', tone: '#c95845' },
  hunger: { label: '饱腹', shortLabel: 'FOOD', icon: '🍖', tone: '#d8a64f' },
  thirst: { label: '水分', shortLabel: 'WATER', icon: '💧', tone: '#4c9fcb' },
  temperature: { label: '体温', shortLabel: 'TEMP', icon: '🔥', tone: '#db7c3f' },
  sanity: { label: '理智', shortLabel: 'MIND', icon: '🧠', tone: '#b184d6' },
  fatigue: { label: '体力', shortLabel: 'REST', icon: '☾', tone: '#7f8fb8' },
};

const primaryStats: StatKey[] = ['hunger', 'health', 'sanity'];
const secondaryStats: StatKey[] = ['thirst', 'temperature', 'fatigue'];
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
    hand,
    backpack,
    workbench,
    selectedBackpackSlot,
    selectedWorkbenchSlot,
    activeEvent,
    ending,
    progress,
    logs,
    nextTurn,
    resetGame,
    resolveEvent,
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
  const [dragSource, setDragSource] = useState<{
    kind: 'backpack' | 'workbench';
    index: number;
  } | null>(null);

  const phaseProgressMap = { day: 0, dusk: 1 / 3, night: 2 / 3 } as const;
  const clockProgress = phaseProgressMap[environment.timeOfDay];
  const selectedSlot =
    selectedBackpackSlot !== null ? backpack[selectedBackpackSlot] ?? null : null;
  const selectedItem = selectedSlot ? getItemDefinition(selectedSlot.itemId) : null;
  const selectedWorkbench =
    selectedWorkbenchSlot !== null ? workbench[selectedWorkbenchSlot] ?? null : null;
  const selectedWorkbenchItem = selectedWorkbench
    ? getItemDefinition(selectedWorkbench.itemId)
    : null;
  const activeGoal = allPrototypeGoals.find(
    (goal) => goal.day === Math.min(environment.day, progress.totalDays),
  );
  const completedGoalCount = allPrototypeGoals.filter((goal) =>
    isPrototypeGoalComplete(goal, player, progress),
  ).length;
  const workbenchRecipe = getWorkbenchRecipePreview(workbench);
  const firstEmptyWorkbenchSlot =
    workbench.find((slot) => slot.itemId === null)?.slotIndex ?? -1;

  useEffect(() => {
    if (!workbenchRecipe || activeEvent || ending || environment.actionsRemaining < 1) {
      return;
    }

    const timer = window.setTimeout(() => {
      craftWorkbenchRecipe();
    }, 650);

    return () => {
      window.clearTimeout(timer);
    };
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
    <main className="app-shell">
      <section className="hero-panel compact">
        <div>
          <p className="eyebrow">2D 荒野求生卡牌 Demo</p>
          <h1>生存工作台</h1>
          <p className="hero-copy">
            7天生存原型：在第七天结束前活下来，并尽量完成求救信标。
          </p>
        </div>
        <div className="hero-actions">
          <span className="phase-action-pill">
            {timeLabel[environment.timeOfDay]} · {environment.actionsRemaining}/
            {environment.actionLimit} 次行动
          </span>
          <button type="button" onClick={nextTurn}>
            推进阶段
          </button>
          <button type="button" className="secondary" onClick={resetGame}>
            重开
          </button>
        </div>
      </section>

      {ending && (
        <section className={`panel ending-banner ${ending.type}`}>
          <div className="panel-title">本局结算</div>
          <h2>{ending.title}</h2>
          <p>{ending.description}</p>
        </section>
      )}

      <section className="workbench-grid">
        <section className="left-column">
          <div className="panel hud-panel">
            <div className="panel-title">生存 HUD</div>
            <div className="hud-layout">
              <div className="hud-primary-group">
                {primaryStats.map((key) => (
                  <StatusEmblem key={key} statKey={key} value={player[key]} />
                ))}
              </div>

              <div className="day-wheel-wrap">
                <div
                  className="day-wheel"
                  style={
                    {
                      '--clock-progress': `${clockProgress}turn`,
                    } as CSSProperties
                  }
                >
                  <div className="day-wheel-inner">
                    <span className="day-wheel-label">Day {environment.day}</span>
                    <span className="day-wheel-sub">{timeLabel[environment.timeOfDay]}</span>
                  </div>
                  <div className="day-wheel-pointer" />
                </div>

                <div className="world-markers">
                  <span className={`world-chip ${environment.weather}`}>
                    {weatherLabel[environment.weather]}
                  </span>
                  <span className="world-chip terrain">
                    {terrainLabel[environment.terrain]}
                  </span>
                </div>
              </div>
            </div>
            <div className="hud-secondary-group horizontal">
              {secondaryStats.map((key) => (
                <StatusEmblem key={key} statKey={key} value={player[key]} compact />
              ))}
            </div>
          </div>

          <div className="panel environment-panel">
            <div className="panel-title">7天原型进度</div>
            <div className="prototype-summary">
              <div className="prototype-progress-head">
                <strong>
                  Day {Math.min(environment.day, progress.totalDays)} / {progress.totalDays}
                </strong>
                <span>
                  {timeLabel[environment.timeOfDay]} · {completedGoalCount} /{' '}
                  {allPrototypeGoals.length} 目标完成
                </span>
              </div>
              <div className="prototype-progress-bar">
                <div
                  style={{
                    width: `${(completedGoalCount / allPrototypeGoals.length) * 100}%`,
                  }}
                />
              </div>
              {activeGoal && (
                <div className="active-goal-card">
                  <span className="goal-day-tag">今日目标</span>
                  <strong>{activeGoal.title}</strong>
                  <p>{activeGoal.description}</p>
                  <span className="goal-day-tag subtle">
                    本阶段剩余行动：{environment.actionsRemaining}
                  </span>
                  <span
                    className={`goal-status ${
                      isPrototypeGoalComplete(activeGoal, player, progress)
                        ? 'done'
                        : 'pending'
                    }`}
                  >
                    {isPrototypeGoalComplete(activeGoal, player, progress)
                      ? '已完成'
                      : '进行中'}
                  </span>
                </div>
              )}
              <div className="goal-list">
                {allPrototypeGoals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`goal-row ${
                      isPrototypeGoalComplete(goal, player, progress) ? 'done' : ''
                    }`}
                  >
                    <span>Day {goal.day}</span>
                    <strong>{goal.title}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="panel environment-panel panel-scroll">
            <div className="panel-title">夜间日记</div>
            <div className="journal-list">
              {progress.journal.length > 0 ? (
                progress.journal.map((entry) => (
                  <div key={entry.day} className="journal-entry">
                    <strong>第 {entry.day} 天</strong>
                    <p>{entry.text}</p>
                  </div>
                ))
              ) : (
                <div className="journal-entry empty">
                  <strong>尚未入夜</strong>
                  <p>
                    每个夜晚结束时会自动写下一段求生日记，记录你这一天的状态与感受。
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="panel environment-panel">
            <div className="panel-title">生存提示</div>
            <div className="survival-notes">
              <SurvivalRule title="昼夜" text="夜晚会持续拉低理智与体力，生火与休息更关键。" />
              <SurvivalRule
                title="阶段"
                text="白天可行动 2 次，黄昏 1 次，夜晚 1 次；部分行动只能在特定阶段执行。"
              />
              <SurvivalRule title="气候" text="雨天和风暴会压低体温，洞穴和火源更安全。" />
              <SurvivalRule title="目标" text="第6天前完成求救信标，第7天夜晚会结算是否获救。" />
              <SurvivalRule
                title="叠放"
                text="把材料拖进工作台，或先点背包格再点工作台格；识别到配方后会自动合成。"
              />
            </div>
          </div>

          <section className="panel panel-scroll log-column">
            <div className="panel-title">日志</div>
            <div className="log-list">
              {logs.map((log) => (
                <div key={log.id} className="log-item">
                  {log.text}
                </div>
              ))}
            </div>
          </section>
        </section>

        <section className="panel backpack-panel center-column">
          <div className="panel-title">背包 + Stacklands 工作台</div>
          <div className="backpack-layout single-screen">
            <div className="inventory-column">
              <div className="subpanel-title">背包</div>
              <div className="backpack-grid">
                {backpack.map((slot) => {
                  const item = getItemDefinition(slot.itemId);
                  return (
                    <button
                      key={slot.slotIndex}
                      type="button"
                      draggable={!!item}
                      className={`backpack-slot ${
                        selectedBackpackSlot === slot.slotIndex ? 'selected' : ''
                      } ${item ? 'filled' : ''}`}
                      onClick={() => handleBackpackClick(slot)}
                      onDragStart={() =>
                        item && setDragSource({ kind: 'backpack', index: slot.slotIndex })
                      }
                      onDragEnd={() => setDragSource(null)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={() => handleBackpackDrop(slot.slotIndex)}
                    >
                      <span className="slot-index">{slot.slotIndex + 1}</span>
                      {item ? (
                        <>
                          <span className="slot-icon">{item.icon}</span>
                          <span className="slot-amount">x{slot.amount}</span>
                        </>
                      ) : (
                        <span className="slot-empty">空</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="stacklands-panel">
                <div className="stacklands-head">
                  <div>
                    <strong>叠放工作台</strong>
                    <p>像 Stacklands 一样，把材料卡拖进这里叠放组合。</p>
                  </div>
                  <button
                    type="button"
                    className="secondary small"
                    onClick={storeAllWorkbenchItems}
                  >
                    收回全部
                  </button>
                </div>

                <div className="workbench-drop-grid">
                  {workbench.map((slot) => {
                    const item = getItemDefinition(slot.itemId);
                    return (
                      <button
                        key={slot.slotIndex}
                        type="button"
                        draggable={!!item}
                        className={`workbench-slot ${
                          selectedWorkbenchSlot === slot.slotIndex ? 'selected' : ''
                        } ${item ? 'filled' : ''} ${
                          workbenchRecipe ? 'recipe-ready' : ''
                        }`}
                        onClick={() => handleWorkbenchClick(slot)}
                        onDragStart={() =>
                          item && setDragSource({ kind: 'workbench', index: slot.slotIndex })
                        }
                        onDragEnd={() => setDragSource(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleWorkbenchDrop(slot.slotIndex)}
                      >
                        <span className="slot-index">W{slot.slotIndex + 1}</span>
                        {item ? (
                          <>
                            <span className="slot-icon">{item.icon}</span>
                            <span className="slot-label">{item.name}</span>
                          </>
                        ) : (
                          <span className="slot-empty">拖到这里</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className={`recipe-preview ${workbenchRecipe ? 'ready' : ''}`}>
                  {workbenchRecipe ? (
                    <>
                      <span className="preview-badge">配方匹配</span>
                      <strong>{workbenchRecipe.name}</strong>
                      <p>{workbenchRecipe.description}</p>
                      <span className="preview-meta">
                        {environment.actionsRemaining >= 1
                          ? '0.65 秒后自动完成叠放合成'
                          : '已识别配方，但本阶段行动次数不足'}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="preview-badge idle">等待叠放</span>
                      <strong>还没形成可识别配方</strong>
                      <p>把需要的材料单独拖进工作台格子里，系统会自动识别已知组合。</p>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="inventory-detail">
              <div className="inventory-card">
                {selectedItem && selectedSlot && selectedSlot.itemId ? (
                  <>
                    <div className="inventory-icon">{selectedItem.icon}</div>
                    <h3>{selectedItem.name}</h3>
                    <p>{selectedItem.description}</p>
                    <div className="inventory-meta">
                      <span>数量 x{selectedSlot.amount}</span>
                      <span>类型 {selectedItem.type}</span>
                      <span>点击工作台格可放入单张</span>
                    </div>
                    <div className="inventory-actions">
                      <button
                        type="button"
                        disabled={!!activeEvent || environment.actionsRemaining < 1 || !!ending}
                        onClick={() => useBackpackItem(selectedSlot.slotIndex)}
                      >
                        使用
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        disabled={firstEmptyWorkbenchSlot < 0 || !!ending}
                        onClick={() =>
                          firstEmptyWorkbenchSlot >= 0 &&
                          moveBackpackToWorkbench(
                            selectedSlot.slotIndex,
                            firstEmptyWorkbenchSlot,
                          )
                        }
                      >
                        放到工作台
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => discardBackpackItem(selectedSlot.slotIndex)}
                      >
                        丢弃
                      </button>
                    </div>
                  </>
                ) : selectedWorkbenchItem && selectedWorkbench && selectedWorkbench.itemId ? (
                  <>
                    <div className="inventory-icon workbench">{selectedWorkbenchItem.icon}</div>
                    <h3>{selectedWorkbenchItem.name}</h3>
                    <p>{selectedWorkbenchItem.description}</p>
                    <div className="inventory-meta">
                      <span>位置 W{selectedWorkbench.slotIndex + 1}</span>
                      <span>工作台卡</span>
                      <span>可拖回背包继续链式合成</span>
                    </div>
                    <div className="inventory-actions">
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => moveWorkbenchToBackpack(selectedWorkbench.slotIndex)}
                      >
                        收回背包
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="inventory-icon empty">🃏</div>
                    <h3>选择一张卡</h3>
                    <p>背包卡可以使用、丢弃或拖到工作台；工作台卡可以继续叠放或收回背包。</p>
                  </>
                )}
              </div>

              <div className="crafting-panel panel-scroll">
                <h3>已知配方</h3>
                <p className="crafting-note">
                  这里只负责展示，真正的合成在上方工作台叠放区自动完成。
                </p>
                <div className="crafting-list">
                  {allCraftingRecipes.map((recipe) => (
                    <div
                      key={recipe.id}
                      className={`crafting-item ${
                        workbenchRecipe?.id === recipe.id ? 'matched' : ''
                      }`}
                    >
                      <div>
                        <strong>{recipe.name}</strong>
                        <p>{recipe.description}</p>
                        <div className="crafting-meta">
                          <span>消耗：1 行动</span>
                          <span>
                            材料：
                            {recipe.requires
                              .map(
                                (entry) =>
                                  `${getItemDefinition(entry.itemId)?.name ?? entry.itemId} x${
                                    entry.amount
                                  }`,
                              )
                              .join(' + ')}
                          </span>
                          {recipe.preserves && recipe.preserves.length > 0 && (
                            <span>
                              保留：
                              {recipe.preserves
                                .map(
                                  (entry) =>
                                    `${getItemDefinition(entry.itemId)?.name ?? entry.itemId} x${
                                      entry.amount
                                    }`,
                                )
                                .join(' + ')}
                            </span>
                          )}
                          <span>
                            产出：
                            {recipe.produces
                              .map(
                                (entry) =>
                                  `${getItemDefinition(entry.itemId)?.name ?? entry.itemId} x${
                                    entry.amount
                                  }`,
                              )
                              .join(' + ')}
                          </span>
                          {recipe.category && (
                            <span>类型：{recipeCategoryLabel[recipe.category]}</span>
                          )}
                        </div>
                      </div>
                      <span className="recipe-state">
                        {workbenchRecipe?.id === recipe.id ? '匹配中' : '已知'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="right-column">
          {activeEvent && (
            <section className="event-panel panel">
              <div className="panel-title">事件</div>
              <h2>{activeEvent.title}</h2>
              <p>{activeEvent.description}</p>
              <div className="event-options">
                {activeEvent.options.map((option) => (
                  <button key={option.id} type="button" onClick={() => resolveEvent(option.id)}>
                    {option.label}
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="panel hand-panel panel-scroll">
            <div className="panel-title">手牌</div>
            <div className="card-row compact">
              {hand.map((card) => {
                const actionCost = card.actionCost ?? 1;
                const disabled =
                  !meetsCondition(player, environment, card.condition) ||
                  !!activeEvent ||
                  !!ending ||
                  environment.actionsRemaining < actionCost;
                return (
                  <div key={card.id} className="card-stack">
                    <CardCanvas
                      card={card}
                      disabled={disabled}
                      onClick={() => useCard(card.id)}
                    />
                    <div className="card-cost-tag">消耗 {actionCost} 行动</div>
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function StatusEmblem({
  statKey,
  value,
  compact = false,
}: {
  statKey: StatKey;
  value: number;
  compact?: boolean;
}) {
  const meta = statMeta[statKey];

  return (
    <div
      className={`status-emblem ${compact ? 'compact' : ''}`}
      style={
        {
          '--emblem-tone': meta.tone,
          '--emblem-fill': `${value}%`,
        } as CSSProperties
      }
    >
      <div className="status-ring">
        <div className="status-core">
          <span className="status-icon" aria-hidden="true">
            {meta.icon}
          </span>
        </div>
      </div>
      <div className="status-meta">
        <strong>{value}</strong>
        <span>{compact ? meta.shortLabel : meta.label}</span>
      </div>
    </div>
  );
}

function SurvivalRule({ title, text }: { title: string; text: string }) {
  return (
    <div className="survival-rule">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

export default App;

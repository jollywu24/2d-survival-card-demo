import { useEffect, useMemo, useState, type CSSProperties } from 'react';
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
import type { BackpackSlot, EnvironmentState, StatKey } from './types/game';

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
    useWorkbenchItem,
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
    () =>
      Array.from(
        { length: environment.actionLimit },
        (_, index) => index < environment.actionsRemaining,
      ),
    [environment.actionLimit, environment.actionsRemaining],
  );
  const firstEmptyWorkbenchSlot =
    workbench.find((slot) => slot.itemId === null)?.slotIndex ?? -1;

  useEffect(() => {
    if (!workbenchRecipe || activeEvent || ending) {
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

  const renderItemCard = (slot: BackpackSlot, kind: 'backpack' | 'workbench') => {
    const item = getItemDefinition(slot.itemId);
    const selected =
      kind === 'backpack'
        ? selectedBackpackSlot === slot.slotIndex
        : selectedWorkbenchSlot === slot.slotIndex;

    return (
      <button
        key={`${kind}-${slot.slotIndex}`}
        type="button"
        draggable={!!item}
        className={`item-card ${kind === 'workbench' ? `work-card slot-${slot.slotIndex}` : 'backpack-card'} ${
          selected ? 'selected' : ''
        } ${item ? 'filled' : ''}`}
        onClick={() => (kind === 'backpack' ? handleBackpackClick(slot) : handleWorkbenchClick(slot))}
        onDragStart={() => item && setDragSource({ kind, index: slot.slotIndex })}
        onDragEnd={() => setDragSource(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() =>
          kind === 'backpack' ? handleBackpackDrop(slot.slotIndex) : handleWorkbenchDrop(slot.slotIndex)
        }
      >
        <span className="slot-index">{kind === 'backpack' ? `B${slot.slotIndex + 1}` : `W${slot.slotIndex + 1}`}</span>
        {item ? (
          <>
            <span className="item-card-icon">{item.icon}</span>
            <span className="item-card-name">{item.name}</span>
            <span className="item-card-type">{itemTypeLabel[item.type]}</span>
            {slot.amount > 1 && <span className="slot-amount">x{slot.amount}</span>}
          </>
        ) : (
          <span className="item-card-empty">{kind === 'backpack' ? '空卡位' : '空叠放位'}</span>
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
                <div className="workspace-title">堆叠合成工作台</div>
                <div className="workspace-subtitle">
                  把材料拖进同一片区域，像翻动一页潮湿日记那样，慢慢拼出营地和求生工具。
                </div>
              </div>
              <button type="button" className="btn-subtle" onClick={storeAllWorkbenchItems}>
                收回台面
              </button>
            </div>

            <div className={`drop-zone ${dragSource ? 'active' : ''}`}>
              {dragSource ? '松手放入叠放区' : '拖拽物品到这里进行堆叠合成'}
            </div>

            <div className="workspace-board">
              {workbench.map((slot) => renderItemCard(slot, 'workbench'))}
              {!workbench.some((slot) => slot.itemId) && (
                <div className="workspace-hint">
                  荒野里没有菜单，只有你手里摆出来的东西。
                  <br />
                  从右侧背包拖材料上来试试。
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
                    <div className="recipe-line">暂时还没有形成可识别的组合。</div>
                    <div className="recipe-line subtle">
                      海滩最短链：小石子 + 小石子，或者石刀 + 青椰子。
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
                      <span>工作位 W{selectedWorkbenchSlotData.slotIndex + 1}</span>
                      <span>继续叠放可尝试配方</span>
                    </div>
                    <div className="paper-actions">
                      {selectedWorkbenchItem.effect && (
                        <button
                          type="button"
                          className="btn-paper"
                          disabled={!!activeEvent || !!ending}
                          onClick={() => useWorkbenchItem(selectedWorkbenchSlotData.slotIndex)}
                        >
                          直接使用
                        </button>
                      )}
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
                    <h3>从卡牌开始摆</h3>
                    <p>选中右侧背包里的物品可以直接放上工作台，也可以拖拽到中央叠放区。</p>
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
            <div className="backpack-grid">
              {backpack.map((slot) => renderItemCard(slot, 'backpack'))}
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
                  <div className="hand-card-cost">
                    {actionCost > 0 ? `精力 ${actionCost}` : '无消耗'}
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </main>

      <div
        className={`journal-overlay ${journalOpen ? 'open' : ''}`}
        onClick={() => setJournalOpen(false)}
      >
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

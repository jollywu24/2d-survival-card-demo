import type { CSSProperties } from 'react';
import { CardCanvas } from './components/CardCanvas';
import {
  terrainLabel,
  timeLabel,
  useGameStore,
  weatherLabel,
  meetsCondition,
} from './store/gameStore';
import type { StatKey } from './types/game';

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

function App() {
  const {
    player,
    environment,
    hand,
    activeEvent,
    logs,
    nextTurn,
    resetGame,
    resolveEvent,
    useCard,
  } = useGameStore();

  const clockProgress = ((environment.turn - 1) % 2) / 2;

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">2D 荒野求生卡牌 Demo</p>
          <h1>在回合推进与状态联动中活下去</h1>
          <p className="hero-copy">
            首版包含 10 张基础卡牌、随机事件、环境变化与生存状态联动。
          </p>
        </div>
        <div className="hero-actions">
          <button type="button" onClick={nextTurn}>
            推进回合
          </button>
          <button type="button" className="secondary" onClick={resetGame}>
            重开
          </button>
        </div>
      </section>

      <section className="dashboard">
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
                <span className="world-chip terrain">{terrainLabel[environment.terrain]}</span>
              </div>
            </div>

            <div className="hud-secondary-group">
              {secondaryStats.map((key) => (
                <StatusEmblem key={key} statKey={key} value={player[key]} compact />
              ))}
            </div>
          </div>
        </div>

        <div className="panel environment-panel">
          <div className="panel-title">生存提示</div>
          <div className="survival-notes">
            <SurvivalRule title="昼夜" text="夜晚会持续拉低理智与体力，生火与休息更关键。" />
            <SurvivalRule title="气候" text="雨天和风暴会压低体温，洞穴和火源更安全。" />
            <SurvivalRule title="联动" text="饥饿、缺水、低温都会反向吞掉生命值。" />
          </div>
        </div>
      </section>

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

      <section className="panel">
        <div className="panel-title">手牌</div>
        <div className="card-row">
          {hand.map((card) => {
            const disabled = !meetsCondition(player, environment, card.condition);
            return (
              <CardCanvas
                key={card.id}
                card={card}
                disabled={disabled}
                onClick={() => useCard(card.id)}
              />
            );
          })}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">日志</div>
        <div className="log-list">
          {logs.map((log) => (
            <div key={log.id} className="log-item">
              {log.text}
            </div>
          ))}
        </div>
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

import type { BackpackSlot, GameEnding, ItemDefinition, LogEntry } from '../types/game';

interface InfoSidebarProps {
  backpackWeight: number;
  backpackMaxWeight: number;
  selectedBackpackItem: ItemDefinition | null;
  selectedBackpackSlotData: BackpackSlot | null;
  selectedBackpackTotalWeight: number;
  activeEvent: boolean;
  ending: GameEnding | null;
  onUseBackpackItem: (slotIndex: number) => void;
  onDiscardBackpackItem: (slotIndex: number) => void;
  logs: LogEntry[];
  day: number;
}

export function InfoSidebar({
  backpackWeight,
  backpackMaxWeight,
  selectedBackpackItem,
  selectedBackpackSlotData,
  selectedBackpackTotalWeight,
  activeEvent,
  ending,
  onUseBackpackItem,
  onDiscardBackpackItem,
  logs,
  day,
}: InfoSidebarProps) {
  const slotFillPercent =
    selectedBackpackItem && selectedBackpackSlotData
      ? Math.round((selectedBackpackSlotData.amount / selectedBackpackItem.maxStack) * 100)
      : 0;

  return (
    <aside className="panel-info">
      {ending && (
        <div className="info-section ending-section">
          <div className="info-head">本局结算</div>
          <div className="ending-title">{ending.title}</div>
          <p className="ending-copy">{ending.description}</p>
          <div className="survivor-type-card">
            <div className="survivor-type-code">{ending.survivorType.code}</div>
            <div>
              <div className="survivor-type-label">{ending.survivorType.label}</div>
              <div className="survivor-type-tagline">{ending.survivorType.tagline}</div>
            </div>
          </div>
          <div className="survivor-traits">
            {ending.survivorType.traits.map((trait) => (
              <span key={trait} className="survivor-trait-chip">{trait}</span>
            ))}
          </div>
          <p className="survivor-type-summary">{ending.survivorType.summary}</p>
        </div>
      )}

      <div className="info-section">
        <div className="info-head">背包负重</div>
        <div className="carry-line">
          <span>{backpackWeight.toFixed(1)} kg</span>
          <span>/ {backpackMaxWeight.toFixed(1)} kg</span>
        </div>
        <div className="carry-track">
          <div
            className={`carry-fill ${backpackWeight > backpackMaxWeight ? 'over' : ''}`}
            style={{ width: `${Math.min((backpackWeight / backpackMaxWeight) * 100, 100)}%` }}
          />
        </div>
      </div>

      <div className="info-section">
        <div className="info-head">背包选中物品</div>
        {selectedBackpackItem && selectedBackpackSlotData ? (
          <div className="backpack-focus-card">
            <div className="focus-name">{selectedBackpackItem.name}</div>
            <p>{selectedBackpackItem.description}</p>
            <div className="focus-icon">{selectedBackpackItem.icon}</div>
            <div className="focus-meta">
              <span>堆叠 {slotFillPercent}%</span>
              <span>重量 {selectedBackpackTotalWeight.toFixed(2)} kg</span>
            </div>
            <div className="paper-actions">
              <button
                type="button"
                className="btn-paper"
                disabled={activeEvent || !!ending || !selectedBackpackItem.effect}
                onClick={() => onUseBackpackItem(selectedBackpackSlotData.slotIndex)}
              >
                使用
              </button>
              <button
                type="button"
                className="btn-paper secondary-ink"
                disabled={!!ending}
                onClick={() => onDiscardBackpackItem(selectedBackpackSlotData.slotIndex)}
              >
                丢弃
              </button>
            </div>
          </div>
        ) : (
          <div className="info-empty">先在背包里选中一张物品卡，再决定使用或丢弃。</div>
        )}
      </div>

      <div className="info-section">
        <div className="info-head">最近记录</div>
        <div className="log-stack">
          {logs.slice(0, 4).map((log, index) => (
            <div key={log.id} className={`log-entry ${index === 0 ? 'fresh' : ''}`}>
              <span className="log-day">D{day}</span>
              {log.text}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

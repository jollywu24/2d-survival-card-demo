import type { LogEntry, ItemDefinition, BackpackSlot } from '../types/game';

interface InfoSidebarProps {
  backpackWeight: number;
  backpackMaxWeight: number;
  selectedBackpackItem: ItemDefinition | null;
  selectedBackpackSlotData: BackpackSlot | null;
  selectedBackpackTotalWeight: number;
  activeEvent: boolean;
  ending: boolean;
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
  return (
    <aside className="panel-info">
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
              <span>✶ {Math.round((selectedBackpackSlotData.amount / selectedBackpackItem.maxStack) * 100)}%</span>
              <span>⚖ {selectedBackpackTotalWeight.toFixed(2)} 公斤</span>
            </div>
            <div className="paper-actions">
              <button
                type="button"
                className="btn-paper"
                disabled={activeEvent || ending || !selectedBackpackItem.effect}
                onClick={() => onUseBackpackItem(selectedBackpackSlotData.slotIndex)}
              >
                使用
              </button>
              <button
                type="button"
                className="btn-paper secondary-ink"
                onClick={() => onDiscardBackpackItem(selectedBackpackSlotData.slotIndex)}
              >
                丢弃
              </button>
            </div>
          </div>
        ) : (
          <div className="info-empty">先在背包中选择一张卡。</div>
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

import { useEffect, useRef } from 'react';
import type { CardDefinition } from '../types/game';

interface CardCanvasProps {
  card: CardDefinition;
  disabled?: boolean;
  onClick?: () => void;
}

const typeColor = {
  action: '#7a5c2e',
  resource: '#3d6b38',
  recipe: '#2e4d7a',
  event: '#7a2e2e',
  skill: '#6b4a8b',
};

const typeLabel = {
  action: '行动',
  resource: '资源',
  recipe: '配方',
  event: '事件',
  skill: '技能',
};

const artGlyph = {
  action: '行',
  resource: '物',
  recipe: '式',
  event: '危',
  skill: '悟',
};

export function CardCanvas({ card, disabled = false, onClick }: CardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);

    const parchment = context.createLinearGradient(0, 0, 0, height);
    parchment.addColorStop(0, disabled ? '#b0a590' : '#eadcba');
    parchment.addColorStop(0.45, disabled ? '#a59783' : '#dbc89a');
    parchment.addColorStop(1, disabled ? '#998a78' : '#c8b184');

    context.fillStyle = parchment;
    roundRect(context, 3, 3, width - 6, height - 6, 12, true, false);

    context.fillStyle = typeColor[card.type];
    context.fillRect(8, 8, width - 16, 6);

    context.strokeStyle = disabled ? '#8e8474' : '#5d492c';
    context.lineWidth = 2;
    roundRect(context, 4, 4, width - 8, height - 8, 12, false, true);

    context.save();
    context.globalAlpha = 0.08;
    for (let y = 0; y < height; y += 6) {
      context.fillStyle = y % 12 === 0 ? '#6f5527' : '#3f2c12';
      context.fillRect(8, y, width - 16, 1);
    }
    context.restore();

    context.fillStyle = 'rgba(26, 18, 8, 0.7)';
    context.font = '600 11px "Noto Serif SC", serif';
    context.fillText(typeLabel[card.type], 16, 31);

    context.fillStyle = disabled ? '#5a5349' : '#20160d';
    context.font = '700 18px "Noto Serif SC", serif';
    wrapText(context, card.name, 16, 57, width - 32, 22, 2);

    context.fillStyle = disabled ? '#685f53' : '#4d3a22';
    context.font = '400 12px "Noto Serif SC", serif';
    wrapText(context, card.description, 16, 118, width - 32, 18, 5);

    context.fillStyle = 'rgba(34, 22, 10, 0.08)';
    context.fillRect(16, height - 54, width - 32, 1);

    context.fillStyle = disabled ? '#6c655d' : typeColor[card.type];
    context.font = '700 24px "Crimson Pro", serif';
    context.fillText(artGlyph[card.type], width - 36, 42);

    context.fillStyle = disabled ? '#5d5449' : '#352617';
    context.font = '600 11px "Noto Serif SC", serif';
    context.fillText(card.actionCost ? `精力 ${card.actionCost}` : '无消耗', 16, height - 26);

    context.fillStyle = disabled ? '#6c6257' : '#5c4726';
    context.font = '400 10px "Noto Serif SC", serif';
    context.fillText('湿痕纸页 · 荒野笔记', width - 92, height - 26);

    context.fillStyle = 'rgba(92, 71, 38, 0.22)';
    context.beginPath();
    context.moveTo(width - 22, height - 8);
    context.lineTo(width - 8, height - 22);
    context.lineTo(width - 8, height - 8);
    context.closePath();
    context.fill();
  }, [card, disabled]);

  return (
    <button className="card-button" type="button" onClick={onClick} disabled={disabled}>
      <canvas ref={canvasRef} width={220} height={320} />
    </button>
  );
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: boolean,
  stroke: boolean,
) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();

  if (fill) {
    context.fill();
  }
  if (stroke) {
    context.stroke();
  }
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxRows: number,
) {
  const chars = text.split('');
  let line = '';
  let row = 0;

  chars.forEach((char) => {
    if (row >= maxRows) {
      return;
    }

    const testLine = line + char;
    const metrics = context.measureText(testLine);

    if (metrics.width > maxWidth && line) {
      context.fillText(line, x, y + row * lineHeight);
      line = char;
      row += 1;
      return;
    }

    line = testLine;
  });

  if (row < maxRows && line) {
    context.fillText(line, x, y + row * lineHeight);
  }
}

import { useEffect, useRef } from 'react';
import type { CardDefinition } from '../types/game';

interface CardCanvasProps {
  card: CardDefinition;
  disabled?: boolean;
  onClick?: () => void;
}

const typeColor = {
  resource: '#5bbf8a',
  action: '#f4b860',
  event: '#7ec8e3',
  tool: '#d98ef2',
};

export function CardCanvas({ card, disabled = false, onClick }: CardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);

    context.fillStyle = disabled ? '#8a8f98' : '#203442';
    context.strokeStyle = disabled ? '#b4b8bf' : typeColor[card.type];
    context.lineWidth = 4;

    context.beginPath();
    context.roundRect(6, 6, canvas.width - 12, canvas.height - 12, 16);
    context.fill();
    context.stroke();

    context.fillStyle = typeColor[card.type];
    context.font = 'bold 14px sans-serif';
    context.fillText(card.type.toUpperCase(), 18, 30);

    context.fillStyle = '#f6f2e9';
    context.font = 'bold 20px sans-serif';
    context.fillText(card.name, 18, 62);

    context.fillStyle = '#d6dde2';
    context.font = '13px sans-serif';

    wrapText(context, card.description, 18, 92, canvas.width - 36, 20);
  }, [card, disabled]);

  return (
    <button className="card-button" type="button" onClick={onClick} disabled={disabled}>
      <canvas ref={canvasRef} width={220} height={300} />
    </button>
  );
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const chars = text.split('');
  let line = '';
  let row = 0;

  chars.forEach((char) => {
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

  if (line) {
    context.fillText(line, x, y + row * lineHeight);
  }
}

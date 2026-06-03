import { useRef, useCallback } from 'react';
import { DragonPhoenixGame } from '@/lib/game-engine';

const GRID_UNIT = 50;
const CENTER = 250;
const PIECE_RADIUS = 16;

function gridToSvg(x: number, y: number) {
  return { x: CENTER + x * GRID_UNIT, y: CENTER - y * GRID_UNIT };
}

interface ChessBoardProps {
  game: DragonPhoenixGame;
  onNodeClick: (nodeId: string) => void;
  flashLines: string[];
  eatableNodes: string[];
}

export function ChessBoard({ game, onNodeClick, flashLines, eatableNodes }: ChessBoardProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Find nearest node
    let nearest: string | null = null;
    let minDist = Infinity;
    for (const nid of game.getAllNodeIds()) {
      const [gx, gy] = nid.split(',').map(Number);
      const pos = gridToSvg(gx, gy);
      const dx = pos.x - clickX;
      const dy = pos.y - clickY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist < GRID_UNIT * 0.6) {
        minDist = dist;
        nearest = nid;
      }
    }
    if (nearest) onNodeClick(nearest);
  }, [game, onNodeClick]);

  const lines = game.getBoardLines();
  const pieces = game.getPieces();
  const selected = game.getSelectedPiece();
  const validMoves = selected ? game.getValidMoves(selected) : [];

  // Build flash line set
  const flashSet = new Set<string>();
  for (const lineKey of flashLines) {
    const nodes = lineKey.split('|');
    for (let i = 0; i < nodes.length - 1; i++) {
      flashSet.add(`${nodes[i]}->${nodes[i + 1]}`);
      flashSet.add(`${nodes[i + 1]}->${nodes[i]}`);
    }
  }

  return (
    <svg
      id="chess-board-svg"
      ref={svgRef}
      viewBox="0 0 500 500"
      className="w-[500px] h-[500px] cursor-pointer"
      onClick={handleSvgClick}
      style={{ filter: 'drop-shadow(0 0 8px rgba(212,168,83,0.3))' }}
    >
      <defs>
        {/* Glow filter for lines */}
        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Piece glow */}
        <filter id="pieceGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Red piece gradient */}
        <radialGradient id="redGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ff6b6b" />
          <stop offset="50%" stopColor="#e63946" />
          <stop offset="100%" stopColor="#8b0000" />
        </radialGradient>
        {/* Blue piece gradient */}
        <radialGradient id="blueGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#74c0fc" />
          <stop offset="50%" stopColor="#2980b9" />
          <stop offset="100%" stopColor="#003366" />
        </radialGradient>
        {/* Selection pulse animation */}
        <radialGradient id="selectPulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(212,168,83,0)" />
          <stop offset="70%" stopColor="rgba(212,168,83,0.3)" />
          <stop offset="100%" stopColor="rgba(212,168,83,0)" />
        </radialGradient>
      </defs>

      {/* Board lines */}
      {lines.map((line, i) => {
        const from = gridToSvg(...line.from.split(',').map(Number) as [number, number]);
        const to = gridToSvg(...line.to.split(',').map(Number) as [number, number]);
        const isFlash = flashSet.has(`${line.from}->${line.to}`);
        return (
          <line
            key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={isFlash ? '#ffd700' : '#d4a853'}
            strokeWidth={isFlash ? 3 : 1.5}
            opacity={isFlash ? 1 : 0.6}
            filter={isFlash ? 'url(#lineGlow)' : undefined}
            style={isFlash ? { animation: 'flashPulse 1s ease-in-out' } : undefined}
          />
        );
      })}

      {/* Valid move indicators */}
      {validMoves.map(nid => {
        const [gx, gy] = nid.split(',').map(Number);
        const pos = gridToSvg(gx, gy);
        return (
          <circle
            key={`vm-${nid}`}
            cx={pos.x} cy={pos.y} r={6}
            fill="none" stroke="#00ff88" strokeWidth={2}
            opacity={0.8}
          >
            <animate attributeName="r" values="4;8;4" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Eatable indicators */}
      {eatableNodes.map(nid => {
        const [gx, gy] = nid.split(',').map(Number);
        const pos = gridToSvg(gx, gy);
        return (
          <circle
            key={`eat-${nid}`}
            cx={pos.x} cy={pos.y} r={PIECE_RADIUS + 4}
            fill="none" stroke="#ff4444" strokeWidth={2}
            strokeDasharray="4 2"
            opacity={0.9}
          >
            <animate attributeName="stroke-dashoffset" values="0;12" dur="0.5s" repeatCount="indefinite" />
          </circle>
        );
      })}

      {/* Selection indicator */}
      {selected && (() => {
        const [gx, gy] = selected.split(',').map(Number);
        const pos = gridToSvg(gx, gy);
        return (
          <circle
            cx={pos.x} cy={pos.y} r={PIECE_RADIUS + 8}
            fill="url(#selectPulse)"
          >
            <animate attributeName="r" values={`${PIECE_RADIUS + 6};${PIECE_RADIUS + 12};${PIECE_RADIUS + 6}`} dur="1.2s" repeatCount="indefinite" />
          </circle>
        );
      })()}

      {/* Pieces */}
      {pieces.map(({ nodeId, color }) => {
        const [gx, gy] = nodeId.split(',').map(Number);
        const pos = gridToSvg(gx, gy);
        const isSelected = selected === nodeId;
        return (
          <g key={nodeId}>
            {/* Outer glow */}
            <circle
              cx={pos.x} cy={pos.y} r={PIECE_RADIUS + 2}
              fill={color === 'red' ? 'rgba(230,57,70,0.3)' : 'rgba(41,128,185,0.3)'}
              filter="url(#pieceGlow)"
            />
            {/* Main piece */}
            <circle
              cx={pos.x} cy={pos.y} r={PIECE_RADIUS}
              fill={color === 'red' ? 'url(#redGrad)' : 'url(#blueGrad)'}
              stroke={isSelected ? '#ffd700' : 'rgba(255,255,255,0.3)'}
              strokeWidth={isSelected ? 3 : 1}
            />
            {/* Specular highlight */}
            <ellipse
              cx={pos.x - 4} cy={pos.y - 5} rx={5} ry={3}
              fill="rgba(255,255,255,0.4)"
            />
          </g>
        );
      })}

      <style>{`
        @keyframes flashPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </svg>
  );
}

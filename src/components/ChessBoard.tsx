import { useRef, useCallback } from 'react';
import { DragonPhoenixGame } from '@/lib/game-engine';

const GRID_UNIT = 70;
const CENTER = 350;
const PIECE_RADIUS = 20;
const NODE_DOT_RADIUS = 5;

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

    // 将屏幕坐标转换为SVG内部坐标
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    // 找最近的节点
    let nearest: string | null = null;
    let minDist = Infinity;
    const snapRadius = GRID_UNIT * 0.45; // 节点间距的45%以内算有效点击

    for (const nid of game.getAllNodeIds()) {
      const [gx, gy] = nid.split(',').map(Number);
      const pos = gridToSvg(gx, gy);
      const dx = pos.x - svgPt.x;
      const dy = pos.y - svgPt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist && dist < snapRadius) {
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
  const allNodes = game.getAllNodeIds();

  // 构建已有棋子的集合
  const occupiedSet = new Set(pieces.map(p => p.nodeId));

  // 构建成线闪烁集合
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
      viewBox="0 0 700 700"
      className="w-full max-w-[600px] aspect-square cursor-pointer"
      onClick={handleSvgClick}
      style={{ filter: 'drop-shadow(0 0 12px rgba(212,168,83,0.3))' }}
    >
      <defs>
        {/* 线条发光 */}
        <filter id="lineGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* 棋子发光 */}
        <filter id="pieceGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* 粉色棋子渐变 */}
        <radialGradient id="pinkGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffb6c1" />
          <stop offset="50%" stopColor="#ff69b4" />
          <stop offset="100%" stopColor="#c71585" />
        </radialGradient>
        {/* 蓝色棋子渐变 */}
        <radialGradient id="blueGrad" cx="35%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#74c0fc" />
          <stop offset="50%" stopColor="#2980b9" />
          <stop offset="100%" stopColor="#003366" />
        </radialGradient>
        {/* 选中脉冲 */}
        <radialGradient id="selectPulse" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(212,168,83,0)" />
          <stop offset="70%" stopColor="rgba(212,168,83,0.3)" />
          <stop offset="100%" stopColor="rgba(212,168,83,0)" />
        </radialGradient>
      </defs>

      {/* 棋盘线条 */}
      {lines.map((line, i) => {
        const from = gridToSvg(...line.from.split(',').map(Number) as [number, number]);
        const to = gridToSvg(...line.to.split(',').map(Number) as [number, number]);
        const isFlash = flashSet.has(`${line.from}->${line.to}`);
        return (
          <line
            key={`line-${i}`}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke={isFlash ? '#ffd700' : '#d4a853'}
            strokeWidth={isFlash ? 3 : 1.5}
            opacity={isFlash ? 1 : 0.5}
            filter={isFlash ? 'url(#lineGlow)' : undefined}
            style={isFlash ? { animation: 'flashPulse 1s ease-in-out' } : undefined}
          />
        );
      })}

      {/* 节点指示器 - 空位显示小圆点 */}
      {allNodes.map(nid => {
        if (occupiedSet.has(nid)) return null;
        const [gx, gy] = nid.split(',').map(Number);
        const pos = gridToSvg(gx, gy);
        const isValidMove = validMoves.includes(nid);
        const isEatable = eatableNodes.includes(nid);

        if (isValidMove) {
          // 可移动位置 - 绿色脉冲
          return (
            <circle
              key={`node-${nid}`}
              cx={pos.x} cy={pos.y} r={8}
              fill="none" stroke="#00ff88" strokeWidth={2.5}
              opacity={0.9}
            >
              <animate attributeName="r" values="6;10;6" dur="1.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />
            </circle>
          );
        }

        if (isEatable) {
          // 可吃子位置 - 红色虚线
          return (
            <circle
              key={`node-${nid}`}
              cx={pos.x} cy={pos.y} r={PIECE_RADIUS + 5}
              fill="none" stroke="#ff4444" strokeWidth={2.5}
              strokeDasharray="5 3"
              opacity={0.9}
            >
              <animate attributeName="stroke-dashoffset" values="0;16" dur="0.6s" repeatCount="indefinite" />
            </circle>
          );
        }

        // 普通空位 - 小金色圆点
        return (
          <circle
            key={`node-${nid}`}
            cx={pos.x} cy={pos.y} r={NODE_DOT_RADIUS}
            fill="#d4a853"
            opacity={0.4}
          />
        );
      })}

      {/* 选中指示器 */}
      {selected && (() => {
        const [gx, gy] = selected.split(',').map(Number);
        const pos = gridToSvg(gx, gy);
        return (
          <circle
            cx={pos.x} cy={pos.y} r={PIECE_RADIUS + 10}
            fill="url(#selectPulse)"
          >
            <animate attributeName="r" values={`${PIECE_RADIUS + 8};${PIECE_RADIUS + 14};${PIECE_RADIUS + 8}`} dur="1.2s" repeatCount="indefinite" />
          </circle>
        );
      })()}

      {/* 棋子 */}
      {pieces.map(({ nodeId, color }) => {
        const [gx, gy] = nodeId.split(',').map(Number);
        const pos = gridToSvg(gx, gy);
        const isSelected = selected === nodeId;
        const isEatable = eatableNodes.includes(nodeId);
        return (
          <g key={`piece-${nodeId}`}>
            {/* 外发光 */}
            <circle
              cx={pos.x} cy={pos.y} r={PIECE_RADIUS + 3}
              fill={color === 'red' ? 'rgba(255,105,180,0.3)' : 'rgba(41,128,185,0.3)'}
              filter="url(#pieceGlow)"
            />
            {/* 主体 */}
            <circle
              cx={pos.x} cy={pos.y} r={PIECE_RADIUS}
              fill={color === 'red' ? 'url(#pinkGrad)' : 'url(#blueGrad)'}
              stroke={isSelected ? '#ffd700' : isEatable ? '#ff4444' : 'rgba(255,255,255,0.3)'}
              strokeWidth={isSelected ? 3 : isEatable ? 2.5 : 1}
              strokeDasharray={isEatable ? '4 2' : undefined}
            />
            {/* 高光 */}
            <ellipse
              cx={pos.x - 5} cy={pos.y - 6} rx={6} ry={3.5}
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

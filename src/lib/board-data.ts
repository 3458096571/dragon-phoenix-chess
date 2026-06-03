export type PlayerColor = 'red' | 'blue';

function ringNodes(ring: number): string[] {
  return [
    `${ring},${ring}`, `${-ring},${ring}`, `${-ring},${-ring}`, `${ring},${-ring}`,
    `0,${ring}`, `0,${-ring}`, `${-ring},0`, `${ring},0`,
  ];
}

export const DRAGON_NODES: string[] = [
  ...ringNodes(1), ...ringNodes(2), ...ringNodes(3),
];

export const PHOENIX_NODES: string[] = [
  ...DRAGON_NODES, ...ringNodes(4),
];

function ringEdges(ring: number): [string, string][] {
  const c = [`${ring},${ring}`, `${-ring},${ring}`, `${-ring},${-ring}`, `${ring},${-ring}`];
  const m = [`0,${ring}`, `${-ring},0`, `0,${-ring}`, `${ring},0`];
  const e: [string, string][] = [];
  for (let i = 0; i < 4; i++) {
    e.push([c[i], m[i]], [m[i], c[(i + 1) % 4]]);
  }
  return e;
}

function axialEdges(rings: number[]): [string, string][] {
  const axes = [
    rings.map(r => `0,${r}`), rings.map(r => `0,${-r}`),
    rings.map(r => `${-r},0`), rings.map(r => `${r},0`),
  ];
  const e: [string, string][] = [];
  for (const axis of axes) {
    for (let i = 0; i < axis.length - 1; i++) e.push([axis[i], axis[i + 1]]);
  }
  return e;
}

export const DRAGON_EDGES: [string, string][] = [
  ...ringEdges(1), ...ringEdges(2), ...ringEdges(3),
  ...axialEdges([1, 2, 3]),
];

export const DRAGON_LINES: string[][] = [
  ['1,1','0,1','-1,1'], ['-1,1','-1,0','-1,-1'], ['-1,-1','0,-1','1,-1'], ['1,-1','1,0','1,1'],
  ['2,2','0,2','-2,2'], ['-2,2','-2,0','-2,-2'], ['-2,-2','0,-2','2,-2'], ['2,-2','2,0','2,2'],
  ['3,3','0,3','-3,3'], ['-3,3','-3,0','-3,-3'], ['-3,-3','0,-3','3,-3'], ['3,-3','3,0','3,3'],
  ['0,1','0,2','0,3'], ['0,-1','0,-2','0,-3'], ['-1,0','-2,0','-3,0'], ['1,0','2,0','3,0'],
];

export const PHOENIX_EDGES: [string, string][] = [
  ...DRAGON_EDGES, ...ringEdges(4),
  ['0,3','0,4'], ['0,-3','0,-4'], ['-3,0','-4,0'], ['3,0','4,0'],
  ['1,1','2,2'], ['2,2','3,3'], ['3,3','4,4'],
  ['-1,1','-2,2'], ['-2,2','-3,3'], ['-3,3','-4,4'],
  ['-1,-1','-2,-2'], ['-2,-2','-3,-3'], ['-3,-3','-4,-4'],
  ['1,-1','2,-2'], ['2,-2','3,-3'], ['3,-3','4,-4'],
];

// 辅助函数：从节点集合生成所有"连续相邻"的三子直线
// 三个节点必须在同一条几何直线上，且是等间距连续排列（中间无其他节点）
function generateAdjacentLines(nodes: string[]): string[][] {
  const nodeSet = new Set(nodes);
  const lines: string[][] = [];
  const lineKeys = new Set<string>();

  function addLine(a: string, b: string, c: string) {
    if (!nodeSet.has(a) || !nodeSet.has(b) || !nodeSet.has(c)) return;
    const key = [a, b, c].sort().join('|');
    if (lineKeys.has(key)) return;
    lineKeys.add(key);
    lines.push([a, b, c]);
  }

  // 对于每个节点，作为中间点，向4个方向找等间距连续的两个邻居
  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1],
  ];

  for (const nid of nodes) {
    const [cx, cy] = nid.split(',').map(Number);
    for (const [dx, dy] of directions) {
      // 收集该直线上所有节点（包括正反两个方向），按坐标排序
      const collinear: { x: number; y: number; node: string }[] = [];
      for (const other of nodes) {
        if (other === nid) continue;
        const [ox, oy] = other.split(',').map(Number);
        const px = ox - cx, py = oy - cy;
        // 检查是否在同一条直线上（方向向量叉积为0）
        if (px * dy === py * dx) {
          collinear.push({ x: ox, y: oy, node: other });
        }
      }
      // 加入当前节点，按在该方向上的投影排序
      collinear.push({ x: cx, y: cy, node: nid });
      collinear.sort((a, b) => {
        // 按方向向量投影排序
        const projA = a.x * dx + a.y * dy;
        const projB = b.x * dx + b.y * dy;
        return projA - projB;
      });

      // 找连续等间距的三元组
      for (let i = 0; i < collinear.length - 2; i++) {
        const a = collinear[i];
        const b = collinear[i + 1];
        const c = collinear[i + 2];
        // 检查是否等间距：b - a === c - b
        const stepX1 = b.x - a.x;
        const stepY1 = b.y - a.y;
        const stepX2 = c.x - b.x;
        const stepY2 = c.y - b.y;
        if (stepX1 === stepX2 && stepY1 === stepY2) {
          addLine(a.node, b.node, c.node);
        }
      }
    }
  }

  return lines;
}

// 辅助函数：从节点集合生成所有"连续相邻"的四子直线
function generateAdjacentFourLines(nodes: string[]): string[][] {
  const nodeSet = new Set(nodes);
  const lines: string[][] = [];
  const lineKeys = new Set<string>();

  function addLine(a: string, b: string, c: string, d: string) {
    if (!nodeSet.has(a) || !nodeSet.has(b) || !nodeSet.has(c) || !nodeSet.has(d)) return;
    const key = [a, b, c, d].sort().join('|');
    if (lineKeys.has(key)) return;
    lineKeys.add(key);
    lines.push([a, b, c, d]);
  }

  const directions = [
    [1, 0], [0, 1], [1, 1], [1, -1],
  ];

  for (const nid of nodes) {
    const [cx, cy] = nid.split(',').map(Number);
    for (const [dx, dy] of directions) {
      // 收集该直线上所有节点，按方向投影排序
      const collinear: { x: number; y: number; node: string }[] = [];
      for (const other of nodes) {
        if (other === nid) continue;
        const [ox, oy] = other.split(',').map(Number);
        const px = ox - cx, py = oy - cy;
        if (px * dy === py * dx) {
          collinear.push({ x: ox, y: oy, node: other });
        }
      }
      collinear.push({ x: cx, y: cy, node: nid });
      collinear.sort((a, b) => (a.x * dx + a.y * dy) - (b.x * dx + b.y * dy));

      // 找连续等间距的四元组
      for (let i = 0; i < collinear.length - 3; i++) {
        const a = collinear[i];
        const b = collinear[i + 1];
        const c = collinear[i + 2];
        const d = collinear[i + 3];
        const stepX1 = b.x - a.x, stepY1 = b.y - a.y;
        const stepX2 = c.x - b.x, stepY2 = c.y - b.y;
        const stepX3 = d.x - c.x, stepY3 = d.y - c.y;
        if (stepX1 === stepX2 && stepY1 === stepY2 && stepX2 === stepX3 && stepY2 === stepY3) {
          addLine(a.node, b.node, c.node, d.node);
        }
      }
    }
  }

  return lines;
}

// 凤棋成龙线（三子成线）——自动生成所有相邻的三子直线
export const PHOENIX_DRAGON_LINES: string[][] = generateAdjacentLines(PHOENIX_NODES);

// 凤棋成凤线（四子成线）——自动生成所有相邻的四子直线
export const PHOENIX_LINES: string[][] = generateAdjacentFourLines(PHOENIX_NODES);

export function buildAdjacency(edges: [string, string][]): Record<string, string[]> {
  const adj: Record<string, string[]> = {};
  for (const [a, b] of edges) {
    if (!adj[a]) adj[a] = [];
    if (!adj[b]) adj[b] = [];
    if (!adj[a].includes(b)) adj[a].push(b);
    if (!adj[b].includes(a)) adj[b].push(a);
  }
  return adj;
}

export const DRAGON_ADJ = buildAdjacency(DRAGON_EDGES);
export const PHOENIX_ADJ = buildAdjacency(PHOENIX_EDGES);

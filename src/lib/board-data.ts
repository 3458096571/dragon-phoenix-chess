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

export const PHOENIX_LINES: string[][] = [
  ['0,1','0,2','0,3','0,4'], ['0,-1','0,-2','0,-3','0,-4'],
  ['-1,0','-2,0','-3,0','-4,0'], ['1,0','2,0','3,0','4,0'],
  ['1,1','2,2','3,3','4,4'], ['-1,1','-2,2','-3,3','-4,4'],
  ['-1,-1','-2,-2','-3,-3','-4,-4'], ['1,-1','2,-2','3,-3','4,-4'],
];

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

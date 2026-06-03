import {
  type PlayerColor,
  DRAGON_NODES, DRAGON_EDGES, DRAGON_LINES, DRAGON_ADJ,
  PHOENIX_NODES, PHOENIX_EDGES, PHOENIX_DRAGON_LINES, PHOENIX_LINES, PHOENIX_ADJ,
} from './board-data';

export type GameMode = 'dragon' | 'phoenix';
export type GamePhase = 'placing' | 'moving' | 'eating' | 'gameover';

export class DragonPhoenixGame {
  mode: GameMode;
  phase: GamePhase = 'placing';
  currentPlayer: PlayerColor = 'red';
  board: Map<string, PlayerColor | null> = new Map();
  nodes: string[] = [];
  edges: [string, string][] = [];
  dragonLines: string[][] = [];
  phoenixLines: string[][] = [];
  adj: Record<string, string[]> = {};
  redHand: number = 9;
  blueHand: number = 9;
  redOnBoard: number = 0;
  blueOnBoard: number = 0;
  selectedNode: string | null = null;
  eatCount: number = 0;
  eatMode: 'single' | 'double_first' | null = null;
  eatType: 'dragon' | 'phoenix' = 'dragon';
  eatFirstTarget: string | null = null;
  winner: PlayerColor | null = null;
  lastFormedDragons: string[] = [];
  lastFormedPhoenixes: string[] = [];

  constructor(mode: GameMode = 'dragon') {
    this.mode = mode;
    this.reset();
  }

  reset() {
    const isDragon = this.mode === 'dragon';
    this.nodes = isDragon ? [...DRAGON_NODES] : [...PHOENIX_NODES];
    this.edges = isDragon ? [...DRAGON_EDGES] : [...PHOENIX_EDGES];
    this.dragonLines = isDragon ? [...DRAGON_LINES] : [...PHOENIX_DRAGON_LINES];
    this.phoenixLines = isDragon ? [] : [...PHOENIX_LINES];
    this.adj = isDragon ? DRAGON_ADJ : PHOENIX_ADJ;
    this.phase = 'placing';
    this.currentPlayer = 'red';
    this.board = new Map();
    for (const nid of this.nodes) this.board.set(nid, null);
    this.redHand = isDragon ? 9 : 12;
    this.blueHand = isDragon ? 9 : 12;
    this.redOnBoard = 0;
    this.blueOnBoard = 0;
    this.selectedNode = null;
    this.eatCount = 0;
    this.eatMode = null;
    this.eatType = 'dragon';
    this.eatFirstTarget = null;
    this.winner = null;
    this.lastFormedDragons = [];
    this.lastFormedPhoenixes = [];
  }

  getAllNodeIds() { return this.nodes; }
  getCurrentPlayer() { return this.currentPlayer; }
  getSelectedPiece() { return this.selectedNode; }
  getPhase() { return this.phase; }
  getWinner() { return this.winner; }

  getBoardLines() {
    return this.edges.map(([a, b]) => ({ from: a, to: b }));
  }

  getPieces() {
    const pieces: { nodeId: string; color: PlayerColor }[] = [];
    for (const [nid, color] of this.board) {
      if (color) pieces.push({ nodeId: nid, color });
    }
    return pieces;
  }

  getHandCount(color: PlayerColor) {
    return color === 'red' ? this.redHand : this.blueHand;
  }

  getOnBoardCount(color: PlayerColor) {
    return color === 'red' ? this.redOnBoard : this.blueOnBoard;
  }

  getOpponent(player: PlayerColor): PlayerColor {
    return player === 'red' ? 'blue' : 'red';
  }

  getValidMoves(nodeId: string) {
    if (this.phase !== 'moving') return [];
    return (this.adj[nodeId] || []).filter(n => this.board.get(n) === null);
  }

  handleNodeClick(nodeId: string) {
    if (this.phase === 'gameover') return { type: 'error' as const, success: false, message: '游戏已结束' };
    if (this.phase === 'placing') return this.placePiece(nodeId);
    if (this.phase === 'moving') return this.handleMovingClick(nodeId);
    if (this.phase === 'eating') return this.handleEatingClick(nodeId);
    return { type: 'error' as const, success: false, message: '未知阶段' };
  }

  placePiece(nodeId: string) {
    if (!this.nodes.includes(nodeId)) return { type: 'error' as const, success: false, message: '无效位置' };
    if (this.board.get(nodeId) !== null) return { type: 'error' as const, success: false, message: '该位置已有棋子' };
    const player = this.currentPlayer;
    const handCount = player === 'red' ? this.redHand : this.blueHand;
    if (handCount <= 0) return { type: 'error' as const, success: false, message: '手中无子可落' };

    this.board.set(nodeId, player);
    if (player === 'red') { this.redHand--; this.redOnBoard++; }
    else { this.blueHand--; this.blueOnBoard++; }

    const prevDragonLines = this.getCompletedLines(this.dragonLines, player);
    const prevPhoenixLines = this.getCompletedLines(this.phoenixLines, player);

    const newDragons = this.checkNewFormations(nodeId, player, this.dragonLines, prevDragonLines);
    const newPhoenixes = this.checkNewFormations(nodeId, player, this.phoenixLines, prevPhoenixLines);
    this.lastFormedDragons = newDragons;
    this.lastFormedPhoenixes = newPhoenixes;

    const totalEats = newDragons.length + newPhoenixes.length;
    if (totalEats > 0) {
      this.eatCount = totalEats;
      this.phase = 'eating';
      this.eatType = newDragons.length > 0 ? 'dragon' : 'phoenix';
      this.eatMode = 'single';
      this.eatFirstTarget = null;
      if (!this.canEatAny(player, this.eatType)) this.skipEat();
      return { type: 'place' as const, success: true, newDragons, newPhoenixes, eatCount: totalEats, message: `${player === 'red' ? '粉方' : '蓝方'}落子，成龙×${newDragons.length}${newPhoenixes.length > 0 ? '，成凤×' + newPhoenixes.length : ''}`, gameOver: false };
    }

    this.endTurn();
    return { type: 'place' as const, success: true, newDragons: [], newPhoenixes: [], eatCount: 0, message: `${player === 'red' ? '粉方' : '蓝方'}落子`, gameOver: false };
  }

  handleMovingClick(nodeId: string) {
    const player = this.currentPlayer;
    if (this.selectedNode === null) {
      if (this.board.get(nodeId) !== player) return { type: 'error' as const, success: false, message: '请选择己方棋子' };
      if (this.getValidMoves(nodeId).length === 0) return { type: 'error' as const, success: false, message: '该棋子无法移动' };
      this.selectedNode = nodeId;
      return { type: 'select' as const, success: true, nodeId, message: '已选中棋子' };
    }
    if (nodeId === this.selectedNode) {
      this.selectedNode = null;
      return { type: 'deselect' as const, success: true, message: '取消选择' };
    }
    if (this.board.get(nodeId) === player) {
      if (this.getValidMoves(nodeId).length === 0) return { type: 'error' as const, success: false, message: '该棋子无法移动' };
      this.selectedNode = nodeId;
      return { type: 'select' as const, success: true, nodeId, message: '切换选择' };
    }
    const from = this.selectedNode;
    if (!(this.adj[from] || []).includes(nodeId)) return { type: 'error' as const, success: false, message: '只能移动到相邻空位' };
    if (this.board.get(nodeId) !== null) return { type: 'error' as const, success: false, message: '目标位置已有棋子' };

    this.board.set(from, null);
    this.board.set(nodeId, player);
    this.selectedNode = null;

    const prevDragonLines = this.getCompletedLines(this.dragonLines, player);
    const prevPhoenixLines = this.getCompletedLines(this.phoenixLines, player);

    const newDragons = this.checkNewFormations(nodeId, player, this.dragonLines, prevDragonLines);
    const newPhoenixes = this.checkNewFormations(nodeId, player, this.phoenixLines, prevPhoenixLines);
    this.lastFormedDragons = newDragons;
    this.lastFormedPhoenixes = newPhoenixes;

    const totalEats = newDragons.length + newPhoenixes.length;
    if (totalEats > 0) {
      this.eatCount = totalEats;
      this.phase = 'eating';
      this.eatType = newDragons.length > 0 ? 'dragon' : 'phoenix';
      this.eatMode = 'single';
      this.eatFirstTarget = null;
      if (!this.canEatAny(player, this.eatType)) this.skipEat();
      return { type: 'move' as const, success: true, from, to: nodeId, newDragons, newPhoenixes, eatCount: totalEats, message: `${player === 'red' ? '粉方' : '蓝方'}移动，成龙×${newDragons.length}${newPhoenixes.length > 0 ? '，成凤×' + newPhoenixes.length : ''}`, gameOver: false };
    }

    this.endTurn();
    return { type: 'move' as const, success: true, from, to: nodeId, newDragons: [], newPhoenixes: [], eatCount: 0, message: `${player === 'red' ? '粉方' : '蓝方'}移动`, gameOver: false };
  }

  handleEatingClick(nodeId: string) {
    const player = this.currentPlayer;
    const opponent = this.getOpponent(player);
    if (this.board.get(nodeId) === player) return { type: 'error' as const, success: false, message: '不能吃自己的棋子' };
    if (this.board.get(nodeId) === null) return { type: 'error' as const, success: false, message: '该位置没有棋子' };
    if (this.board.get(nodeId) !== opponent) return { type: 'error' as const, success: false, message: '只能吃对方棋子' };

    const protection = this.getProtectionLevel(nodeId);
    if (this.eatType === 'dragon') {
      if (protection !== 'normal') return { type: 'error' as const, success: false, message: '该棋子受保护，无法被成龙吃' };
      this.removePiece(nodeId);
      this.eatCount--;
      if (this.checkWinCondition()) return { type: 'eat' as const, success: true, nodeId, message: '吃子成功', gameOver: true, winner: this.winner };
      this.advanceEatPhase();
      return { type: 'eat' as const, success: true, nodeId, eatCount: this.eatCount, message: `吃掉对方棋子${this.eatCount > 0 ? '，还可吃' + this.eatCount + '次' : ''}`, gameOver: false };
    } else {
      if (this.eatMode === 'single') {
        if (protection === 'phoenix') return { type: 'error' as const, success: false, message: '凤子受保护，无法被吃' };
        if (protection === 'dragon') {
          this.removePiece(nodeId);
          this.eatCount--;
          if (this.checkWinCondition()) return { type: 'eat' as const, success: true, nodeId, message: '吃子成功', gameOver: true, winner: this.winner };
          this.advanceEatPhase();
          return { type: 'eat' as const, success: true, nodeId, eatCount: this.eatCount, message: `吃掉龙子${this.eatCount > 0 ? '，还可吃' + this.eatCount + '次' : ''}`, gameOver: false };
        }
        this.eatMode = 'double_first';
        this.eatFirstTarget = nodeId;
        return { type: 'eat_select' as const, success: true, nodeId, eatCount: this.eatCount, message: '已选第一个普通子，请再选一个普通子', gameOver: false };
      } else if (this.eatMode === 'double_first') {
        if (protection !== 'normal') return { type: 'error' as const, success: false, message: '成凤吃普通子只能选择普通子' };
        if (nodeId === this.eatFirstTarget) return { type: 'error' as const, success: false, message: '不能选同一个棋子' };
        this.removePiece(this.eatFirstTarget!);
        this.removePiece(nodeId);
        this.eatCount--;
        this.eatFirstTarget = null;
        if (this.checkWinCondition()) return { type: 'eat' as const, success: true, nodeId, message: '吃子成功', gameOver: true, winner: this.winner };
        this.advanceEatPhase();
        return { type: 'eat' as const, success: true, nodeId, eatCount: this.eatCount, message: `吃掉两个普通子${this.eatCount > 0 ? '，还可吃' + this.eatCount + '次' : ''}`, gameOver: false };
      }
    }
    return { type: 'error' as const, success: false, message: '无法吃子' };
  }

  getCompletedLines(lines: string[][], player: PlayerColor): Set<string> {
    const completed = new Set<string>();
    for (const line of lines) {
      if (line.every(nid => this.board.get(nid) === player)) completed.add(line.join('|'));
    }
    return completed;
  }

  checkNewFormations(nodeId: string, player: PlayerColor, lines: string[][], previousCompleted?: Set<string>) {
    const formed: string[] = [];
    for (const line of lines) {
      if (!line.includes(nodeId)) continue;
      const key = line.join('|');
      if (line.every(nid => this.board.get(nid) === player)) {
        if (!previousCompleted || !previousCompleted.has(key)) formed.push(key);
      }
    }
    return formed;
  }

  getProtectionLevel(nodeId: string): 'phoenix' | 'dragon' | 'normal' {
    const color = this.board.get(nodeId);
    if (!color) return 'normal';
    for (const line of this.phoenixLines) {
      if (!line.includes(nodeId)) continue;
      if (line.every(nid => this.board.get(nid) === color)) return 'phoenix';
    }
    for (const line of this.dragonLines) {
      if (!line.includes(nodeId)) continue;
      if (line.every(nid => this.board.get(nid) === color)) return 'dragon';
    }
    return 'normal';
  }

  getEatablePieces(player: PlayerColor, eatType: 'dragon' | 'phoenix') {
    const opponent = this.getOpponent(player);
    const eatable: string[] = [];
    for (const nid of this.nodes) {
      if (this.board.get(nid) !== opponent) continue;
      const p = this.getProtectionLevel(nid);
      if (eatType === 'dragon') { if (p === 'normal') eatable.push(nid); }
      else { if (p === 'normal' || p === 'dragon') eatable.push(nid); }
    }
    return eatable;
  }

  canEatAny(player: PlayerColor, eatType: 'dragon' | 'phoenix') {
    return this.getEatablePieces(player, eatType).length > 0;
  }

  removePiece(nodeId: string) {
    const color = this.board.get(nodeId);
    if (!color) return;
    this.board.set(nodeId, null);
    if (color === 'red') this.redOnBoard--; else this.blueOnBoard--;
  }

  endTurn() {
    this.selectedNode = null;
    this.eatCount = 0;
    this.eatMode = null;
    this.eatType = 'dragon';
    this.eatFirstTarget = null;
    this.currentPlayer = this.getOpponent(this.currentPlayer);
    if (this.redHand === 0 && this.blueHand === 0) this.phase = 'moving';
    else this.phase = 'placing';
  }

  advanceEatPhase() {
    if (this.eatCount <= 0) { this.endTurn(); return; }
    if (this.eatType === 'dragon') {
      if (this.lastFormedPhoenixes.length > 0) {
        this.eatType = 'phoenix'; this.eatMode = 'single'; this.eatFirstTarget = null;
        if (!this.canEatAny(this.currentPlayer, 'phoenix')) { this.eatCount--; this.advanceEatPhase(); return; }
      } else {
        this.eatMode = 'single'; this.eatFirstTarget = null;
        if (!this.canEatAny(this.currentPlayer, 'dragon')) { this.eatCount--; this.advanceEatPhase(); return; }
      }
    } else {
      this.eatMode = 'single'; this.eatFirstTarget = null;
      if (!this.canEatAny(this.currentPlayer, this.eatType)) {
        // Phoenix can't eat - check if there are dragon lines to eat
        if (this.eatType === 'phoenix' && this.lastFormedDragons.length > 0 && this.canEatAny(this.currentPlayer, 'dragon')) {
          this.eatType = 'dragon';
        } else {
          this.eatCount--;
          this.advanceEatPhase();
        }
      }
    }
  }

  skipEat() {
    this.eatCount--;
    if (this.eatCount > 0) this.advanceEatPhase();
    else this.endTurn();
  }

  checkWinCondition() {
    if (this.redOnBoard === 0 && this.redHand === 0) { this.winner = 'blue'; this.phase = 'gameover'; return true; }
    if (this.blueOnBoard === 0 && this.blueHand === 0) { this.winner = 'red'; this.phase = 'gameover'; return true; }
    return false;
  }

  getState() {
    const boardObj: Record<string, PlayerColor | null> = {};
    for (const [nid, color] of this.board) boardObj[nid] = color;
    return { mode: this.mode, phase: this.phase, currentPlayer: this.currentPlayer, board: boardObj, redHand: this.redHand, blueHand: this.blueHand, redOnBoard: this.redOnBoard, blueOnBoard: this.blueOnBoard, selectedNode: this.selectedNode, eatCount: this.eatCount, eatMode: this.eatMode, eatType: this.eatType, eatFirstTarget: this.eatFirstTarget, winner: this.winner, lastFormedDragons: this.lastFormedDragons, lastFormedPhoenixes: this.lastFormedPhoenixes };
  }

  loadState(state: ReturnType<typeof this.getState>) {
    this.mode = state.mode; this.phase = state.phase; this.currentPlayer = state.currentPlayer;
    this.board = new Map();
    for (const [nid, color] of Object.entries(state.board)) this.board.set(nid, color as PlayerColor | null);
    this.redHand = state.redHand; this.blueHand = state.blueHand;
    this.redOnBoard = state.redOnBoard; this.blueOnBoard = state.blueOnBoard;
    this.selectedNode = state.selectedNode; this.eatCount = state.eatCount;
    this.eatMode = state.eatMode; this.eatType = state.eatType;
    this.eatFirstTarget = state.eatFirstTarget; this.winner = state.winner;
    this.lastFormedDragons = state.lastFormedDragons || [];
    this.lastFormedPhoenixes = state.lastFormedPhoenixes || [];
    const isDragon = this.mode === 'dragon';
    this.nodes = isDragon ? [...DRAGON_NODES] : [...PHOENIX_NODES];
    this.edges = isDragon ? [...DRAGON_EDGES] : [...PHOENIX_EDGES];
    this.dragonLines = isDragon ? [...DRAGON_LINES] : [...PHOENIX_DRAGON_LINES];
    this.phoenixLines = isDragon ? [] : [...PHOENIX_LINES];
    this.adj = isDragon ? DRAGON_ADJ : PHOENIX_ADJ;
  }

  getStatusText() {
    const pName = this.currentPlayer === 'red' ? '粉方' : '蓝方';
    if (this.phase === 'gameover') return `${this.winner === 'red' ? '粉方' : '蓝方'}获胜！`;
    if (this.phase === 'eating') {
      let msg = `${pName} ${this.eatType === 'dragon' ? '成龙' : '成凤'}吃子（剩余${this.eatCount}次）`;
      if (this.eatMode === 'double_first') msg += ' - 请选择第二个普通子';
      return msg;
    }
    if (this.phase === 'moving' && this.selectedNode) return `${pName}移动 - 选择目标位置`;
    return `${pName}回合 - ${this.phase === 'placing' ? '落子' : '移动'}`;
  }
}

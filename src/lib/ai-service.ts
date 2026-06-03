import { DragonPhoenixGame } from './game-engine';

const API_BASE = 'https://freeapi.514179.xyz/v1';
const API_KEY = 'sk-cfw-v2-vwSdrljilUkF2biw.neHjWCX6kW7wTuXLUXirK_EItQ5w-oew7ljOfoQtoy59G2DPwJVCcBKPIK4I6kwphBYjbAjxgzCQGOYlUaloz2dggYgkhvvlmDcyUtSI-_ZOU3pVzzJV8RMq3kH5iYWA8yPecMOkHBlm8PuCqLvsKVUyPdA3s6mDWi_iQVnt3rg2L79sUmPqOMmPQrymX2qv6wP6CyW6726K4F0RAhJw-gOoNZn511BCeKrASDnvMkijtc-fc90ieA9vz619W8eHLMCiBJO_jM2M';
const MODEL = 'Kimi-k2.6';

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomValidMove(game: DragonPhoenixGame): { nodeId: string; toNodeId?: string } | null {
  const phase = game.getPhase();
  const player = game.getCurrentPlayer();

  if (phase === 'placing') {
    const empties = game.getAllNodeIds().filter((n) => game.board.get(n) === null);
    if (empties.length === 0) return null;
    return { nodeId: getRandomItem(empties) };
  }

  if (phase === 'moving') {
    const ownPieces = game.getAllNodeIds().filter((n) => game.board.get(n) === player);
    const movable = ownPieces.filter((n) => game.getValidMoves(n).length > 0);
    if (movable.length === 0) return null;
    const from = getRandomItem(movable);
    const targets = game.getValidMoves(from);
    if (targets.length === 0) return null;
    return { nodeId: from, toNodeId: getRandomItem(targets) };
  }

  if (phase === 'eating') {
    const eatable = game.getEatablePieces(player, game.eatType);
    if (eatable.length === 0) return null;

    // 成凤双吃模式：需要选两个普通子
    if (game.eatType === 'phoenix' && game.eatMode === 'double_first') {
      const normals = eatable.filter((n) => game.getProtectionLevel(n) === 'normal');
      if (normals.length >= 2) {
        const first = getRandomItem(normals);
        const second = getRandomItem(normals.filter((n) => n !== first));
        return { nodeId: first, toNodeId: second };
      }
      // 普通子不足2个， fallback 为单吃龙子
      const dragons = eatable.filter((n) => game.getProtectionLevel(n) === 'dragon');
      if (dragons.length > 0) {
        return { nodeId: getRandomItem(dragons) };
      }
      return { nodeId: getRandomItem(eatable) };
    }

    // 单吃模式（dragon 或 phoenix single）
    return { nodeId: getRandomItem(eatable) };
  }

  return null;
}

function buildPrompt(game: DragonPhoenixGame, difficulty: 'easy' | 'medium' | 'hard'): string {
  const state = game.getState();
  const player = state.currentPlayer;
  const opponent = player === 'red' ? 'blue' : 'red';
  const playerName = player === 'red' ? '粉方' : '蓝方';
  const opponentName = opponent === 'red' ? '粉方' : '蓝方';

  let boardStr = '';
  for (const nid of game.getAllNodeIds().sort()) {
    const color = state.board[nid];
    boardStr += `  ${nid}: ${color ? (color === 'red' ? '粉' : '蓝') : '空'}\n`;
  }

  let validMovesStr = '';
  let responseFormat = '';

  if (state.phase === 'placing') {
    const empties = game.getAllNodeIds().filter((n) => state.board[n] === null);
    validMovesStr = `可落子位置（空位）：${empties.join(', ')}`;
    responseFormat = '{"nodeId": "x,y"}';
  } else if (state.phase === 'moving') {
    const ownPieces = game.getAllNodeIds().filter((n) => state.board[n] === player);
    const lines: string[] = [];
    for (const from of ownPieces) {
      const targets = game.getValidMoves(from);
      if (targets.length > 0) {
        lines.push(`  ${from} -> ${targets.join(', ')}`);
      }
    }
    validMovesStr = `可移动路线（先选棋子，再选目标位置）：\n${lines.join('\n')}`;
    responseFormat = '{"nodeId": "from_x,from_y", "toNodeId": "to_x,to_y"}';
  } else if (state.phase === 'eating') {
    const eatable = game.getEatablePieces(player, state.eatType!);
    if (state.eatType === 'phoenix' && state.eatMode === 'double_first') {
      const normals = eatable.filter((n) => game.getProtectionLevel(n) === 'normal');
      const dragons = eatable.filter((n) => game.getProtectionLevel(n) === 'dragon');
      validMovesStr = `成凤吃子模式：双吃（需选两个普通子）\n  普通子：${normals.join(', ')}\n  龙子（单吃备选）：${dragons.join(', ')}`;
      responseFormat = '{"nodeId": "first_x,first_y", "toNodeId": "second_x,second_y"}';
    } else if (state.eatType === 'phoenix' && state.eatMode === 'single') {
      const normals = eatable.filter((n) => game.getProtectionLevel(n) === 'normal');
      const dragons = eatable.filter((n) => game.getProtectionLevel(n) === 'dragon');
      validMovesStr = `成凤吃子模式：单吃（可选一个普通子进入双吃模式，或直接吃一个龙子）\n  普通子（选后进入双吃）：${normals.join(', ')}\n  龙子（直接吃掉）：${dragons.join(', ')}`;
      responseFormat = '{"nodeId": "x,y"}';
    } else {
      validMovesStr = `成龙吃子，可选目标：${eatable.join(', ')}`;
      responseFormat = '{"nodeId": "x,y"}';
    }
  }

  const difficultyDesc = {
    easy: '你是入门级AI，优先选择简单直观的走法，偶尔犯点小错也没关系。',
    medium: '你是中级AI，会认真思考局势，选择合理的走法，平衡攻防。',
    hard: '你是高级AI，必须深思熟虑，优先选择最优策略，尽量形成龙凤、阻止对方成线，并考虑长远布局。',
  };

  return `你正在玩"龙凤棋"，当前是${playerName}的回合。

游戏规则简介：
- 棋盘由多个节点和连线组成，分为"龙棋"（3环）和"凤棋"（4环）两种模式。
- 落子阶段：双方轮流在空位落子，手中棋子用完进入移动阶段。
- 移动阶段：每次沿连线移动一枚己方棋子到相邻空位。操作分两步：先选中一枚己方棋子，再点击相邻空位移动。
- 成龙：三枚己方棋子在一条直线上连成一线，可吃对方一个普通子。
- 成凤：四枚己方棋子在一条直线上连成一线，可吃对方两个普通子，或一个龙子。
- 被成龙保护的棋子（属于某条成龙线）不能被普通吃子吃掉；被成凤保护的棋子（属于某条成凤线）不能被成凤双吃吃掉。
- 当一方棋子（含手中）全部为零时，对方获胜。

当前局势：
- 模式：${state.mode === 'dragon' ? '龙棋' : '凤棋'}
- 阶段：${state.phase === 'placing' ? '落子阶段' : state.phase === 'moving' ? '移动阶段' : state.phase === 'eating' ? '吃子阶段' : '游戏结束'}
- 当前玩家：${playerName}
- ${playerName}手中剩余：${player === 'red' ? state.redHand : state.blueHand} 枚
- ${opponentName}手中剩余：${opponent === 'red' ? state.redHand : state.blueHand} 枚
- ${playerName}场上棋子数：${player === 'red' ? state.redOnBoard : state.blueOnBoard}
- ${opponentName}场上棋子数：${opponent === 'red' ? state.redOnBoard : state.blueOnBoard}

棋盘状态（节点 ->  occupant）：
${boardStr}

${validMovesStr}

${state.phase === 'eating' && state.eatCount > 0 ? `剩余吃子次数：${state.eatCount}` : ''}

${difficultyDesc[difficulty]}

请根据当前阶段，从上述合法走法中选择最优的一步，直接回复一个JSON对象，不要包含任何其他文字：

${responseFormat}
`;
}

function parseAIResponse(
  text: string,
  phase: string,
  eatType: 'dragon' | 'phoenix' | null,
  eatMode: 'single' | 'double_first' | null
): { nodeId: string; toNodeId?: string } | null {
  const cleaned = text.trim().replace(/^```json\s*|\s*```$/g, '');
  try {
    const obj = JSON.parse(cleaned);
    if (typeof obj.nodeId === 'string') {
      if (phase === 'moving' && typeof obj.toNodeId === 'string') {
        return { nodeId: obj.nodeId, toNodeId: obj.toNodeId };
      }
      if (phase === 'eating' && eatType === 'phoenix' && eatMode === 'double_first' && typeof obj.toNodeId === 'string') {
        return { nodeId: obj.nodeId, toNodeId: obj.toNodeId };
      }
      return { nodeId: obj.nodeId };
    }
  } catch {
    // fallback: try regex extract
    const match = cleaned.match(/"nodeId"\s*:\s*"([^"]+)"/);
    const toMatch = cleaned.match(/"toNodeId"\s*:\s*"([^"]+)"/);
    if (match) {
      const result: { nodeId: string; toNodeId?: string } = { nodeId: match[1] };
      if (toMatch) result.toNodeId = toMatch[1];
      return result;
    }
  }
  return null;
}

function isMoveValid(
  game: DragonPhoenixGame,
  move: { nodeId: string; toNodeId?: string }
): boolean {
  const phase = game.getPhase();
  const player = game.getCurrentPlayer();

  if (phase === 'placing') {
    return game.board.get(move.nodeId) === null && game.getAllNodeIds().includes(move.nodeId);
  }

  if (phase === 'moving') {
    if (!move.toNodeId) return false;
    if (game.board.get(move.nodeId) !== player) return false;
    return game.getValidMoves(move.nodeId).includes(move.toNodeId);
  }

  if (phase === 'eating') {
    const eatable = game.getEatablePieces(player, game.eatType);
    if (!eatable.includes(move.nodeId)) return false;

    if (game.eatType === 'phoenix' && game.eatMode === 'double_first' && move.toNodeId) {
      const normals = eatable.filter((n) => game.getProtectionLevel(n) === 'normal');
      return normals.includes(move.nodeId) && normals.includes(move.toNodeId) && move.nodeId !== move.toNodeId;
    }

    return true;
  }

  return false;
}

async function callChatCompletion(prompt: string, difficulty: 'easy' | 'medium' | 'hard'): Promise<string> {
  const response = await fetch(`${API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: '你是一个龙凤棋AI对手，只输出JSON格式的走法，不要有任何解释。' },
        { role: 'user', content: prompt },
      ],
      temperature: difficulty === 'easy' ? 0.9 : difficulty === 'medium' ? 0.7 : 0.3,
      max_tokens: 256,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`API 请求失败: ${response.status} ${response.statusText}${errorText ? ' - ' + errorText : ''}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function getAIMove(
  game: DragonPhoenixGame,
  difficulty: 'easy' | 'medium' | 'hard'
): Promise<{ nodeId: string; toNodeId?: string }> {
  const phase = game.getPhase();
  if (phase === 'gameover') {
    throw new Error('游戏已结束，无法获取AI走法');
  }

  const prompt = buildPrompt(game, difficulty);

  try {
    const text = await callChatCompletion(prompt, difficulty);
    const parsed = parseAIResponse(text, phase, game.eatType, game.eatMode);

    if (parsed && isMoveValid(game, parsed)) {
      return parsed;
    }
    console.warn('AI 返回的走法不合法，使用随机策略回退:', parsed, 'phase:', phase, 'eatType:', game.eatType, 'eatMode:', game.eatMode);
  } catch (err) {
    console.warn('AI API调用失败，使用随机策略回退:', err);
  }

  // fallback to random valid move
  const fallback = getRandomValidMove(game);
  if (!fallback) {
    throw new Error('当前无合法走法');
  }
  return fallback;
}

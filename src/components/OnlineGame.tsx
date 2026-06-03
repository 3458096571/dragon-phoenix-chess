import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useOnlineGame, type MoveData } from '@/hooks/useOnlineGame';
import { ChessBoard } from '@/components/ChessBoard';
import { DragonPhoenixGame } from '@/lib/game-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Globe,
  Swords,
  Bird,
  Copy,
  Check,
  Loader2,
  Send,
  X,
  MessageSquare,
  LogOut,
  Crown,
  User,
  CheckCircle2,
  Circle,
  AlertCircle,
} from 'lucide-react';
import type { GameMode } from '@/lib/supabase-types';

// ============================
// 在线对战主组件
// ============================

export default function OnlineGame() {
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [screen, setScreen] = useState<'lobby' | 'waiting' | 'game'>('lobby');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [flashLines, setFlashLines] = useState<string[]>([]);
  const [eatableNodes, setEatableNodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<DragonPhoenixGame | null>(null);

  const {
    room,
    gameState,
    messages,
    presence,
    isHost,
    playerColor,
    loading,
    error,
    createRoom,
    joinRoom,
    setReady,
    makeMove,
    sendChat,
    leaveRoom,
  } = useOnlineGame(playerName);

  // ============================
  // 本地游戏引擎（用于 ChessBoard 渲染）
  // ============================

  const localGame = useMemo(() => {
    if (!room || !gameState) return null;
    const g = new DragonPhoenixGame(room.mode);
    g.loadState({
      mode: room.mode,
      phase: gameState.phase,
      currentPlayer: gameState.current_player,
      board: gameState.board_state,
      redHand: gameState.red_hand,
      blueHand: gameState.blue_hand,
      redOnBoard: gameState.red_on_board,
      blueOnBoard: gameState.blue_on_board,
      selectedNode: null,
      eatCount: gameState.eat_count,
      eatMode: null,
      eatType: gameState.eat_type,
      eatFirstTarget: null,
      winner: gameState.winner,
      lastFormedDragons: [],
      lastFormedPhoenixes: [],
    });
    gameRef.current = g;
    return g;
  }, [room, gameState]);

  // ============================
  // 同步吃子提示和闪烁连线
  // ============================

  useEffect(() => {
    if (!localGame) {
      setEatableNodes([]);
      setFlashLines([]);
      return;
    }

    if (localGame.phase === 'eating') {
      const eatable = localGame.getEatablePieces(localGame.currentPlayer, localGame.eatType);
      setEatableNodes(eatable);
    } else {
      setEatableNodes([]);
    }
  }, [localGame]);

  // ============================
  // 聊天自动滚动
  // ============================

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ============================
  // 屏幕状态同步
  // ============================

  useEffect(() => {
    if (!room) {
      setScreen('lobby');
      return;
    }
    if (room.status === 'waiting') {
      setScreen('waiting');
    } else if (room.status === 'playing' || room.status === 'finished') {
      setScreen('game');
    }
  }, [room]);

  // ============================
  // 错误处理
  // ============================

  useEffect(() => {
    if (error) {
      setLocalError(error);
      const t = setTimeout(() => setLocalError(null), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  // ============================
  // 创建房间
  // ============================

  const handleCreateRoom = useCallback(
    async (mode: GameMode) => {
      if (!playerName.trim()) {
        setLocalError('请输入玩家昵称');
        return;
      }
      try {
        await createRoom(mode);
      } catch {
        // 错误已在 hook 中处理
      }
    },
    [playerName, createRoom]
  );

  // ============================
  // 加入房间
  // ============================

  const handleJoinRoom = useCallback(async () => {
    if (!playerName.trim()) {
      setLocalError('请输入玩家昵称');
      return;
    }
    if (!roomCodeInput.trim() || roomCodeInput.trim().length !== 6) {
      setLocalError('请输入6位房间号');
      return;
    }
    try {
      await joinRoom(roomCodeInput.trim(), playerName.trim());
    } catch {
      // 错误已在 hook 中处理
    }
  }, [playerName, roomCodeInput, joinRoom]);

  // ============================
  // 准备/取消准备
  // ============================

  const handleToggleReady = useCallback(async () => {
    if (!room) return;
    const currentReady = isHost ? room.host_ready : room.guest_ready;
    await setReady(!currentReady);
  }, [room, isHost, setReady]);

  // ============================
  // 棋盘点击处理
  // ============================

  const handleNodeClick = useCallback(
    async (nodeId: string) => {
      if (!room || !gameState || !localGame) return;
      if (gameState.phase === 'gameover') return;
      if (gameState.current_player !== playerColor) return;

      let moveData: MoveData | null = null;

      if (gameState.phase === 'placing') {
        moveData = { type: 'place', nodeId };
      } else if (gameState.phase === 'moving') {
        const selected = localGame.getSelectedPiece();
        if (!selected) {
          // 选择己方棋子（纯本地操作，不走网络）
          if (localGame.board.get(nodeId) === playerColor) {
            localGame.selectedNode = nodeId;
            // 强制刷新
            gameRef.current = new DragonPhoenixGame(localGame.mode);
            gameRef.current.loadState(localGame.getState());
          }
          return;
        }
        if (nodeId === selected) {
          // 取消选择（纯本地）
          localGame.selectedNode = null;
          gameRef.current = new DragonPhoenixGame(localGame.mode);
          gameRef.current.loadState(localGame.getState());
          return;
        }
        moveData = { type: 'move', from: selected, to: nodeId };
      } else if (gameState.phase === 'eating') {
        moveData = { type: 'eat', eatTarget: nodeId };
      }

      if (!moveData) return;

      try {
        await makeMove(moveData);
      } catch {
        // 走棋失败，保持本地选中状态
      }
    },
    [room, gameState, localGame, playerColor, makeMove]
  );

  // ============================
  // 发送聊天
  // ============================

  const handleSendChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    try {
      await sendChat(chatInput.trim());
      setChatInput('');
    } catch {
      // 错误已在 hook 中处理
    }
  }, [chatInput, sendChat]);

  // ============================
  // 离开房间
  // ============================

  const handleLeaveRoom = useCallback(async () => {
    await leaveRoom();
    setScreen('lobby');
    setChatOpen(false);
    setChatInput('');
    setFlashLines([]);
    setEatableNodes([]);
  }, [leaveRoom]);

  // ============================
  // 复制房间号
  // ============================

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // ============================
  // 获取对手信息
  // ============================

  const hostPresence = useMemo(() => {
    if (!room) return null;
    return presence.find((p) => p.player_id === room.host_id);
  }, [room, presence]);

  const guestPresence = useMemo(() => {
    if (!room || !room.guest_id) return null;
    return presence.find((p) => p.player_id === room.guest_id);
  }, [room, presence]);

  // ============================
  // 状态文字
  // ============================

  const statusText = useMemo(() => {
    if (!gameState) return '';
    const pName = gameState.current_player === 'red' ? '粉方' : '蓝方';
    if (gameState.phase === 'gameover') {
      return `${gameState.winner === 'red' ? '粉方' : '蓝方'}获胜！`;
    }
    if (gameState.phase === 'eating') {
      return `${pName} ${gameState.eat_type === 'dragon' ? '成龙' : '成凤'}吃子（剩余${gameState.eat_count}次）`;
    }
    return `${pName}回合 - ${gameState.phase === 'placing' ? '落子' : '移动'}`;
  }, [gameState]);

  const isMyTurn = gameState?.current_player === playerColor;
  const isGameOver = gameState?.phase === 'gameover';

  // ============================
  // 渲染：大厅
  // ============================

  if (screen === 'lobby') {
    return (
      <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden flex flex-col items-center justify-center px-4">
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-8">
            <h1
              className="text-5xl font-bold mb-2 tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #d4a853 0%, #f0d78c 50%, #d4a853 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              联机对战
            </h1>
            <p className="text-[#d4a853]/60 text-sm tracking-widest">ONLINE BATTLE</p>
          </div>

          {/* 昵称输入 */}
          <div className="mb-6">
            <label className="text-xs text-[#d4a853]/60 uppercase tracking-widest mb-2 block">
              玩家昵称
            </label>
            <Input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="输入你的昵称..."
              maxLength={12}
              className="h-12 bg-[#0f0f1a] border-[#d4a853]/30 text-white text-base placeholder:text-white/30 focus-visible:ring-[#d4a853]/50"
            />
          </div>

          {/* 创建房间 */}
          <div className="mb-4">
            <div className="text-xs text-[#d4a853]/50 uppercase tracking-widest mb-2">创建房间</div>
            <div className="flex gap-2">
              <Button
                onClick={() => handleCreateRoom('dragon')}
                disabled={loading}
                className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Swords className="w-4 h-4 mr-2 text-[#ff69b4]" />
                )}
                龙棋
              </Button>
              <Button
                onClick={() => handleCreateRoom('phoenix')}
                disabled={loading}
                className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Bird className="w-4 h-4 mr-2 text-[#00ff88]" />
                )}
                凤棋
              </Button>
            </div>
          </div>

          {/* 加入房间 */}
          <div className="mb-6">
            <div className="text-xs text-[#d4a853]/50 uppercase tracking-widest mb-2">加入房间</div>
            <div className="flex gap-2">
              <Input
                value={roomCodeInput}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setRoomCodeInput(v);
                }}
                placeholder="输入6位房间号"
                className="flex-1 h-12 bg-[#0f0f1a] border-[#d4a853]/30 text-white text-base placeholder:text-white/30 focus-visible:ring-[#d4a853]/50 tracking-widest text-center font-mono"
              />
              <Button
                onClick={handleJoinRoom}
                disabled={loading || roomCodeInput.length !== 6}
                className="h-12 px-5 bg-[#d4a853]/20 border border-[#d4a853]/40 hover:bg-[#d4a853]/30 text-[#d4a853] font-semibold"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* 错误提示 */}
          {localError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {localError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================
  // 渲染：等待房间
  // ============================

  if (screen === 'waiting' && room) {
    const hostReady = room.host_ready;
    const guestReady = room.guest_ready;
    const bothReady = hostReady && guestReady;
    const amReady = isHost ? hostReady : guestReady;

    return (
      <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden flex flex-col items-center justify-center px-4">
        <div className="relative z-10 w-full max-w-sm">
          <div className="text-center mb-8">
            <h1
              className="text-4xl font-bold mb-2 tracking-wider"
              style={{
                background: 'linear-gradient(135deg, #d4a853 0%, #f0d78c 50%, #d4a853 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              等待房间
            </h1>
            <p className="text-[#d4a853]/60 text-sm tracking-widest">WAITING ROOM</p>
          </div>

          {/* 房间号 */}
          <Card className="bg-[#0f0f1a]/80 border-[#d4a853]/20 mb-6 p-5">
            <div className="text-xs text-[#d4a853]/50 uppercase tracking-widest mb-2 text-center">
              房间号
            </div>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-mono font-bold tracking-[0.3em] text-[#d4a853]">
                {room.code}
              </span>
              <button
                onClick={() => handleCopyCode(room.code)}
                className="p-2 rounded-lg bg-[#d4a853]/10 hover:bg-[#d4a853]/20 transition-colors"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : (
                  <Copy className="w-5 h-5 text-[#d4a853]" />
                )}
              </button>
            </div>
            <p className="text-xs text-white/30 text-center mt-2">将房间号分享给好友即可加入</p>
          </Card>

          {/* 玩家列表 */}
          <Card className="bg-[#0f0f1a]/80 border-[#d4a853]/20 mb-6 p-5">
            <div className="text-xs text-[#d4a853]/50 uppercase tracking-widest mb-3">玩家</div>

            {/* 房主 */}
            <div className="flex items-center justify-between py-2.5 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#ff69b4]/20 flex items-center justify-center">
                  <Crown className="w-4 h-4 text-[#ff69b4]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {hostPresence?.player_name || '等待中...'}
                  </div>
                  <div className="text-xs text-[#ff69b4]">房主 · 粉方</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {hostReady ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">已准备</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4 text-white/30" />
                    <span className="text-xs text-white/30">未准备</span>
                  </>
                )}
              </div>
            </div>

            {/* 客人 */}
            <div className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#2980b9]/20 flex items-center justify-center">
                  <User className="w-4 h-4 text-[#74c0fc]" />
                </div>
                <div>
                  <div className="text-sm font-medium text-white">
                    {guestPresence?.player_name || '等待加入...'}
                  </div>
                  <div className="text-xs text-[#74c0fc]">访客 · 蓝方</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {guestReady ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    <span className="text-xs text-green-400">已准备</span>
                  </>
                ) : (
                  <>
                    <Circle className="w-4 h-4 text-white/30" />
                    <span className="text-xs text-white/30">未准备</span>
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* 操作按钮 */}
          <div className="space-y-3">
            <Button
              onClick={handleToggleReady}
              disabled={loading || bothReady}
              className={`w-full h-12 text-base font-semibold transition-all ${
                amReady
                  ? 'bg-green-500/20 border border-green-500/40 text-green-400 hover:bg-green-500/30'
                  : 'bg-[#d4a853]/20 border border-[#d4a853]/40 text-[#d4a853] hover:bg-[#d4a853]/30'
              }`}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {amReady ? '取消准备' : '准备就绪'}
            </Button>

            {bothReady && (
              <div className="text-center text-sm text-green-400 animate-pulse">
                双方已准备，游戏即将开始...
              </div>
            )}

            <Button
              onClick={handleLeaveRoom}
              variant="outline"
              className="w-full h-11 border-white/10 text-white/50 hover:text-white/70 hover:border-white/20"
            >
              <LogOut className="w-4 h-4 mr-2" />
              离开房间
            </Button>
          </div>

          {/* 错误提示 */}
          {localError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mt-4">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {localError}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================
  // 渲染：游戏画面
  // ============================

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden flex flex-col items-center h-screen py-3 px-2">
      {/* 顶部栏 */}
      <div className="w-full max-w-lg flex items-center justify-between mb-2 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLeaveRoom}
          className="text-[#d4a853]/70 hover:text-[#d4a853]"
        >
          <LogOut className="w-4 h-4 mr-1" /> 离开
        </Button>
        <div className="flex items-center gap-2 text-xs text-white/50">
          {room && (
            <span className="font-mono text-[#d4a853]/60">#{room.code}</span>
          )}
        </div>
      </div>

      {/* 状态栏 */}
      <Card className="w-full max-w-lg mb-2 bg-[#0f0f1a]/80 border-[#d4a853]/20 backdrop-blur-sm shrink-0">
        <div className="p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className={`w-3 h-3 rounded-full ${
                gameState?.current_player === 'red'
                  ? 'bg-[#ff69b4] shadow-[0_0_8px_#ff69b4]'
                  : 'bg-[#2980b9] shadow-[0_0_8px_#2980b9]'
              }`}
            />
            <span className="text-sm font-medium text-[#d4a853]">{statusText}</span>
            {!isMyTurn && !isGameOver && (
              <span className="text-xs text-white/40">等待对手...</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#ff69b4]" />
              {gameState?.red_hand}+{gameState?.red_on_board}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#2980b9]" />
              {gameState?.blue_hand}+{gameState?.blue_on_board}
            </span>
          </div>
        </div>
      </Card>

      {/* 棋盘 */}
      <div className="flex-1 flex items-center justify-center w-full relative min-h-0">
        {localGame ? (
          <div
            className={`transition-opacity duration-300 ${
              !isMyTurn || isGameOver ? 'opacity-70' : 'opacity-100'
            }`}
          >
            <ChessBoard
              game={localGame}
              onNodeClick={handleNodeClick}
              flashLines={flashLines}
              eatableNodes={eatableNodes}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#d4a853]" />
          </div>
        )}
      </div>

      {/* 聊天切换按钮 */}
      <button
        onClick={() => setChatOpen(!chatOpen)}
        className="shrink-0 z-40 w-12 h-12 rounded-full bg-[#d4a853]/20 border border-[#d4a853]/40 flex items-center justify-center hover:bg-[#d4a853]/30 transition-colors mt-2"
      >
        {chatOpen ? (
          <X className="w-5 h-5 text-[#d4a853]" />
        ) : (
          <MessageSquare className="w-5 h-5 text-[#d4a853]" />
        )}
        {messages.length > 0 && !chatOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] flex items-center justify-center font-bold">
            {messages.length}
          </span>
        )}
      </button>

      {/* iOS 风格聊天面板 */}
      {chatOpen && (
        <div className="shrink-0 w-full max-w-lg mt-2 bg-[#0f0f1a]/95 border border-[#d4a853]/30 rounded-t-xl backdrop-blur-sm flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] h-[45vh] md:h-80">
          <div className="p-3 border-b border-[#d4a853]/20 flex items-center justify-between shrink-0">
            <span className="text-sm font-medium text-[#d4a853]">对局聊天</span>
            <button
              onClick={() => setChatOpen(false)}
              className="text-white/40 hover:text-white/70"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <p className="text-xs text-white/30 text-center py-4">
                暂无消息，开始聊天吧~
              </p>
            )}
            {messages.map((msg, i) => {
              const isMe = msg.player_name === playerName;
              return (
                <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="max-w-[80%]">
                    {!isMe && (
                      <div className="text-[10px] text-white/40 mb-0.5 ml-1">
                        {msg.player_name}
                      </div>
                    )}
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm ${
                        isMe
                          ? 'bg-[#d4a853] text-black rounded-br-md'
                          : 'bg-[#2a2a3e] text-white rounded-bl-md'
                      }`}
                    >
                      {msg.message}
                    </div>
                    <div
                      className={`text-[10px] text-white/30 mt-0.5 ${
                        isMe ? 'text-right mr-1' : 'ml-1'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('zh-CN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
          <div className="p-2 border-t border-[#d4a853]/20 flex gap-2 shrink-0">
            <Input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="输入消息..."
              maxLength={100}
              className="flex-1 h-9 bg-[#1a1a2e] border-[#d4a853]/20 text-white text-sm placeholder:text-white/30"
            />
            <Button
              size="sm"
              onClick={handleSendChat}
              disabled={!chatInput.trim()}
              className="h-9 px-3 bg-[#d4a853]/20 hover:bg-[#d4a853]/30 disabled:opacity-30"
            >
              <Send className="w-4 h-4 text-[#d4a853]" />
            </Button>
          </div>
        </div>
      )}

      {/* 游戏结束弹窗 */}
      {isGameOver && gameState?.winner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <Card className="p-8 text-center bg-[#0f0f1a] border-[#d4a853]/40 shadow-[0_0_60px_rgba(212,168,83,0.2)]">
            <h2
              className="text-4xl font-bold mb-4"
              style={{
                background: 'linear-gradient(135deg, #d4a853, #f0d78c)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {gameState.winner === 'red' ? '粉方' : '蓝方'}获胜！
            </h2>
            <p className="text-white/60 mb-6">
              {gameState.winner === playerColor ? '恭喜你获得胜利！' : '对手获胜，再接再厉！'}
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                onClick={handleLeaveRoom}
                className="bg-[#d4a853] text-black hover:bg-[#f0d78c]"
              >
                返回大厅
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

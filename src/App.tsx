import { useState, useCallback, useRef, useEffect } from 'react';
import { DragonPhoenixGame, type GameMode } from '@/lib/game-engine';
import { ChessBoard } from '@/components/ChessBoard';
import { ParticleBackground } from '@/components/ParticleBackground';
import { getAIMove } from '@/lib/ai-service';
import OnlineGame from '@/components/OnlineGame';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Volume2, VolumeX, HelpCircle, RotateCcw, Home, Swords, Bird, Bot, Globe, MessageSquare, Send, Loader2, X } from 'lucide-react';

const CHAT_API_BASE = 'https://freeapi.514179.xyz/v1';
const CHAT_API_KEY = 'sk-cfw-v2-vwSdrljilUkF2biw.neHjWCX6kW7wTuXLUXirK_EItQ5w-oew7ljOfoQtoy59G2DPwJVCcBKPIK4I6kwphBYjbAjxgzCQGOYlUaloz2dggYgkhvvlmDcyUtSI-_ZOU3pVzzJV8RMq3kH5iYWA8yPecMOkHBlm8PuCqLvsKVUyPdA3s6mDWi_iQVnt3rg2L79sUmPqOMmPQrymX2qv6wP6CyW6726K4F0RAhJw-gOoNZn511BCeKrASDnvMkijtc-fc90ieA9vz619W8eHLMCiBJO_jM2M';
const CHAT_MODEL = 'Kimi-k2.6';

type Screen = 'menu' | 'game' | 'ai-game' | 'online';
type AIDifficulty = 'easy' | 'medium' | 'hard';

interface AIMessage {
  role: 'user' | 'ai';
  text: string;
  time: string;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('dragon');
  const [game, setGame] = useState<DragonPhoenixGame>(() => new DragonPhoenixGame('dragon'));
  const [flashLines, setFlashLines] = useState<string[]>([]);
  const [eatableNodes, setEatableNodes] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [showWin, setShowWin] = useState(false);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [aiThinking, setAiThinking] = useState(false);
  const [playerSide, setPlayerSide] = useState<'red' | 'blue'>('red');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<DragonPhoenixGame>(game);

  // Keep ref in sync
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  // Cleanup flash timer on unmount
  useEffect(() => {
    return () => clearTimeout(flashTimer.current);
  }, []);

  // Audio context
  const audioCtx = useRef<AudioContext | null>(null);
  const initAudio = useCallback(() => {
    if (!audioCtx.current) {
      audioCtx.current = new AudioContext();
    }
    if (audioCtx.current.state === 'suspended') {
      audioCtx.current.resume();
    }
  }, []);

  const playSound = useCallback((type: 'place' | 'move' | 'capture' | 'dragon' | 'phoenix' | 'select' | 'error' | 'win') => {
    if (!soundOn || !audioCtx.current) return;
    const ctx = audioCtx.current;
    const now = ctx.currentTime;

    const playTone = (freq: number, duration: number, type: OscillatorType, gain: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(gain, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(g).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + duration);
    };

    switch (type) {
      case 'place': playTone(440, 0.15, 'triangle', 0.15); break;
      case 'move': {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.linearRampToValueAtTime(220, now + 0.2);
        g.gain.setValueAtTime(0.12, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.connect(g).connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      }
      case 'capture':
        playTone(220, 0.3, 'square', 0.1);
        playTone(80, 0.3, 'sine', 0.2);
        break;
      case 'dragon':
        playTone(261.63, 0.4, 'sawtooth', 0.1);
        playTone(329.63, 0.4, 'sawtooth', 0.1);
        playTone(392.00, 0.4, 'sawtooth', 0.1);
        break;
      case 'phoenix':
        [523.25, 587.33, 659.25, 783.99, 880.00].forEach((f) => {
          playTone(f, 0.3, 'sine', 0.08);
        });
        break;
      case 'select': playTone(1200, 0.08, 'sine', 0.1); break;
      case 'error': playTone(150, 0.3, 'sawtooth', 0.1); break;
      case 'win':
        [523.25, 587.33, 659.25, 698.46, 783.99].forEach((f, idx) => {
          setTimeout(() => playTone(f, 0.3, 'sine', 0.12), idx * 100);
        });
        break;
    }
  }, [soundOn]);

  const startGame = useCallback((mode: GameMode) => {
    initAudio();
    const g = new DragonPhoenixGame(mode);
    setGame(g);
    setGameMode(mode);
    setScreen('game');
    setFlashLines([]);
    setEatableNodes([]);
    setStatusMsg(g.getStatusText());
    setShowWin(false);
    setPlayerSide('red');
    setAiMessages([]);
  }, [initAudio]);

  const startAIGame = useCallback((mode: GameMode, difficulty: AIDifficulty, side: 'red' | 'blue') => {
    initAudio();
    const g = new DragonPhoenixGame(mode);
    setGame(g);
    setGameMode(mode);
    setAiDifficulty(difficulty);
    setPlayerSide(side);
    setScreen('ai-game');
    setFlashLines([]);
    setEatableNodes([]);
    setStatusMsg(g.getStatusText());
    setShowWin(false);
    setAiMessages([]);
    // 如果玩家选蓝方，AI先手
    if (side === 'blue') {
      setTimeout(() => runAIMoveRef(g, difficulty), 500);
    }
  }, [initAudio]);

  // Use ref-based game to avoid stale closures
  const runAIMoveRef = useCallback(async (currentGame: DragonPhoenixGame, difficulty: AIDifficulty) => {
    if (currentGame.getPhase() === 'gameover') return;
    setAiThinking(true);
    try {
      const move = await getAIMove(currentGame, difficulty);
      if (currentGame.getPhase() === 'placing' && move.nodeId) {
        const result = currentGame.handleNodeClick(move.nodeId);
        handleGameResultRef(result, currentGame);
      } else if (currentGame.getPhase() === 'moving' && move.nodeId && move.toNodeId) {
        currentGame.selectedNode = move.nodeId;
        const result = currentGame.handleNodeClick(move.toNodeId);
        handleGameResultRef(result, currentGame);
      } else if (currentGame.getPhase() === 'eating' && move.nodeId) {
        const result = currentGame.handleNodeClick(move.nodeId);
        handleGameResultRef(result, currentGame);
        if (currentGame.getPhase() === 'eating') {
          setTimeout(() => runAIMoveRef(currentGame, difficulty), 600);
        }
      } else if (currentGame.getPhase() === 'eating' && move.nodeId && move.toNodeId) {
        // Phoenix double-eat: first target, then second target
        currentGame.handleNodeClick(move.nodeId);
        const result = currentGame.handleNodeClick(move.toNodeId);
        handleGameResultRef(result, currentGame);
        if (currentGame.getPhase() === 'eating') {
          setTimeout(() => runAIMoveRef(currentGame, difficulty), 600);
        }
      }
    } catch (err) {
      console.error('AI move error:', err);
    } finally {
      setAiThinking(false);
    }
  }, []);

  const handleGameResultRef = useCallback((result: any, currentGame: DragonPhoenixGame) => {
    if (result.type === 'select') {
      playSound('select');
    } else if (result.type === 'error') {
      playSound('error');
    } else if (result.type === 'place') {
      playSound('place');
      if (result.newDragons.length > 0) playSound('dragon');
      if (result.newPhoenixes.length > 0) playSound('phoenix');
      if (result.newDragons.length > 0 || result.newPhoenixes.length > 0) {
        setFlashLines([...result.newDragons, ...result.newPhoenixes]);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashLines([]), 2000);
      }
    } else if (result.type === 'move') {
      playSound('move');
      if (result.newDragons.length > 0) playSound('dragon');
      if (result.newPhoenixes.length > 0) playSound('phoenix');
      if (result.newDragons.length > 0 || result.newPhoenixes.length > 0) {
        setFlashLines([...result.newDragons, ...result.newPhoenixes]);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashLines([]), 2000);
      }
    } else if (result.type === 'eat') {
      playSound('capture');
    }

    if (result.gameOver) {
      setShowWin(true);
      playSound('win');
    }

    setGame(prev => {
      const g = new DragonPhoenixGame(prev.mode);
      g.loadState(currentGame.getState());
      return g;
    });
  }, [playSound]);

  const handleNodeClick = useCallback((nodeId: string) => {
    initAudio();
    const currentGame = gameRef.current;
    const result = currentGame.handleNodeClick(nodeId);
    handleGameResultRef(result, currentGame);

    // AI模式下，玩家走完后轮到AI
    if (screen === 'ai-game' && !result.gameOver && currentGame.getPhase() !== 'eating') {
      setTimeout(() => runAIMoveRef(currentGame, aiDifficulty), 600);
    }
  }, [screen, aiDifficulty, initAudio, handleGameResultRef, runAIMoveRef]);

  const resetGame = useCallback(() => {
    if (screen === 'ai-game') {
      startAIGame(gameMode, aiDifficulty, playerSide);
    } else {
      startGame(gameMode);
    }
  }, [screen, gameMode, aiDifficulty, playerSide, startAIGame, startGame]);

  const backToMenu = useCallback(() => {
    setScreen('menu');
    setFlashLines([]);
    setEatableNodes([]);
    setShowWin(false);
    setAiThinking(false);
  }, []);

  const sendChat = useCallback(async () => {
    if (!chatInput.trim()) return;
    const now = new Date();
    const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const userText = chatInput.trim();
    setAiMessages(prev => [...prev, { role: 'user', text: userText, time }]);
    setChatInput('');
    setAiChatLoading(true);

    try {
      // 构建当前棋局状态描述
      const g = gameRef.current;
      const boardDesc = g.getBoardDesc();
      const phaseText = g.getPhase() === 'placing' ? '放子阶段' : g.getPhase() === 'moving' ? '移子阶段' : g.getPhase() === 'eating' ? '吃子阶段' : '游戏结束';
      const currentPlayerText = g.getCurrentPlayer() === 'red' ? '粉方' : '蓝方';
      const aiSideText = playerSide === 'red' ? '粉方' : '蓝方';
      const handRed = g.getHandCount('red');
      const handBlue = g.getHandCount('blue');
      const onBoardRed = g.getOnBoardCount('red');
      const onBoardBlue = g.getOnBoardCount('blue');

      const gameContext = `当前棋局状态：
- 模式：${g.mode === 'dragon' ? '龙棋' : '凤棋'}
- 阶段：${phaseText}
- 当前回合：${currentPlayerText}
- 你是${aiSideText}（AI对手）
- 粉方：手牌${handRed} + 场上${onBoardRed}
- 蓝方：手牌${handBlue} + 场上${onBoardBlue}
- 棋盘：${boardDesc}`;

      const response = await fetch(`${CHAT_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CHAT_API_KEY}`,
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: [
            {
              role: 'system',
              content: `你是一个龙凤棋AI对手。规则：龙棋9子24节点，横竖3子成龙吃1子；凤棋12子32节点，横竖对角3子成龙吃1子，4子成凤吃2子。凤子>龙子>普通子。\n\n你的任务：\n1. 根据当前棋局状态给出正经、有策略性的回复\n2. 可以分析局势、给出建议、或回应玩家的嘲讽\n3. 回复要简洁（不超过60字），但要专业有深度\n4. 不要卖萌或过度活泼，像一个认真的棋友\n5. 如果玩家问棋局相关的问题，结合当前局势回答`,
            },
            {
              role: 'user',
              content: `${gameContext}\n\n玩家说："${userText}"\n\n请回复：`,
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      const msg = data.choices?.[0]?.message;
      const aiText = msg?.content || msg?.reasoning_content || '……';
      const aiTime = `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}`;
      setAiMessages(prev => [...prev, { role: 'ai', text: aiText, time: aiTime }]);
    } catch (err) {
      console.error('AI chat error:', err);
      setAiMessages(prev => [...prev, { role: 'ai', text: '网络有点卡，稍后再聊~', time: `${new Date().getHours().toString().padStart(2, '0')}:${new Date().getMinutes().toString().padStart(2, '0')}` }]);
    } finally {
      setAiChatLoading(false);
    }
  }, [chatInput, playerSide]);

  // 同步游戏状态到UI
  useEffect(() => {
    setStatusMsg(game.getStatusText());
    if (game.phase === 'eating') {
      const eatable = game.getEatablePieces(game.currentPlayer, game.eatType);
      setEatableNodes(eatable);
    } else {
      setEatableNodes([]);
    }
  }, [game.phase, game.currentPlayer, game.eatType, game.eatCount, game]);

  // 聊天自动滚动
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, aiChatLoading]);

  // AI吃子阶段自动处理
  useEffect(() => {
    if (screen === 'ai-game' && game.getPhase() === 'eating' && game.getCurrentPlayer() !== playerSide && !aiThinking) {
      setTimeout(() => runAIMoveRef(gameRef.current, aiDifficulty), 600);
    }
  }, [game, screen, playerSide, aiThinking, aiDifficulty, runAIMoveRef]);

  const isAIGame = screen === 'ai-game';
  const isPlayerTurn = !isAIGame || game.getCurrentPlayer() === playerSide;

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden flex flex-col">
      <ParticleBackground />

      {/* Main Menu */}
      {screen === 'menu' && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          <div className="text-center mb-10">
            <h1 className="text-6xl font-bold mb-3 tracking-wider" style={{
              background: 'linear-gradient(135deg, #d4a853 0%, #f0d78c 50%, #d4a853 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(212,168,83,0.3)',
            }}>
              龙凤棋
            </h1>
            <p className="text-[#d4a853]/60 text-lg tracking-widest">DRAGON · PHOENIX · CHESS</p>
          </div>

          <div className="flex flex-col gap-3 w-full max-w-sm">
            {/* 本地对战 */}
            <div className="text-xs text-[#d4a853]/50 uppercase tracking-widest mb-1">本地对战</div>
            <Button
              onClick={() => startGame('dragon')}
              className="h-14 text-lg font-semibold bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all duration-300"
            >
              <Swords className="w-5 h-5 mr-3 text-[#ff69b4]" />
              龙棋 · 9子24节点
            </Button>
            <Button
              onClick={() => startGame('phoenix')}
              className="h-14 text-lg font-semibold bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all duration-300"
            >
              <Bird className="w-5 h-5 mr-3 text-[#00ff88]" />
              凤棋 · 12子32节点
            </Button>

            {/* AI对战 */}
            <div className="text-xs text-[#d4a853]/50 uppercase tracking-widest mt-3 mb-1">AI 对战</div>
            <Dialog>
              <DialogTrigger asChild>
                <Button
                  className="h-14 text-lg font-semibold bg-gradient-to-r from-[#1a0a2e] to-[#2a103e] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all duration-300"
                >
                  <Bot className="w-5 h-5 mr-3 text-[#c084fc]" />
                  挑战 AI
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0f0f1a] border-[#d4a853]/30 text-white max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-xl text-[#d4a853]">选择 AI 对战设置</DialogTitle>
                </DialogHeader>
                <AIGameSetup onStart={startAIGame} />
              </DialogContent>
            </Dialog>

            {/* 在线对战 */}
            <div className="text-xs text-[#d4a853]/50 uppercase tracking-widest mt-3 mb-1">在线对战</div>
            <Button
              onClick={() => setScreen('online')}
              className="h-12 text-base font-semibold bg-gradient-to-r from-[#0a1a2e] to-[#0e2038] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all duration-300"
            >
              <Globe className="w-5 h-5 mr-3 text-[#4ade80]" />
              联机对战
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 text-base border-[#d4a853]/30 text-[#d4a853] hover:bg-[#d4a853]/10 hover:border-[#d4a853] mt-2"
                >
                  <HelpCircle className="w-4 h-4 mr-2" />
                  游戏规则
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#0f0f1a] border-[#d4a853]/30 text-white max-w-lg max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-2xl text-[#d4a853]">龙凤棋规则</DialogTitle>
                </DialogHeader>
                <RulesContent />
              </DialogContent>
            </Dialog>
          </div>
        </div>
      )}

      {/* Game Screen */}
      {(screen === 'game' || screen === 'ai-game') && (
        <div className="relative z-10 flex flex-col items-center min-h-0 h-screen py-3 px-2">
          {/* Top bar */}
          <div className="w-full max-w-lg flex items-center justify-between mb-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={backToMenu} className="text-[#d4a853]/70 hover:text-[#d4a853]">
              <Home className="w-4 h-4 mr-1" /> 返回
            </Button>
            <div className="flex items-center gap-2">
              {isAIGame && (
                <div className="flex items-center gap-1.5 text-xs text-white/50 mr-2">
                  <Bot className="w-3.5 h-3.5 text-[#c084fc]" />
                  <span>AI · {aiDifficulty === 'easy' ? '简单' : aiDifficulty === 'medium' ? '中等' : '困难'}</span>
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => setSoundOn(!soundOn)} className="text-[#d4a853]/70 hover:text-[#d4a853]">
                {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetGame} className="text-[#d4a853]/70 hover:text-[#d4a853]">
                <RotateCcw className="w-4 h-4 mr-1" /> 重开
              </Button>
            </div>
          </div>

          {/* Status bar */}
          <Card className="w-full max-w-lg mb-2 bg-[#0f0f1a]/80 border-[#d4a853]/20 backdrop-blur-sm shrink-0">
            <div className="p-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-3 h-3 rounded-full ${game.currentPlayer === 'red' ? 'bg-[#ff69b4] shadow-[0_0_8px_#ff69b4]' : 'bg-[#2980b9] shadow-[0_0_8px_#2980b9]'}`} />
                <span className="text-sm font-medium text-[#d4a853]">{statusMsg}</span>
                {aiThinking && (
                  <span className="flex items-center gap-1 text-xs text-[#c084fc]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    AI思考中...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#ff69b4]" /> 粉:{game.getHandCount('red')}+{game.getOnBoardCount('red')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#2980b9]" /> 蓝:{game.getHandCount('blue')}+{game.getOnBoardCount('blue')}
                </span>
              </div>
            </div>
          </Card>

          {/* Board */}
          <div className="flex-1 flex items-center justify-center w-full relative min-h-0">
            <div className={`transition-opacity duration-300 ${!isPlayerTurn || aiThinking ? 'opacity-60' : 'opacity-100'}`}>
              <ChessBoard
                game={game}
                onNodeClick={handleNodeClick}
                flashLines={flashLines}
                eatableNodes={eatableNodes}
              />
            </div>
          </div>

          {/* Chat toggle button */}
          <button
            onClick={() => setChatOpen(!chatOpen)}
            className="shrink-0 z-40 w-12 h-12 rounded-full bg-[#d4a853]/20 border border-[#d4a853]/40 flex items-center justify-center hover:bg-[#d4a853]/30 transition-colors mt-2"
          >
            {chatOpen ? <X className="w-5 h-5 text-[#d4a853]" /> : <MessageSquare className="w-5 h-5 text-[#d4a853]" />}
          </button>

          {/* iOS-style Chat panel */}
          {chatOpen && (
            <div className="shrink-0 w-full max-w-lg mt-2 bg-[#0f0f1a]/95 border border-[#d4a853]/30 rounded-t-xl backdrop-blur-sm flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)] h-[45vh] md:h-80">
              <div className="p-3 border-b border-[#d4a853]/20 flex items-center justify-between shrink-0">
                <span className="text-sm font-medium text-[#d4a853]">对局聊天</span>
                <button onClick={() => setChatOpen(false)} className="text-white/40 hover:text-white/70">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {aiMessages.length === 0 && (
                  <p className="text-xs text-white/30 text-center py-4">暂无消息，开始和 AI 聊天吧~</p>
                )}
                {aiMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                      msg.role === 'user'
                        ? 'bg-[#d4a853] text-black rounded-br-md'
                        : 'bg-[#2a2a3e] text-white rounded-bl-md'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
                {aiChatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#2a2a3e] text-white rounded-2xl rounded-bl-md px-3 py-2 text-sm flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-white/60">AI 正在输入...</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-2 border-t border-[#d4a853]/20 flex gap-2 shrink-0">
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="输入消息..."
                  className="flex-1 h-9 bg-[#1a1a2e] border-[#d4a853]/20 text-white text-sm"
                />
                <Button size="sm" onClick={sendChat} className="h-9 px-3 bg-[#d4a853]/20 hover:bg-[#d4a853]/30">
                  <Send className="w-4 h-4 text-[#d4a853]" />
                </Button>
              </div>
            </div>
          )}

          {/* Win Dialog */}
          {showWin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <Card className="p-8 text-center bg-[#0f0f1a] border-[#d4a853]/40 shadow-[0_0_60px_rgba(212,168,83,0.2)]">
                <h2 className="text-4xl font-bold mb-4" style={{
                  background: 'linear-gradient(135deg, #d4a853, #f0d78c)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {game.winner === 'red' ? '粉方' : '蓝方'}获胜！
                </h2>
                <p className="text-white/60 mb-6">
                  {isAIGame
                    ? (game.winner === playerSide ? '恭喜你战胜了 AI！' : 'AI 获胜，再接再厉！')
                    : '恭喜获得胜利！'}
                </p>
                <div className="flex gap-3 justify-center">
                  <Button onClick={resetGame} className="bg-[#d4a853] text-black hover:bg-[#f0d78c]">
                    再来一局
                  </Button>
                  <Button variant="outline" onClick={backToMenu} className="border-[#d4a853]/40 text-[#d4a853]">
                    返回菜单
                  </Button>
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Online Game Screen */}
      {screen === 'online' && <OnlineGame />}
    </div>
  );
}

// AI 对战设置组件
function AIGameSetup({ onStart }: { onStart: (mode: GameMode, difficulty: AIDifficulty, side: 'red' | 'blue') => void }) {
  const [mode, setMode] = useState<GameMode>('dragon');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [side, setSide] = useState<'red' | 'blue'>('red');

  return (
    <div className="space-y-5 py-2">
      {/* 模式选择 */}
      <div>
        <label className="text-sm text-[#d4a853] mb-2 block">棋盘模式</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('dragon')}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              mode === 'dragon'
                ? 'border-[#ff69b4] bg-[#ff69b4]/10 text-[#ff69b4]'
                : 'border-white/10 text-white/50 hover:border-white/30'
            }`}
          >
            龙棋
          </button>
          <button
            onClick={() => setMode('phoenix')}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              mode === 'phoenix'
                ? 'border-[#00ff88] bg-[#00ff88]/10 text-[#00ff88]'
                : 'border-white/10 text-white/50 hover:border-white/30'
            }`}
          >
            凤棋
          </button>
        </div>
      </div>

      {/* 难度选择 */}
      <div>
        <label className="text-sm text-[#d4a853] mb-2 block">AI 难度</label>
        <div className="flex gap-2">
          {(['easy', 'medium', 'hard'] as AIDifficulty[]).map((d) => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                difficulty === d
                  ? 'border-[#c084fc] bg-[#c084fc]/10 text-[#c084fc]'
                  : 'border-white/10 text-white/50 hover:border-white/30'
              }`}
            >
              {d === 'easy' ? '简单' : d === 'medium' ? '中等' : '困难'}
            </button>
          ))}
        </div>
      </div>

      {/* 阵营选择 */}
      <div>
        <label className="text-sm text-[#d4a853] mb-2 block">选择阵营</label>
        <div className="flex gap-2">
          <button
            onClick={() => setSide('red')}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              side === 'red'
                ? 'border-[#ff69b4] bg-[#ff69b4]/10 text-[#ff69b4]'
                : 'border-white/10 text-white/50 hover:border-white/30'
            }`}
          >
            粉方（先手）
          </button>
          <button
            onClick={() => setSide('blue')}
            className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-all ${
              side === 'blue'
                ? 'border-[#2980b9] bg-[#2980b9]/10 text-[#74c0fc]'
                : 'border-white/10 text-white/50 hover:border-white/30'
            }`}
          >
            蓝方（后手）
          </button>
        </div>
      </div>

      <Button
        onClick={() => onStart(mode, difficulty, side)}
        className="w-full h-12 bg-[#d4a853] text-black hover:bg-[#f0d78c] font-semibold text-lg"
      >
        开始对战
      </Button>
    </div>
  );
}

function RulesContent() {
  return (
    <div className="space-y-4 text-sm text-white/80">
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">游戏目标</h3>
        <p>吃掉对方所有棋子即可获胜！</p>
      </section>
      <Separator className="bg-[#d4a853]/20" />
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">基本流程</h3>
        <ol className="list-decimal pl-5 space-y-1">
          <li><strong>放子</strong>：轮流把手中的棋子放到空节点上</li>
          <li><strong>吃子</strong>：成线后可吃对方棋子</li>
          <li><strong>移子</strong>：手空后沿连线每次移动1格</li>
          <li><strong>胜负</strong>：对方棋子全灭即获胜</li>
        </ol>
      </section>
      <Separator className="bg-[#d4a853]/20" />
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">龙棋（9子 · 24节点）</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>棋盘：3层同心正方形</li>
          <li>每人9子</li>
          <li><strong>成龙</strong>：横/竖3子成线 → 吃1子</li>
        </ul>
      </section>
      <Separator className="bg-[#d4a853]/20" />
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">凤棋（12子 · 32节点）</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>棋盘：4层同心正方形 + 对角线</li>
          <li>每人12子</li>
          <li><strong>成龙</strong>：横/竖/对角3子成线 → 吃1子</li>
          <li><strong>成凤</strong>：横/竖/对角4子成线 → 吃2子</li>
        </ul>
      </section>
      <Separator className="bg-[#d4a853]/20" />
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">保护规则（谁大谁说了算）</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-[#ff69b4]">凤子</strong>（成凤线）{'>'} 最高保护，谁也吃不了</li>
          <li><strong className="text-[#ffd700]">龙子</strong>（成龙线）{'>'} 只能被凤吃，不能被龙吃</li>
          <li><strong className="text-white">普通子</strong>（不成线）{'>'} 谁都能吃</li>
        </ul>
      </section>
    </div>
  );
}

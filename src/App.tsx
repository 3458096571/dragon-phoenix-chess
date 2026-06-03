import { useState, useCallback, useRef, useEffect } from 'react';
import { DragonPhoenixGame, type GameMode } from '@/lib/game-engine';
import { ChessBoard } from '@/components/ChessBoard';
import { ParticleBackground } from '@/components/ParticleBackground';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Volume2, VolumeX, HelpCircle, RotateCcw, Home, Swords, Bird } from 'lucide-react';

type Screen = 'menu' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('dragon');
  const [game, setGame] = useState<DragonPhoenixGame>(() => new DragonPhoenixGame('dragon'));
  const [flashLines, setFlashLines] = useState<string[]>([]);
  const [eatableNodes, setEatableNodes] = useState<string[]>([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [soundOn, setSoundOn] = useState(true);
  const [showWin, setShowWin] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

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
  }, [initAudio]);

  const handleNodeClick = useCallback((nodeId: string) => {
    initAudio();
    const result = game.handleNodeClick(nodeId);

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
        const eatable = game.getEatablePieces(game.currentPlayer, game.eatType);
        setEatableNodes(eatable);
      } else {
        setEatableNodes([]);
      }
    } else if (result.type === 'move') {
      playSound('move');
      if (result.newDragons.length > 0) playSound('dragon');
      if (result.newPhoenixes.length > 0) playSound('phoenix');
      if (result.newDragons.length > 0 || result.newPhoenixes.length > 0) {
        setFlashLines([...result.newDragons, ...result.newPhoenixes]);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setFlashLines([]), 2000);
        const eatable = game.getEatablePieces(game.currentPlayer, game.eatType);
        setEatableNodes(eatable);
      } else {
        setEatableNodes([]);
      }
    } else if (result.type === 'eat' || result.type === 'eat_select') {
      if (result.type === 'eat') playSound('capture');
      if (game.eatCount > 0 && game.phase === 'eating') {
        const eatable = game.getEatablePieces(game.currentPlayer, game.eatType);
        setEatableNodes(eatable);
      } else {
        setEatableNodes([]);
      }
    }

    if (result.gameOver) {
      setShowWin(true);
      playSound('win');
    }

    setStatusMsg(game.getStatusText());
    // Force re-render
    setGame(prev => {
      const g = new DragonPhoenixGame(prev.mode);
      g.loadState(prev.getState());
      return g;
    });
  }, [game, initAudio, playSound]);

  const resetGame = useCallback(() => {
    startGame(gameMode);
  }, [startGame, gameMode]);

  const backToMenu = useCallback(() => {
    setScreen('menu');
    setFlashLines([]);
    setEatableNodes([]);
    setShowWin(false);
  }, []);

  // Update eatable when phase changes
  useEffect(() => {
    if (game.phase === 'eating') {
      const eatable = game.getEatablePieces(game.currentPlayer, game.eatType);
      setEatableNodes(eatable);
    } else {
      setEatableNodes([]);
    }
  }, [game.phase, game.currentPlayer, game.eatType, game.eatCount]);

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white relative overflow-hidden">
      <ParticleBackground />

      {/* Main Menu */}
      {screen === 'menu' && (
        <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4">
          <div className="text-center mb-12">
            <h1 className="text-6xl font-bold mb-4 tracking-wider" style={{
              background: 'linear-gradient(135deg, #d4a853 0%, #f0d78c 50%, #d4a853 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 40px rgba(212,168,83,0.3)',
            }}>
              龙凤棋
            </h1>
            <p className="text-[#d4a853]/60 text-lg tracking-widest">DRAGON · PHOENIX · CHESS</p>
          </div>

          <div className="flex flex-col gap-4 w-full max-w-sm">
            <Button
              onClick={() => startGame('dragon')}
              className="h-16 text-xl font-semibold bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all duration-300"
            >
              <Swords className="w-6 h-6 mr-3 text-[#e63946]" />
              龙棋 · 9子24节点
            </Button>
            <Button
              onClick={() => startGame('phoenix')}
              className="h-16 text-xl font-semibold bg-gradient-to-r from-[#1a1a2e] to-[#16213e] border border-[#d4a853]/30 hover:border-[#d4a853] hover:shadow-[0_0_20px_rgba(212,168,83,0.2)] transition-all duration-300"
            >
              <Bird className="w-6 h-6 mr-3 text-[#00ff88]" />
              凤棋 · 12子32节点
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  className="h-12 text-lg border-[#d4a853]/30 text-[#d4a853] hover:bg-[#d4a853]/10 hover:border-[#d4a853]"
                >
                  <HelpCircle className="w-5 h-5 mr-2" />
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
      {screen === 'game' && (
        <div className="relative z-10 flex flex-col items-center min-h-screen py-4 px-2">
          {/* Top bar */}
          <div className="w-full max-w-lg flex items-center justify-between mb-2">
            <Button variant="ghost" size="sm" onClick={backToMenu} className="text-[#d4a853]/70 hover:text-[#d4a853]">
              <Home className="w-4 h-4 mr-1" /> 返回
            </Button>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => setSoundOn(!soundOn)} className="text-[#d4a853]/70 hover:text-[#d4a853]">
                {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={resetGame} className="text-[#d4a853]/70 hover:text-[#d4a853]">
                <RotateCcw className="w-4 h-4 mr-1" /> 重开
              </Button>
            </div>
          </div>

          {/* Status bar */}
          <Card className="w-full max-w-lg mb-3 bg-[#0f0f1a]/80 border-[#d4a853]/20 backdrop-blur-sm">
            <div className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${game.currentPlayer === 'red' ? 'bg-[#e63946] shadow-[0_0_8px_#e63946]' : 'bg-[#2980b9] shadow-[0_0_8px_#2980b9]'}`} />
                <span className="text-sm font-medium text-[#d4a853]">{statusMsg}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-white/50">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#e63946]" /> 红:{game.getHandCount('red')}+{game.getOnBoardCount('red')}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-[#2980b9]" /> 蓝:{game.getHandCount('blue')}+{game.getOnBoardCount('blue')}
                </span>
              </div>
            </div>
          </Card>

          {/* Board */}
          <div className="flex-1 flex items-center justify-center w-full">
            <ChessBoard
              game={game}
              onNodeClick={handleNodeClick}
              flashLines={flashLines}
              eatableNodes={eatableNodes}
            />
          </div>

          {/* Win Dialog */}
          {showWin && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <Card className="p-8 text-center bg-[#0f0f1a] border-[#d4a853]/40 shadow-[0_0_60px_rgba(212,168,83,0.2)]">
                <h2 className="text-4xl font-bold mb-4" style={{
                  background: 'linear-gradient(135deg, #d4a853, #f0d78c)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}>
                  {game.winner === 'red' ? '红方' : '蓝方'}获胜！
                </h2>
                <p className="text-white/60 mb-6">恭喜获得胜利！</p>
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
    </div>
  );
}

function RulesContent() {
  return (
    <div className="space-y-4 text-sm text-white/80">
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">🐉 龙棋（9子 · 24节点）</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>棋盘：3层同心正方形，24个节点</li>
          <li>每人9子，轮流放置到空节点</li>
          <li>三子连成一线（成龙）可吃对方1子</li>
          <li>手空后进入移动阶段，每次沿边移动1格</li>
          <li>对方棋子全灭即获胜</li>
        </ul>
      </section>
      <Separator className="bg-[#d4a853]/20" />
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">🦚 凤棋（12子 · 32节点）</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li>棋盘：4层同心正方形 + 对角线，32个节点</li>
          <li>每人12子，规则与龙棋相同</li>
          <li>四子连成一线（成凤）可吃对方2子</li>
          <li>成凤吃子：可选2个普通子，或1个龙子</li>
        </ul>
      </section>
      <Separator className="bg-[#d4a853]/20" />
      <section>
        <h3 className="text-[#d4a853] font-semibold mb-2">🛡️ 保护等级</h3>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-[#ff6b6b]">凤子</strong>：参与成凤线，最高保护，不可被吃</li>
          <li><strong className="text-[#ffd700]">龙子</strong>：参与成龙线，可被凤吃</li>
          <li><strong className="text-white">普通子</strong>：无保护，可被龙吃、凤吃</li>
        </ul>
      </section>
    </div>
  );
}

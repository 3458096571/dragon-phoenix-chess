import { useState, useCallback, useRef, useEffect } from 'react';
import Peer, { type DataConnection } from 'peerjs';

// ============================
// P2P 联机对战 Hook (PeerJS)
// ============================

export type GameMode = 'dragon' | 'phoenix';
export type PlayerColor = 'red' | 'blue';

export interface RoomInfo {
  code: string;
  mode: GameMode;
  status: 'waiting' | 'playing' | 'finished';
  hostName: string;
  guestName: string;
}

export interface GameState {
  phase: 'placing' | 'moving' | 'eating' | 'gameover';
  current_player: PlayerColor;
  board: Record<string, PlayerColor>;
  redHand: number;
  blueHand: number;
  redOnBoard: number;
  blueOnBoard: number;
  eatCount: number;
  eatType: 'dragon' | 'phoenix';
  winner: PlayerColor | null;
}

export interface ChatMsg {
  playerName: string;
  message: string;
  time: string;
  isMine: boolean;
}

export interface MoveData {
  type: 'place' | 'move' | 'eat';
  nodeId?: string;
  from?: string;
  to?: string;
  eatTarget?: string;
}

// P2P 消息协议
type P2PMessage =
  | { type: 'join'; playerName: string }
  | { type: 'welcome'; roomMode: GameMode; hostName: string }
  | { type: 'ready' }
  | { type: 'start'; initialState: GameState }
  | { type: 'move'; move: MoveData; newState: GameState }
  | { type: 'chat'; playerName: string; message: string; time: string }
  | { type: 'leave' }
  | { type: 'error'; message: string };

export function useP2PGame(playerName: string) {
  const [myPeerId, setMyPeerId] = useState<string>('');
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [playerColor, setPlayerColor] = useState<PlayerColor | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerStatus, setPeerStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');

  const peerRef = useRef<Peer | null>(null);
  const connRef = useRef<DataConnection | null>(null);
  const gameStateRef = useRef<GameState | null>(null);

  // 生成6位房间码
  const generateCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
  };

  // 发送消息
  const send = useCallback((msg: P2PMessage) => {
    if (connRef.current && connRef.current.open) {
      connRef.current.send(JSON.stringify(msg));
    }
  }, []);

  // 处理收到的消息
  const handleMessage = useCallback((data: string) => {
    try {
      const msg: P2PMessage = JSON.parse(data);
      switch (msg.type) {
        case 'join': {
          // 房主收到：有人加入
          setRoom(prev => prev ? { ...prev, guestName: msg.playerName, status: 'waiting' } : null);
          setPlayerColor('red');
          setIsHost(true);
          // 发送欢迎消息
          send({ type: 'welcome', roomMode: room?.mode || 'dragon', hostName: playerName });
          break;
        }
        case 'welcome': {
          // 客人收到：被接受
          setRoom(prev => prev ? { ...prev, status: 'waiting' } : null);
          setPlayerColor('blue');
          setIsHost(false);
          break;
        }
        case 'ready': {
          // 对方准备好了
          break;
        }
        case 'start': {
          // 游戏开始
          setGameState(msg.initialState);
          gameStateRef.current = msg.initialState;
          setRoom(prev => prev ? { ...prev, status: 'playing' } : null);
          break;
        }
        case 'move': {
          // 对方走了棋
          setGameState(msg.newState);
          gameStateRef.current = msg.newState;
          if (msg.newState.phase === 'gameover') {
            setRoom(prev => prev ? { ...prev, status: 'finished' } : null);
          }
          break;
        }
        case 'chat': {
          setMessages(prev => [...prev, {
            playerName: msg.playerName,
            message: msg.message,
            time: msg.time,
            isMine: false,
          }]);
          break;
        }
        case 'leave': {
          setError('对手已离开房间');
          setRoom(prev => prev ? { ...prev, status: 'waiting', guestName: '' } : null);
          setGameState(null);
          
          connRef.current = null;
          break;
        }
        case 'error': {
          setError(msg.message);
          break;
        }
      }
    } catch (e) {
      console.error('消息解析失败:', e);
    }
  }, [room, playerName, send]);

  // 初始化 Peer
  const initPeer = useCallback((id?: string) => {
    return new Promise<Peer>((resolve, reject) => {
      let resolved = false;
      let rejected = false;

      const peerOpts: { config?: { iceServers?: Array<{ urls: string }> } } = {};
      // 使用 Google STUN 服务器，提高 NAT 穿透成功率
      peerOpts.config = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      };

      const p = id ? new Peer(id, peerOpts) : new Peer(peerOpts);
      peerRef.current = p;
      setPeerStatus('connecting');

      // 10秒超时
      const timer = setTimeout(() => {
        if (!resolved && !rejected) {
          rejected = true;
          setPeerStatus('error');
          try { p.destroy(); } catch (_) {}
          reject(new Error('连接信令服务器超时，请检查网络'));
        }
      }, 10000);

      p.on('open', (peerId) => {
        if (resolved || rejected) return;
        resolved = true;
        clearTimeout(timer);
        setMyPeerId(peerId);
        setPeerStatus('connected');
        resolve(p);
      });

      p.on('error', (err) => {
        console.error('Peer error:', err);
        if (rejected) return;
        rejected = true;
        clearTimeout(timer);
        setPeerStatus('error');
        if (err.type === 'unavailable-id') {
          // ID 已被占用，重新生成
          const newP = new Peer(peerOpts);
          peerRef.current = newP;
          const timer2 = setTimeout(() => {
            if (!resolved) {
              setPeerStatus('error');
              try { newP.destroy(); } catch (_) {}
              reject(new Error('连接超时'));
            }
          }, 10000);
          newP.on('open', () => {
            if (resolved) return;
            resolved = true;
            clearTimeout(timer2);
            setMyPeerId(newP.id);
            setPeerStatus('connected');
            resolve(newP);
          });
          newP.on('error', (e) => {
            if (resolved) return;
            clearTimeout(timer2);
            setPeerStatus('error');
            reject(e);
          });
        } else if (err.type === 'peer-unavailable') {
          setError('房间不存在或已关闭');
          reject(err);
        } else {
          setError(`连接失败: ${err.message}`);
          reject(err);
        }
      });
    });
  }, []);

  // 创建房间
  const createRoom = useCallback(async (mode: GameMode) => {
    setLoading(true);
    setError(null);
    try {
      const code = generateCode();
      const peerId = `dp-chess-${code}`;
      const p = await initPeer(peerId);
      const myId = p.id;

      // 监听连接
      p.on('connection', (connection) => {
        connection.on('open', () => {
          connRef.current = connection;
          
        });
        connection.on('data', (data) => {
          handleMessage(data as string);
        });
        connection.on('close', () => {
          setError('对手已断开连接');
          
          connRef.current = null;
        });
        connection.on('error', (err) => {
          setError(`连接错误: ${err.message}`);
        });
      });

      setRoom({
        code,
        mode,
        status: 'waiting',
        hostName: playerName,
        guestName: '',
      });
      setIsHost(true);
      setPlayerColor('red');
      setMyPeerId(myId);
    } catch (err) {
      setError('创建房间失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [playerName, initPeer, handleMessage]);

  // 加入房间
  const joinRoom = useCallback(async (code: string, name: string) => {
    setLoading(true);
    setError(null);
    try {
      const hostPeerId = `dp-chess-${code}`;
      const p = await initPeer();

      const connection = p.connect(hostPeerId, { reliable: true });

      connection.on('open', () => {
        connRef.current = connection;
        
        // 发送加入消息
        connection.send(JSON.stringify({ type: 'join', playerName: name }));
      });

      connection.on('data', (data) => {
        handleMessage(data as string);
      });

      connection.on('close', () => {
        setError('与房主的连接已断开');
        
        connRef.current = null;
      });

      connection.on('error', (err) => {
        setError(`连接错误: ${err.message}`);
      });

      setRoom({
        code,
        mode: 'dragon',
        status: 'waiting',
        hostName: '',
        guestName: name,
      });
    } catch (err) {
      setError('加入房间失败，请检查房间号');
    } finally {
      setLoading(false);
    }
  }, [initPeer, handleMessage]);

  // 开始游戏（房主专用）
  const startGame = useCallback((initialState: GameState) => {
    gameStateRef.current = initialState;
    setGameState(initialState);
    setRoom(prev => prev ? { ...prev, status: 'playing' } : null);
    send({ type: 'start', initialState });
  }, [send]);

  // 走棋
  const makeMove = useCallback((move: MoveData, newState: GameState) => {
    gameStateRef.current = newState;
    setGameState(newState);
    send({ type: 'move', move, newState });
    if (newState.phase === 'gameover') {
      setRoom(prev => prev ? { ...prev, status: 'finished' } : null);
    }
  }, [send]);

  // 发送聊天
  const sendChat = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, { playerName, message, time, isMine: true }]);
    send({ type: 'chat', playerName, message, time });
  }, [playerName, send]);

  // 离开房间
  const leaveRoom = useCallback(() => {
    send({ type: 'leave' });
    if (connRef.current) {
      connRef.current.close();
      connRef.current = null;
    }
    if (peerRef.current) {
      peerRef.current.destroy();
      peerRef.current = null;
    }
    setRoom(null);
    setGameState(null);
    setMessages([]);
    setPlayerColor(null);
    setIsHost(false);
    setError(null);
    setPeerStatus('disconnected');
  }, [send]);

  // 清理
  useEffect(() => {
    return () => {
      if (connRef.current) connRef.current.close();
      if (peerRef.current) peerRef.current.destroy();
    };
  }, []);

  return {
    myPeerId,
    peerStatus,
    room,
    gameState,
    messages,
    isHost,
    playerColor,
    loading,
    error,
    createRoom,
    joinRoom,
    startGame,
    makeMove,
    sendChat,
    leaveRoom,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type {
  GameRoom,
  GameState,
  ChatMessage,
  PlayerPresence,
  GameMode,
  PlayerColor,
} from '@/lib/supabase-types';
import { DragonPhoenixGame } from '@/lib/game-engine';

// ============================
// 类型定义
// ============================

export interface UseOnlineGameReturn {
  room: GameRoom | null;
  gameState: GameState | null;
  messages: ChatMessage[];
  presence: PlayerPresence[];
  isHost: boolean;
  isGuest: boolean;
  playerColor: PlayerColor | null;
  loading: boolean;
  error: string | null;
  createRoom: (mode: GameMode) => Promise<string>;
  joinRoom: (code: string, playerName: string) => Promise<void>;
  setReady: (ready: boolean) => Promise<void>;
  makeMove: (moveData: MoveData) => Promise<void>;
  sendChat: (message: string) => Promise<void>;
  leaveRoom: () => Promise<void>;
}

export interface MoveData {
  type: 'place' | 'move' | 'eat' | 'eat_select' | 'skip_eat';
  nodeId?: string;
  from?: string;
  to?: string;
  eatTarget?: string;
}

// ============================
// 工具函数
// ============================

function generateRoomCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generatePlayerId(): string {
  return `player_${Math.random().toString(36).substring(2, 9)}_${Date.now()}`;
}

function getInitialGameState(roomId: string, mode: GameMode): Omit<GameState, 'id' | 'created_at' | 'updated_at'> {
  const isDragon = mode === 'dragon';
  const handCount = isDragon ? 9 : 12;

  return {
    room_id: roomId,
    board_state: {},
    current_player: 'red',
    phase: 'placing',
    red_hand: handCount,
    blue_hand: handCount,
    red_on_board: 0,
    blue_on_board: 0,
    eat_count: 0,
    eat_type: 'dragon',
    winner: null,
    last_move: null,
  };
}

// ============================
// Hook 实现
// ============================

export function useOnlineGame(playerName: string): UseOnlineGameReturn {
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [presence, setPresence] = useState<PlayerPresence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerIdRef = useRef<string>(generatePlayerId());
  const playerId = playerIdRef.current;

  const isHost = room?.host_id === playerId;
  const isGuest = room?.guest_id === playerId;

  // 根据房间角色分配颜色：host = red, guest = blue
  const playerColor: PlayerColor | null = isHost ? 'red' : isGuest ? 'blue' : null;

  // ============================
  // 创建房间
  // ============================

  const createRoom = useCallback(async (mode: GameMode): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      const code = generateRoomCode();

      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .insert({
          code,
          host_id: playerId,
          guest_id: null,
          mode,
          status: 'waiting',
          host_ready: false,
          guest_ready: false,
        } as any)
        .select()
        .single();

      if (roomError) throw roomError;

      setRoom(roomData as GameRoom);

      // 创建初始游戏状态
      const initialState = getInitialGameState((roomData as GameRoom).id, mode);
      const { error: stateError } = await supabase
        .from('game_states')
        .insert(initialState as any);

      if (stateError) throw stateError;

      return code;
    } catch (err: any) {
      setError(err.message || '创建房间失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  // ============================
  // 加入房间
  // ============================

  const joinRoom = useCallback(async (code: string, name: string): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      // 查找房间
      const { data: roomData, error: roomError } = await supabase
        .from('game_rooms')
        .select('*')
        .eq('code', code)
        .single();

      if (roomError) throw new Error('房间不存在');
      const r = roomData as GameRoom;
      if (r.status !== 'waiting') throw new Error('房间已开始或已结束');
      if (r.guest_id) throw new Error('房间已满');
      if (r.host_id === playerId) throw new Error('不能加入自己创建的房间');

      // 更新房间为 guest 加入
      const { data: updatedRoom, error: updateError } = await supabase
        .from('game_rooms')
        .update({ guest_id: playerId } as any)
        .eq('id', r.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setRoom(updatedRoom as GameRoom);

      // 上报在线状态
      await supabase.from('player_presence').upsert({
        room_id: r.id,
        player_id: playerId,
        player_name: name,
        online_at: new Date().toISOString(),
      } as any);
    } catch (err: any) {
      setError(err.message || '加入房间失败');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  // ============================
  // 设置准备状态
  // ============================

  const setReady = useCallback(async (ready: boolean): Promise<void> => {
    if (!room) return;

    try {
      const updateField = isHost ? 'host_ready' : 'guest_ready';
      const { data: updatedRoom, error } = await supabase
        .from('game_rooms')
        .update({ [updateField]: ready } as any)
        .eq('id', room.id)
        .select()
        .single();

      if (error) throw error;

      const ur = updatedRoom as GameRoom;
      setRoom(ur);

      // 双方都准备好了，开始游戏
      if (ur.host_ready && ur.guest_ready && ur.status === 'waiting') {
        await supabase
          .from('game_rooms')
          .update({ status: 'playing' } as any)
          .eq('id', room.id);
      }
    } catch (err: any) {
      setError(err.message || '设置准备状态失败');
      throw err;
    }
  }, [room, isHost]);

  // ============================
  // 发送走棋
  // ============================

  const makeMove = useCallback(async (moveData: MoveData): Promise<void> => {
    if (!room || !gameState) return;

    try {
      // 获取当前游戏状态并重建本地游戏引擎
      const game = new DragonPhoenixGame(room.mode);
      game.loadState({
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

      let result: any;

      switch (moveData.type) {
        case 'place':
          if (!moveData.nodeId) throw new Error('落子需要指定位置');
          result = game.handleNodeClick(moveData.nodeId);
          break;
        case 'move':
          if (!moveData.from || !moveData.to) throw new Error('移动需要指定起点和终点');
          game.selectedNode = moveData.from;
          result = game.handleNodeClick(moveData.to);
          break;
        case 'eat':
          if (!moveData.eatTarget) throw new Error('吃子需要指定目标');
          result = game.handleNodeClick(moveData.eatTarget);
          break;
        case 'skip_eat':
          game.skipEat();
          result = { success: true };
          break;
        default:
          throw new Error('未知的走棋类型');
      }

      if (!result.success) {
        throw new Error(result.message || '走棋失败');
      }

      const newState = game.getState();

      // 更新到 Supabase
      const { error } = await supabase
        .from('game_states')
        .update({
          board_state: newState.board,
          current_player: newState.currentPlayer,
          phase: newState.phase,
          red_hand: newState.redHand,
          blue_hand: newState.blueHand,
          red_on_board: newState.redOnBoard,
          blue_on_board: newState.blueOnBoard,
          eat_count: newState.eatCount,
          eat_type: newState.eatType,
          winner: newState.winner,
          last_move: {
            from: moveData.from || null,
            to: moveData.nodeId || moveData.to || moveData.eatTarget || '',
            player: gameState.current_player,
            timestamp: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        } as any)
        .eq('room_id', room.id);

      if (error) throw error;

      // 游戏结束更新房间状态
      if (newState.winner) {
        await supabase
          .from('game_rooms')
          .update({ status: 'finished' } as any)
          .eq('id', room.id);
      }
    } catch (err: any) {
      setError(err.message || '发送走棋失败');
      throw err;
    }
  }, [room, gameState]);

  // ============================
  // 发送聊天消息
  // ============================

  const sendChat = useCallback(async (message: string): Promise<void> => {
    if (!room) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: room.id,
          player_name: playerName,
          message: message.trim(),
        } as any);

      if (error) throw error;
    } catch (err: any) {
      setError(err.message || '发送消息失败');
      throw err;
    }
  }, [room, playerName]);

  // ============================
  // 离开房间
  // ============================

  const leaveRoom = useCallback(async (): Promise<void> => {
    if (!room) return;

    try {
      // 删除在线状态
      await supabase
        .from('player_presence')
        .delete()
        .eq('room_id', room.id)
        .eq('player_id', playerId);

      if (isHost) {
        // 房主离开，解散房间
        await supabase.from('game_rooms').delete().eq('id', room.id);
      } else if (isGuest) {
        // 客人离开，重置 guest
        await supabase
          .from('game_rooms')
          .update({ guest_id: null, guest_ready: false } as any)
          .eq('id', room.id);
      }

      setRoom(null);
      setGameState(null);
      setMessages([]);
      setPresence([]);
    } catch (err: any) {
      setError(err.message || '离开房间失败');
      throw err;
    }
  }, [room, isHost, isGuest, playerId]);

  // ============================
  // 实时订阅
  // ============================

  useEffect(() => {
    if (!room) return;

    // 订阅房间变化
    const roomChannel = supabase
      .channel(`room_${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${room.id}` },
        (payload) => {
          if (payload.new) {
            setRoom(payload.new as GameRoom);
          }
        }
      )
      .subscribe();

    // 订阅游戏状态变化
    const stateChannel = supabase
      .channel(`state_${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_states', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.new) {
            setGameState(payload.new as GameState);
          }
        }
      )
      .subscribe();

    // 订阅聊天消息
    const chatChannel = supabase
      .channel(`chat_${room.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.new) {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
          }
        }
      )
      .subscribe();

    // 订阅在线状态
    const presenceChannel = supabase
      .channel(`presence_${room.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'player_presence', filter: `room_id=eq.${room.id}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            setPresence((prev) => prev.filter((p) => p.id !== (payload.old as any).id));
          } else if (payload.new) {
            setPresence((prev) => {
              const idx = prev.findIndex((p) => p.id === (payload.new as PlayerPresence).id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = payload.new as PlayerPresence;
                return next;
              }
              return [...prev, payload.new as PlayerPresence];
            });
          }
        }
      )
      .subscribe();

    // 心跳：定期更新在线状态
    const heartbeat = setInterval(async () => {
      await supabase
        .from('player_presence')
        .upsert({
          room_id: room.id,
          player_id: playerId,
          player_name: playerName,
          online_at: new Date().toISOString(),
        } as any);
    }, 30000);

    return () => {
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(stateChannel);
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(presenceChannel);
      clearInterval(heartbeat);
    };
  }, [room, playerId, playerName]);

  // ============================
  // 初始加载游戏状态和聊天记录
  // ============================

  useEffect(() => {
    if (!room) {
      setGameState(null);
      setMessages([]);
      setPresence([]);
      return;
    }

    // 加载游戏状态
    supabase
      .from('game_states')
      .select('*')
      .eq('room_id', room.id)
      .single()
      .then(({ data }) => {
        if (data) setGameState(data as GameState);
      });

    // 加载聊天记录
    supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setMessages(data as ChatMessage[]);
      });

    // 加载在线状态
    supabase
      .from('player_presence')
      .select('*')
      .eq('room_id', room.id)
      .then(({ data }) => {
        if (data) setPresence(data as PlayerPresence[]);
      });
  }, [room]);

  return {
    room,
    gameState,
    messages,
    presence,
    isHost,
    isGuest,
    playerColor,
    loading,
    error,
    createRoom,
    joinRoom,
    setReady,
    makeMove,
    sendChat,
    leaveRoom,
  };
}

export default useOnlineGame;

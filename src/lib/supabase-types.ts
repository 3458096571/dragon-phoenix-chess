export type GameMode = 'dragon' | 'phoenix';
export type GameStatus = 'waiting' | 'playing' | 'finished';
export type GamePhase = 'placing' | 'moving' | 'eating' | 'gameover';
export type PlayerColor = 'red' | 'blue';

export interface GameRoom {
  id: string;
  code: string;
  host_id: string;
  guest_id: string | null;
  mode: GameMode;
  status: GameStatus;
  created_at: string;
  host_ready: boolean;
  guest_ready: boolean;
}

export interface GameState {
  id: string;
  room_id: string;
  board_state: Record<string, PlayerColor | null>;
  current_player: PlayerColor;
  phase: GamePhase;
  red_hand: number;
  blue_hand: number;
  red_on_board: number;
  blue_on_board: number;
  eat_count: number;
  eat_type: 'dragon' | 'phoenix';
  winner: PlayerColor | null;
  last_move: {
    from: string | null;
    to: string;
    player: PlayerColor;
    timestamp: string;
  } | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  player_name: string;
  message: string;
  created_at: string;
}

export interface PlayerPresence {
  id: string;
  room_id: string;
  player_id: string;
  player_name: string;
  online_at: string;
}

export interface Database {
  public: {
    Tables: {
      game_rooms: {
        Row: GameRoom;
        Insert: Omit<GameRoom, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: Partial<Omit<GameRoom, 'id' | 'created_at'>>;
      };
      game_states: {
        Row: GameState;
        Insert: Omit<GameState, 'id' | 'created_at' | 'updated_at'> & { id?: string; created_at?: string; updated_at?: string };
        Update: Partial<Omit<GameState, 'id' | 'created_at'>>;
      };
      chat_messages: {
        Row: ChatMessage;
        Insert: Omit<ChatMessage, 'id' | 'created_at'> & { id?: string; created_at?: string };
        Update: never;
      };
      player_presence: {
        Row: PlayerPresence;
        Insert: Omit<PlayerPresence, 'id' | 'online_at'> & { id?: string; online_at?: string };
        Update: Partial<Omit<PlayerPresence, 'id'>>;
      };
    };
  };
}

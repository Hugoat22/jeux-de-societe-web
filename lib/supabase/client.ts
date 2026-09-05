import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { GameState } from '@/lib/game';

let browserClient: SupabaseClient | null | undefined;

export function getSupabaseBrowserClient() {
  if (browserClient !== undefined) return browserClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  browserClient = url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null;
  return browserClient;
}

export async function ensureAnonymousSession() {
  const client = getSupabaseBrowserClient();
  if (!client) return null;
  const { data: { session } } = await client.auth.getSession();
  if (session) return session;
  const { data, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  return data.session;
}

export type GameRoom = {
  gameId: string;
  payload: GameState;
};

type GameRoomRow = {
  game_id: string;
  payload: GameState;
};

function requireClient() {
  const client = getSupabaseBrowserClient();
  if (!client) throw new Error('supabase_not_configured');
  return client;
}

function roomFromRow(row: GameRoomRow): GameRoom {
  return { gameId: row.game_id, payload: row.payload };
}

export async function createGameRoom(code: string, nickname: string, state: GameState) {
  const { data, error } = await requireClient()
    .rpc('create_game_room', { p_code: code, p_nickname: nickname, p_state: state })
    .single<GameRoomRow>();
  if (error) throw error;
  return roomFromRow(data);
}

export async function joinGameRoom(code: string, nickname: string) {
  const { data, error } = await requireClient()
    .rpc('join_game_room', { p_code: code, p_nickname: nickname })
    .single<GameRoomRow>();
  if (error) throw error;
  return roomFromRow(data);
}

export async function saveGameRoom(gameId: string, state: GameState, expectedVersion: number) {
  const { data, error } = await requireClient()
    .rpc('save_game_room', { p_game_id: gameId, p_state: state, p_expected_version: expectedVersion })
    .single<GameRoomRow>();
  if (error) throw error;
  return roomFromRow(data);
}

export async function sendGameMessage(gameId: string, recipientId: string, message: string) {
  const { data, error } = await requireClient()
    .rpc('send_game_message', { p_game_id: gameId, p_recipient_id: recipientId, p_text: message })
    .single<GameRoomRow>();
  if (error) throw error;
  return roomFromRow(data);
}

export async function fetchGameProjection(gameId: string) {
  const { data, error } = await requireClient()
    .from('game_views')
    .select('game_id,payload')
    .eq('game_id', gameId)
    .single<GameRoomRow>();
  if (error) throw error;
  return roomFromRow(data);
}

export function subscribeToGameProjection(
  gameId: string,
  onInvalidate: () => void,
) {
  const client = getSupabaseBrowserClient();
  if (!client) return () => {};
  const channel = client
    .channel(`game-view-${gameId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'game_views', filter: `game_id=eq.${gameId}` },
      onInvalidate,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

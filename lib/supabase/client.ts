import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
      { event: '*', schema: 'public', table: 'game_views', filter: `game_id=eq.${gameId}`, select: ['game_id', 'user_id', 'version'] },
      onInvalidate,
    )
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}


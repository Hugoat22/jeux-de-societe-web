create or replace function private.refresh_game_views(p_game_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.game_views (game_id, user_id, version, payload)
  select
    g.id,
    p.user_id,
    g.version,
    jsonb_set(
      g.state,
      '{messages}',
      coalesce(
        (
          select jsonb_agg(
            case
              when message->>'senderId' = p.user_id::text
                or message->>'recipientId' = p.user_id::text
              then message
              else jsonb_set(message, '{text}', to_jsonb(''::text), true)
            end
            order by (message->>'createdAt')::bigint
          )
          from jsonb_array_elements(coalesce(g.state->'messages', '[]'::jsonb)) as message
          where message->>'senderId' = p.user_id::text
             or message->>'recipientId' = p.user_id::text
             or coalesce(message->'detectedByIds', '[]'::jsonb) ? p.user_id::text
        ),
        '[]'::jsonb
      ),
      true
    )
  from public.games as g
  join public.players as p on p.game_id = g.id
  where g.id = p_game_id
  on conflict (game_id, user_id) do update
    set version = excluded.version,
        payload = excluded.payload,
        updated_at = now();
end;
$$;

revoke all on function private.refresh_game_views(uuid) from public, anon, authenticated;

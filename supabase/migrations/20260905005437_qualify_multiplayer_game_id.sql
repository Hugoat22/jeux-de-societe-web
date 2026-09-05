-- PL/pgSQL output parameters named game_id shadow unqualified table columns.
-- Qualify every players reference in the affected RPCs so PostgREST calls do
-- not fail with "column reference game_id is ambiguous".

create or replace function public.join_game_room(
  p_code text,
  p_nickname text
)
returns table (game_id uuid, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_code text := upper(trim(p_code));
  v_nickname text := left(trim(p_nickname), 24);
  v_game public.games%rowtype;
  v_member_count integer;
  v_player jsonb;
  v_next_state jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if char_length(v_nickname) < 1 then
    raise exception 'invalid_nickname' using errcode = '22023';
  end if;

  select * into v_game
  from public.games as requested_game
  where requested_game.code = v_code
  for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.players as existing_member
    where existing_member.game_id = v_game.id
      and existing_member.user_id = v_user_id
  ) then
    perform private.refresh_game_views(v_game.id);
    return query
      select gv.game_id, gv.payload
      from public.game_views as gv
      where gv.game_id = v_game.id and gv.user_id = v_user_id;
    return;
  end if;

  if v_game.state->>'phase' <> 'lobby' then
    raise exception 'game_already_started' using errcode = '55000';
  end if;

  select count(*) into v_member_count
  from public.players as member
  where member.game_id = v_game.id;

  if v_member_count >= 6 then
    raise exception 'game_is_full' using errcode = '54000';
  end if;

  v_player := jsonb_build_object(
    'id', v_user_id::text,
    'nickname', v_nickname,
    'isHost', false,
    'ready', true,
    'character', private.character_template(jsonb_array_length(v_game.state->'players')),
    'alive', true
  );

  v_next_state := jsonb_set(
    jsonb_set(
      v_game.state,
      '{players}',
      v_game.state->'players' || jsonb_build_array(v_player),
      true
    ),
    '{version}',
    to_jsonb(v_game.version + 1),
    true
  );

  insert into public.players (game_id, user_id, nickname, ready)
  values (v_game.id, v_user_id, v_nickname, true);

  update public.games as target_game
  set state = v_next_state,
      version = v_game.version + 1
  where target_game.id = v_game.id;

  perform private.refresh_game_views(v_game.id);

  return query
    select gv.game_id, gv.payload
    from public.game_views as gv
    where gv.game_id = v_game.id and gv.user_id = v_user_id;
end;
$$;

create or replace function public.save_game_room(
  p_game_id uuid,
  p_state jsonb,
  p_expected_version bigint
)
returns table (game_id uuid, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game public.games%rowtype;
  v_next_state jsonb;
  v_member_count integer;
  v_state_member_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if not exists (
    select 1
    from public.players as requesting_member
    where requesting_member.game_id = p_game_id
      and requesting_member.user_id = v_user_id
  ) then
    raise exception 'game_access_denied' using errcode = '42501';
  end if;

  select * into v_game
  from public.games as requested_game
  where requested_game.id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;
  if v_game.version <> p_expected_version then
    raise exception 'game_version_conflict' using errcode = '40001';
  end if;
  if p_state->>'code' <> v_game.code
     or p_state->>'hostPlayerId' <> v_game.host_user_id::text
     or jsonb_typeof(p_state->'players') <> 'array' then
    raise exception 'invalid_game_state' using errcode = '22023';
  end if;

  select count(*) into v_member_count
  from public.players as member
  where member.game_id = p_game_id;

  select count(*) into v_state_member_count
  from jsonb_array_elements(p_state->'players') as player
  where not coalesce((player->>'isBot')::boolean, false);

  if v_state_member_count <> v_member_count
     or exists (
       select 1
       from jsonb_array_elements(p_state->'players') as player
       where not coalesce((player->>'isBot')::boolean, false)
         and not exists (
           select 1 from public.players as member
           where member.game_id = p_game_id
             and member.user_id::text = player->>'id'
         )
     ) then
    raise exception 'invalid_player_list' using errcode = '22023';
  end if;

  v_next_state := jsonb_set(
    jsonb_set(
      p_state,
      '{messages}',
      coalesce(v_game.state->'messages', '[]'::jsonb),
      true
    ),
    '{version}',
    to_jsonb(v_game.version + 1),
    true
  );

  update public.games as target_game
  set state = v_next_state,
      version = v_game.version + 1,
      day = greatest(0, coalesce((v_next_state->>'day')::integer, 0)),
      status = case
        when v_next_state->>'phase' = 'finished' then 'finished'::public.game_status
        when v_next_state->>'phase' = 'lobby' then 'lobby'::public.game_status
        else 'running'::public.game_status
      end
  where target_game.id = p_game_id;

  perform private.refresh_game_views(p_game_id);

  return query
    select gv.game_id, gv.payload
    from public.game_views as gv
    where gv.game_id = p_game_id and gv.user_id = v_user_id;
end;
$$;

create or replace function public.send_game_message(
  p_game_id uuid,
  p_recipient_id uuid,
  p_text text
)
returns table (game_id uuid, payload jsonb)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_game public.games%rowtype;
  v_body text := left(trim(p_text), 280);
  v_sender jsonb;
  v_recipient jsonb;
  v_observer_id text;
  v_detected_by jsonb := '[]'::jsonb;
  v_living_count integer;
  v_discretion integer;
  v_risk integer;
  v_message jsonb;
begin
  if v_user_id is null then
    raise exception 'authentication_required' using errcode = '28000';
  end if;
  if char_length(v_body) < 1 or p_recipient_id = v_user_id then
    raise exception 'invalid_message' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.players as requesting_member
    where requesting_member.game_id = p_game_id
      and requesting_member.user_id = v_user_id
  ) then
    raise exception 'game_access_denied' using errcode = '42501';
  end if;

  select * into v_game
  from public.games as requested_game
  where requested_game.id = p_game_id
  for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  select player into v_sender
  from jsonb_array_elements(v_game.state->'players') as player
  where player->>'id' = v_user_id::text
    and coalesce((player->>'alive')::boolean, false)
    and not coalesce((player->>'isBot')::boolean, false)
  limit 1;

  select player into v_recipient
  from jsonb_array_elements(v_game.state->'players') as player
  where player->>'id' = p_recipient_id::text
    and coalesce((player->>'alive')::boolean, false)
    and not coalesce((player->>'isBot')::boolean, false)
  limit 1;

  if v_sender is null or v_recipient is null
     or not exists (
       select 1
       from public.players as recipient_member
       where recipient_member.game_id = p_game_id
         and recipient_member.user_id = p_recipient_id
     ) then
    raise exception 'invalid_message_participant' using errcode = '22023';
  end if;

  select count(*) into v_living_count
  from jsonb_array_elements(v_game.state->'players') as player
  where coalesce((player->>'alive')::boolean, false)
    and not coalesce((player->>'isBot')::boolean, false);

  v_discretion := coalesce((v_sender->'character'->'skills'->>'Discrétion')::integer, 0);
  v_risk := greatest(15, least(55, 39 + greatest(0, v_living_count - 3) * 4 - v_discretion * 5));

  if random() < v_risk::numeric / 100 then
    select player->>'id' into v_observer_id
    from jsonb_array_elements(v_game.state->'players') as player
    where coalesce((player->>'alive')::boolean, false)
      and not coalesce((player->>'isBot')::boolean, false)
      and player->>'id' <> v_user_id::text
      and player->>'id' <> p_recipient_id::text
    order by random()
    limit 1;

    if v_observer_id is not null then
      v_detected_by := jsonb_build_array(v_observer_id);
    end if;
  end if;

  v_message := jsonb_build_object(
    'id', gen_random_uuid()::text,
    'day', coalesce((v_game.state->>'day')::integer, 0),
    'senderId', v_user_id::text,
    'recipientId', p_recipient_id::text,
    'text', v_body,
    'detectedByIds', v_detected_by,
    'createdAt', floor(extract(epoch from clock_timestamp()) * 1000)::bigint
  );

  update public.games as target_game
  set version = v_game.version + 1,
      state = jsonb_set(
        jsonb_set(
          v_game.state,
          '{messages}',
          coalesce(v_game.state->'messages', '[]'::jsonb) || jsonb_build_array(v_message),
          true
        ),
        '{version}',
        to_jsonb(v_game.version + 1),
        true
      )
  where target_game.id = p_game_id;

  perform private.refresh_game_views(p_game_id);

  return query
    select gv.game_id, gv.payload
    from public.game_views as gv
    where gv.game_id = p_game_id and gv.user_id = v_user_id;
end;
$$;

revoke all on function public.join_game_room(text, text) from public, anon, authenticated;
revoke all on function public.save_game_room(uuid, jsonb, bigint) from public, anon, authenticated;
revoke all on function public.send_game_message(uuid, uuid, text) from public, anon, authenticated;

grant execute on function public.join_game_room(text, text) to authenticated;
grant execute on function public.save_game_room(uuid, jsonb, bigint) to authenticated;
grant execute on function public.send_game_message(uuid, uuid, text) to authenticated;

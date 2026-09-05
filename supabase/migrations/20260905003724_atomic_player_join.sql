create or replace function private.character_template(p_index integer)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select case mod(greatest(p_index, 0), 6)
    when 0 then jsonb_build_object('name','Sacha','specialty','Répare tout, sauf les gens','health',100,'hunger',0,'thirst',0,'fatigue',12,'morale',72,'skills',jsonb_build_object('Bricolage',4,'Observation',3,'Médecine',1),'trait','Calme sous pression','conditions','[]'::jsonb,'sequelae','[]'::jsonb,'expeditions',0)
    when 1 then jsonb_build_object('name','Maya','specialty','Lit le terrain comme une carte','health',100,'hunger',0,'thirst',0,'fatigue',8,'morale',68,'skills',jsonb_build_object('Orientation',4,'Survie',3,'Négociation',2),'trait','Claustrophobe','conditions','[]'::jsonb,'sequelae','[]'::jsonb,'expeditions',0)
    when 2 then jsonb_build_object('name','Noé','specialty','Ancien secouriste bénévole','health',100,'hunger',0,'thirst',0,'fatigue',10,'morale',76,'skills',jsonb_build_object('Médecine',4,'Force',3,'Discrétion',1),'trait','Insomniaque','conditions','[]'::jsonb,'sequelae','[]'::jsonb,'expeditions',0)
    when 3 then jsonb_build_object('name','Inès','specialty','Voit ce que les autres ratent','health',100,'hunger',0,'thirst',0,'fatigue',9,'morale',70,'skills',jsonb_build_object('Observation',4,'Discrétion',3,'Bricolage',2),'trait','Fragile','conditions','[]'::jsonb,'sequelae','[]'::jsonb,'expeditions',0)
    when 4 then jsonb_build_object('name','Eliott','specialty','Ne perd jamais le nord','health',100,'hunger',0,'thirst',0,'fatigue',11,'morale',66,'skills',jsonb_build_object('Survie',4,'Orientation',3,'Force',2),'trait','Résistant au froid','conditions','[]'::jsonb,'sequelae','[]'::jsonb,'expeditions',0)
    else jsonb_build_object('name','Lina','specialty','Trouve les mots qui restent','health',100,'hunger',0,'thirst',0,'fatigue',7,'morale',80,'skills',jsonb_build_object('Négociation',4,'Médecine',2,'Observation',3),'trait','Asthmatique','conditions','[]'::jsonb,'sequelae','[]'::jsonb,'expeditions',0)
  end;
$$;

revoke all on function private.character_template(integer) from public, anon, authenticated;

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
  from public.games
  where code = v_code
  for update;

  if not found then
    raise exception 'game_not_found' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.players
    where game_id = v_game.id and user_id = v_user_id
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
  from public.players
  where game_id = v_game.id;

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

  update public.games
  set state = v_next_state,
      version = v_game.version + 1
  where id = v_game.id;

  perform private.refresh_game_views(v_game.id);

  return query
    select gv.game_id, gv.payload
    from public.game_views as gv
    where gv.game_id = v_game.id and gv.user_id = v_user_id;
end;
$$;

revoke all on function public.join_game_room(text, text) from public, anon, authenticated;
grant execute on function public.join_game_room(text, text) to authenticated;

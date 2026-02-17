create or replace function match_room_embeddings(
  query_embedding vector(1536),
  match_count int,
  candidate_ids bigint[] default null
)
returns table (room_id bigint, distance float)
language sql
stable
as $$
  select room_id, (embedding <=> query_embedding) as distance
  from room_embeddings
  where candidate_ids is null or room_id = any(candidate_ids)
  order by embedding <=> query_embedding
  limit match_count;
$$;

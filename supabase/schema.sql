-- pgvector 활성화
create extension if not exists vector;

-- RAG 문서 청크 테이블
create table if not exists documents (
  id        bigserial primary key,
  source    text,                        -- 원본 파일명
  content   text not null,              -- 청크 텍스트
  embedding vector(1536),               -- text-embedding-3-small
  created_at timestamptz default now()
);

-- 유사도 검색 인덱스 (IVFFlat)
create index if not exists documents_embedding_idx
  on documents using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 유사도 검색 함수
create or replace function match_documents(
  query_embedding vector(1536),
  match_count     int default 5,
  match_threshold float default 0.3
)
returns table (
  id      bigint,
  source  text,
  content text,
  similarity float
)
language sql stable as $$
  select
    id, source, content,
    1 - (embedding <=> query_embedding) as similarity
  from documents
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- 상담 리드 테이블
create table if not exists leads (
  id         bigserial primary key,
  name       text,
  industry   text,
  contact    text not null,
  message    text,
  created_at timestamptz default now()
);

-- 대화 로그 테이블
create table if not exists chat_logs (
  id         bigserial primary key,
  question   text not null,
  answer     text not null,
  created_at timestamptz default now()
);

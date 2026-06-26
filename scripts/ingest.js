/**
 * npm run ingest
 * uploads/*.md → 청크 분할 → 임베딩 → Supabase documents 테이블 적재
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
const CHUNK_SIZE = 500;   // 글자 수
const CHUNK_OVERLAP = 80;

function chunkText(text, source) {
  const chunks = [];
  // 단락 기준 1차 분할
  const paragraphs = text.split(/\n{2,}/);
  let buffer = '';

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if ((buffer + '\n\n' + trimmed).length > CHUNK_SIZE && buffer) {
      chunks.push({ source, content: buffer.trim() });
      // overlap: 버퍼 끝부분 일부 유지
      buffer = buffer.slice(-CHUNK_OVERLAP) + '\n\n' + trimmed;
    } else {
      buffer = buffer ? buffer + '\n\n' + trimmed : trimmed;
    }
  }
  if (buffer.trim()) chunks.push({ source, content: buffer.trim() });
  return chunks;
}

async function embed(texts) {
  const res = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });
  return res.data.map(d => d.embedding);
}

async function main() {
  const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.md'));
  if (!files.length) { console.log('uploads/ 에 .md 파일이 없습니다.'); return; }

  // 기존 데이터 초기화
  const { error: delErr } = await supabase.from('documents').delete().neq('id', 0);
  if (delErr) { console.error('기존 데이터 삭제 실패:', delErr.message); return; }
  console.log('기존 documents 초기화 완료');

  let totalChunks = 0;

  for (const file of files) {
    const text = fs.readFileSync(path.join(UPLOADS_DIR, file), 'utf-8');
    const chunks = chunkText(text, file);
    console.log(`[${file}] ${chunks.length}개 청크`);

    // 배치 임베딩 (최대 20개씩)
    const BATCH = 20;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const batch = chunks.slice(i, i + BATCH);
      const embeddings = await embed(batch.map(c => c.content));

      const rows = batch.map((c, j) => ({
        source: c.source,
        content: c.content,
        embedding: embeddings[j],
      }));

      const { error } = await supabase.from('documents').insert(rows);
      if (error) { console.error('insert 오류:', error.message); return; }
    }

    totalChunks += chunks.length;
  }

  console.log(`\n완료: 총 ${totalChunks}개 청크 적재`);
}

main().catch(console.error);

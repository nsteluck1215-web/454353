require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/* ── Supabase 클라이언트 (미설정 시 null) ── */
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { realtime: { transport: ws } });
}

/* ── 폴백: 전체 파일 주입 ── */
function buildFullPrompt() {
  const docs = [];
  try {
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(UPLOADS_DIR, file), 'utf-8');
      docs.push(`### ${file}\n${content}`);
    }
  } catch (e) { /* uploads 없으면 무시 */ }
  return docs.join('\n\n');
}

/* ── RAG: 질문 임베딩 → 유사도 검색 ── */
async function retrieveChunks(question, supabase) {
  const embRes = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: question,
  });
  const queryEmbedding = embRes.data[0].embedding;

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: 5,
    match_threshold: 0.3,
  });

  if (error) throw new Error(error.message);
  return data || [];
}

/* ── 시스템 프롬프트 조립 ── */
function buildSystemPrompt(knowledgeText) {
  return `당신은 LSY마케팅의 공식 상담 어시스턴트입니다. 이름은 "LSY 어시스턴트"입니다.

아래는 LSY마케팅의 공식 문서입니다. 이 내용만을 근거로 답변하세요.

=== 지식 베이스 ===
${knowledgeText}
=== 지식 베이스 끝 ===

## 답변 규칙
1. 자기소개·대화형 질문: 챗봇 이름(LSY 어시스턴트)과 역할을 자연스럽고 친근하게 소개하세요.
2. 서비스·정책 질문: 반드시 위 지식 베이스 내용만 사용하세요. 문서에 없는 정보는 "상세한 내용은 무료 상담을 통해 안내해 드릴게요. (contact@lsymarketing.co.kr)"로 안내하세요.
3. 무관한 질문(날씨 등): "저는 LSY마케팅 서비스 관련 질문만 답변드릴 수 있어요." 라고 안내하세요.
4. 문서에 없는 정보는 절대 창작하거나 추측하지 마세요.

## 말투
- 친근하고 전문적인 한국어, 간결하게, 필요시 항목 나열, 상담 필요 시 자연스럽게 무료 상담 권유.`;
}

/* ── best-effort 로그 저장 ── */
async function logChat(supabase, question, answer) {
  if (!supabase) return;
  try {
    await supabase.from('chat_logs').insert({ question, answer });
  } catch (_) { /* 실패해도 응답에 영향 없음 */ }
}

/* ── 메인 핸들러 ── */
async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { messages } = req.body;
  const question = messages?.at(-1)?.content ?? '';

  let knowledgeText = '';
  const supabase = getSupabase();

  try {
    if (supabase) {
      const chunks = await retrieveChunks(question, supabase);
      if (chunks.length > 0) {
        knowledgeText = chunks.map(c => `[출처: ${c.source}]\n${c.content}`).join('\n\n---\n\n');
      } else {
        knowledgeText = buildFullPrompt(); // 검색 결과 없으면 폴백
      }
    } else {
      knowledgeText = buildFullPrompt(); // Supabase 미설정 폴백
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: buildSystemPrompt(knowledgeText) },
        ...messages,
      ],
      max_completion_tokens: 800,
      temperature: 0.4,
    });

    const reply = completion.choices[0]?.message?.content ?? '응답을 받지 못했습니다.';

    await logChat(supabase, question, reply);

    res.status(200).json({ reply });
  } catch (err) {
    console.error('[chat]', err);
    res.status(500).json({ error: err.message });
  }
}

module.exports = handler;
module.exports.buildFullPrompt = buildFullPrompt;

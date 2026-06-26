const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function buildSystemPrompt() {
  const docs = [];
  try {
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(UPLOADS_DIR, file), 'utf-8');
      docs.push(`### 파일: ${file}\n${content}`);
    }
  } catch (e) {
    console.error('문서 로드 오류:', e.message);
  }

  return `당신은 LSY마케팅의 공식 상담 어시스턴트입니다. 이름은 "LSY 어시스턴트"입니다.

아래는 LSY마케팅의 공식 문서입니다. 이 내용만을 근거로 답변하세요.

=== 지식 베이스 시작 ===
${docs.join('\n\n')}
=== 지식 베이스 끝 ===

## 답변 규칙

1. **자기소개·대화형 질문** ("이름이 뭐야", "뭘 도와줄 수 있어" 등)
   - 챗봇 이름(LSY 어시스턴트)과 역할을 자연스럽고 친근하게 소개하세요.

2. **서비스·정책 질문**
   - 반드시 위 지식 베이스 문서 내용만 사용하세요.
   - 문서에 없는 정보는 "상세한 내용은 무료 상담을 통해 안내해 드릴게요. (contact@lsymarketing.co.kr)"로 안내하세요.
   - 문서에 없는 정보를 창작하거나 추측하지 마세요.

3. **서비스와 무관한 질문** (날씨, 뉴스, 타 기업 정보 등)
   - "저는 LSY마케팅 서비스 관련 질문만 답변드릴 수 있어요. 마케팅 관련 궁금한 점이 있으시면 편하게 물어봐 주세요!" 라고 안내하세요.

## 말투 지침
- 친근하고 전문적인 한국어로 답변하세요.
- 너무 딱딱하거나 과장된 표현은 피하세요.
- 답변은 간결하게 유지하되, 필요할 때는 항목을 나열하세요.
- 상담이 필요한 경우 자연스럽게 무료 상담을 권유하세요.`;
}

function callOpenAI(systemPrompt, messages) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return reject(new Error('OPENAI_API_KEY가 설정되지 않았습니다.'));

    const payload = JSON.stringify({
      model: 'gpt-5.4-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_completion_tokens: 800,
      temperature: 0.4,
    });

    const options = {
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.error) return reject(new Error(json.error.message));
          resolve(json.choices?.[0]?.message?.content ?? '응답을 받지 못했습니다.');
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/* ── Vercel 서버리스 핸들러 ── */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { messages } = req.body;
    const systemPrompt = buildSystemPrompt();
    const reply = await callOpenAI(systemPrompt, messages);
    res.status(200).json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

module.exports.buildSystemPrompt = buildSystemPrompt;
module.exports.callOpenAI = callOpenAI;

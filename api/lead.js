require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { name, industry, contact, message } = req.body;

  if (!contact) {
    res.status(400).json({ error: '연락처는 필수입니다.' });
    return;
  }

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    res.status(200).json({ ok: true, note: 'Supabase 미설정 — 로그만 출력' });
    console.log('[lead]', { name, industry, contact, message });
    return;
  }

  const supabase = createClient(url, key, { realtime: { transport: ws } });

  const { error } = await supabase.from('leads').insert({ name, industry, contact, message });

  if (error) {
    console.error('[lead]', error.message);
    res.status(500).json({ error: error.message });
    return;
  }

  res.status(200).json({ ok: true });
};

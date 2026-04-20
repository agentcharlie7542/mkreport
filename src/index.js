import dashboardHtml from '../2026-04-20_mileat-da-interactive.html';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    // Gemini API 프록시
    if (url.pathname === '/api/gemini' && request.method === 'POST') {
      try {
        const { prompt } = await request.json();
        if (!prompt) {
          return new Response(JSON.stringify({ error: 'prompt is required' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }

        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
            }),
          }
        );

        const data = await geminiRes.json();

        if (!geminiRes.ok) {
          return new Response(JSON.stringify({ error: data.error?.message || 'Gemini API error' }), {
            status: geminiRes.status,
            headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return new Response(JSON.stringify({ text }), {
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });

      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        });
      }
    }

    // 대시보드 HTML 서빙
    return new Response(dashboardHtml, {
      headers: { 'Content-Type': 'text/html;charset=UTF-8' },
    });
  },
};

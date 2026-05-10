/**
 * 로컬 Anthropic API 프록시
 * 용도: 대시보드 HTML에서 직접 Claude API 호출 시 CORS + API 키 노출 문제 해결
 * 실행: node proxy.js
 * 포트: 3001
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// .env 파일 로드 (dotenv 없이 직접 파싱)
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ .env 파일이 없습니다. .env.example을 복사해서 API 키를 입력하세요.');
    process.exit(1);
  }
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  lines.forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length) process.env[key.trim()] = val.join('=').trim();
  });
}

loadEnv();

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY || API_KEY === 'your-api-key-here') {
  console.error('❌ ANTHROPIC_API_KEY가 설정되지 않았습니다. .env 파일을 확인하세요.');
  process.exit(1);
}

// ads/google-meta-rules.md 읽어서 system prompt에 포함
const RULES_PATH = path.join(__dirname, 'ads', 'google-meta-rules.md');
const RULES_CONTENT = fs.existsSync(RULES_PATH)
  ? fs.readFileSync(RULES_PATH, 'utf-8')
  : '';

const SYSTEM_PROMPT = `당신은 Google Ads와 Meta Ads 전문 분석가입니다.
사용자가 광고 계정 데이터를 제공하면 아래 규칙에 따라 분석하고,
반드시 섹션 4의 JSON 형식으로만 응답하세요. JSON 외 다른 텍스트 없음.

${RULES_CONTENT}`;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  // 헬스체크
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, CORS_HEADERS);
    res.end(JSON.stringify({ status: 'ok', model: 'claude-sonnet-4-6' }));
    return;
  }

  // 분석 엔드포인트
  if (req.method === 'POST' && req.url === '/analyze') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        res.writeHead(400, CORS_HEADERS);
        res.end(JSON.stringify({ error: '잘못된 JSON 형식입니다.' }));
        return;
      }

      const { platform, data } = payload;
      if (!platform || !data) {
        res.writeHead(400, CORS_HEADERS);
        res.end(JSON.stringify({ error: 'platform과 data 필드가 필요합니다.' }));
        return;
      }

      const userMessage = `플랫폼: ${platform.toUpperCase()}\n\n광고 데이터:\n${typeof data === 'string' ? data : JSON.stringify(data, null, 2)}`;

      const requestBody = JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      });

      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(requestBody),
        },
      };

      const apiReq = https.request(options, apiRes => {
        let responseBody = '';
        apiRes.on('data', chunk => { responseBody += chunk; });
        apiRes.on('end', () => {
          try {
            const parsed = JSON.parse(responseBody);
            if (parsed.error) {
              res.writeHead(502, CORS_HEADERS);
              res.end(JSON.stringify({ error: `API 오류: ${parsed.error.message}` }));
              return;
            }
            // Claude 응답에서 JSON 추출
            const text = parsed.content?.[0]?.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
              res.writeHead(502, CORS_HEADERS);
              res.end(JSON.stringify({ error: 'Claude 응답에서 JSON을 찾을 수 없습니다.', raw: text }));
              return;
            }
            const result = JSON.parse(jsonMatch[0]);
            res.writeHead(200, CORS_HEADERS);
            res.end(JSON.stringify(result));
          } catch (e) {
            res.writeHead(502, CORS_HEADERS);
            res.end(JSON.stringify({ error: '응답 파싱 실패', detail: e.message }));
          }
        });
      });

      apiReq.on('error', e => {
        res.writeHead(503, CORS_HEADERS);
        res.end(JSON.stringify({ error: `API 연결 실패: ${e.message}` }));
      });

      apiReq.write(requestBody);
      apiReq.end();
    });
    return;
  }

  res.writeHead(404, CORS_HEADERS);
  res.end(JSON.stringify({ error: '엔드포인트를 찾을 수 없습니다.' }));
});

const PORT = process.env.PROXY_PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n✅ Ads 프록시 서버 실행 중`);
  console.log(`   http://localhost:${PORT}/health  — 상태 확인`);
  console.log(`   http://localhost:${PORT}/analyze — 분석 엔드포인트`);
  console.log(`\n   대시보드를 Live Server로 열면 자동 연결됩니다.\n`);
});

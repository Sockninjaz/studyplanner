const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});
req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});
req.write(JSON.stringify({
  messages: [{role: 'user', content: 'test'}],
  examId: '674b0edaa424a18e00000000',
  aiIntegration: 'gpt-4o-mini'
}));
req.end();

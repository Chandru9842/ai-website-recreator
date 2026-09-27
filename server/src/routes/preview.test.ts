import http from 'http';
import { createApp } from '../app';

async function testPreview() {
  console.log('====================================================');
  console.log('  EXPRESS STATIC PREVIEW ROUTE TESTS                ');
  console.log('====================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Server listening on ${baseUrl} for preview testing...`);

  // Test 1: Redirect /preview/hackernews -> /preview/hackernews/
  const res1 = await fetch(`${baseUrl}/preview/hackernews`, { redirect: 'manual' });
  if (res1.status !== 301 || !res1.headers.get('location')?.endsWith('/preview/hackernews/')) {
    throw new Error(`Test 1 Failed: Expected 301 redirect to /preview/hackernews/, got ${res1.status} (location: ${res1.headers.get('location')})`);
  }
  console.log('✅ Test 1 Passed: Trailing slash redirect (/preview/hackernews -> /preview/hackernews/)');

  // Test 2: Serve index.html with relative assets
  const res2 = await fetch(`${baseUrl}/preview/hackernews/`);
  if (res2.status !== 200) {
    throw new Error(`Test 2 Failed: Expected 200, got ${res2.status}`);
  }
  const text2 = await res2.text();
  if (!text2.includes('<div id="root">')) {
    throw new Error('Test 2 Failed: index.html missing <div id="root">');
  }
  if (!text2.includes('./assets/')) {
    throw new Error('Test 2 Failed: index.html missing relative ./assets/ link');
  }
  console.log('✅ Test 2 Passed: Served dist/index.html with 200 OK and relative asset references');

  // Test 3: Path traversal rejection
  const res3 = await fetch(`${baseUrl}/preview/..%2f..%2fpackage.json`);
  if (res3.status !== 400 && res3.status !== 404) {
    throw new Error(`Test 3 Failed: Expected 400 or 404 for path traversal, got ${res3.status}`);
  }
  console.log('✅ Test 3 Passed: Security check rejected path traversal');

  // Test 4: Unknown project returns 404
  const res4 = await fetch(`${baseUrl}/preview/nonexistent_project_99999/`);
  if (res4.status !== 404) {
    throw new Error(`Test 4 Failed: Expected 404 for unknown project, got ${res4.status}`);
  }
  console.log('✅ Test 4 Passed: Non-existent project returns 404 cleanly');

  server.close();
  console.log('\n====================================================');
  console.log('  ALL PREVIEW ROUTE TESTS PASSED SUCCESSFULLY! ✅    ');
  console.log('====================================================\n');
}

testPreview().catch((err) => {
  console.error('❌ Preview test error:', err);
  process.exit(1);
});

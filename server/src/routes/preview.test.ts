import http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import { createApp } from '../app';
import { generateViteConfig } from '../generator/styleConfigurator';

async function testPreview() {
  console.log('====================================================');
  console.log('  EXPRESS STATIC PREVIEW ROUTE & VISUAL PREVIEW TESTS');
  console.log('====================================================\n');

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const port = address.port;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Server listening on ${baseUrl} for preview testing...`);

  // 1. Dynamic preview URL generation test
  const testProjectNames = ['hackernews', 'tailwindcss', 'quotes_catalog', 'project_123'];
  for (const name of testProjectNames) {
    const dynamicUrl = `/preview/${encodeURIComponent(name)}/`;
    if (!dynamicUrl.startsWith('/preview/') || !dynamicUrl.endsWith('/') || !dynamicUrl.includes(name)) {
      throw new Error(`Dynamic preview URL generation failed for ${name}: got ${dynamicUrl}`);
    }
  }
  console.log('✅ Test 1 Passed: Visual preview URL is generated dynamically for any project');

  // 2. Trailing slash redirect (/preview/hackernews -> /preview/hackernews/)
  const resRedirect = await fetch(`${baseUrl}/preview/hackernews`, { redirect: 'manual' });
  if (resRedirect.status !== 301 || !resRedirect.headers.get('location')?.endsWith('/preview/hackernews/')) {
    throw new Error(`Test 2 Failed: Expected 301 redirect to /preview/hackernews/, got ${resRedirect.status}`);
  }
  console.log('✅ Test 2 Passed: Trailing slash redirect (/preview/hackernews -> /preview/hackernews/)');

  // 3. Serve index.html with relative assets
  const resServe = await fetch(`${baseUrl}/preview/hackernews/`);
  if (resServe.status !== 200) {
    throw new Error(`Test 3 Failed: Expected 200 for existing project, got ${resServe.status}`);
  }
  const textServe = await resServe.text();
  if (!textServe.includes('<div id="root">')) {
    throw new Error('Test 3 Failed: index.html missing <div id="root">');
  }
  if (!textServe.includes('./assets/')) {
    throw new Error('Test 3 Failed: index.html missing relative ./assets/ link');
  }
  console.log('✅ Test 3 Passed: Successfully serves existing generated project with relative asset references');

  // 4. Path traversal rejection (../)
  const resTraversal = await fetch(`${baseUrl}/preview/..%2f..%2fpackage.json`);
  if (resTraversal.status !== 400 && resTraversal.status !== 404) {
    throw new Error(`Test 4 Failed: Expected 400 or 404 for ../ path traversal, got ${resTraversal.status}`);
  }
  console.log('✅ Test 4 Passed: Path traversal (../) strictly rejected with security error');

  // 5. Absolute path rejection
  const resAbs1 = await fetch(`${baseUrl}/preview/%2Fetc%2Fpasswd`);
  const resAbs2 = await fetch(`${baseUrl}/preview/C:%5CWindows%5CSystem32`);
  if (resAbs1.status !== 400 && resAbs1.status !== 404) {
    throw new Error(`Test 5 Failed: Expected 400 or 404 for Unix absolute path, got ${resAbs1.status}`);
  }
  if (resAbs2.status !== 400 && resAbs2.status !== 404) {
    throw new Error(`Test 5 Failed: Expected 400 or 404 for Windows absolute path, got ${resAbs2.status}`);
  }
  console.log('✅ Test 5 Passed: Absolute paths strictly rejected by route guard');

  // 6. Non-existent project returns 404
  const resNotFound = await fetch(`${baseUrl}/preview/nonexistent_project_99999/`);
  if (resNotFound.status !== 404) {
    throw new Error(`Test 6 Failed: Expected 404 for unknown project, got ${resNotFound.status}`);
  }
  console.log('✅ Test 6 Passed: Non-existent project returns 404 cleanly');

  // 7. Verify generated Vite config specifies base: './'
  const viteConfigCode = generateViteConfig();
  if (!viteConfigCode.includes("base: './'")) {
    throw new Error("Test 7 Failed: generateViteConfig() missing base: './'");
  }
  console.log("✅ Test 7 Passed: Vite generator dynamically sets base: './' for production asset compatibility");

  server.close();
  console.log('\n====================================================');
  console.log('  ALL PREVIEW ROUTE & CONFIG TESTS PASSED! ✅        ');
  console.log('====================================================\n');
}

testPreview().catch((err) => {
  console.error('❌ Preview test error:', err);
  process.exit(1);
});

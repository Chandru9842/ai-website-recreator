import { createApp } from '../app';
import * as path from 'path';

async function testApiValidation() {
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3001;

  try {
    const testProjectDir = path.resolve(__dirname, '../../../output/test_projects/healing_test');
    console.log(`Testing POST /api/validate with project: ${testProjectDir}`);

    const res = await fetch(`http://127.0.0.1:${port}/api/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectPath: testProjectDir }),
    });

    const json = (await res.json()) as any;
    console.log('HTTP Status:', res.status);
    console.log('Success:', json.success);
    console.log('Attempts:', json.attempts);
    console.log('Diagnostics:', json.diagnostics.length);
    console.log('Fixed Files:', json.fixedFiles);

    if (res.status === 200 && json.success === true && typeof json.attempts === 'number') {
      console.log('✅ POST /api/validate verified successfully!');
    } else {
      throw new Error(`API returned unexpected response: ${JSON.stringify(json)}`);
    }
  } finally {
    server.close();
  }
}

testApiValidation().catch((err) => {
  console.error('API validation test failed:', err);
  process.exit(1);
});

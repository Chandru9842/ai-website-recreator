import { createApp } from '../app';
import * as path from 'path';

async function testApiModify() {
  const app = createApp();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3001;

  try {
    const testProjectDir = path.resolve(__dirname, '../../../output/test_projects/modifier_test');
    console.log(`Testing POST /api/modify on: ${testProjectDir}`);

    const res = await fetch(`http://127.0.0.1:${port}/api/modify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectPath: testProjectDir,
        instruction: 'Make the navbar sticky',
      }),
    });

    const json = (await res.json()) as any;
    console.log('HTTP Status:', res.status);
    console.log('Success:', json.success);
    console.log('Modified Files:', json.modifiedFiles);
    console.log('Validation Success:', json.validation?.success);
    console.log('History Count:', json.history?.length);

    if (res.status === 200 && json.success === true && json.modifiedFiles.includes('src/sections/Navbar.tsx')) {
      console.log('✅ POST /api/modify verified successfully!');
    } else {
      throw new Error(`API returned unexpected response: ${JSON.stringify(json)}`);
    }
  } finally {
    server.close();
  }
}

testApiModify().catch((err) => {
  console.error('API modify test failed:', err);
  process.exit(1);
});

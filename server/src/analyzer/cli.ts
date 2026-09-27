import * as fs from 'fs';
import * as path from 'path';
import { analyzeWebsite } from './index';

async function runCli() {
  const args = process.argv.slice(2);
  const targetUrl = args[0] || 'https://news.ycombinator.com';

  console.log('====================================================');
  console.log('  AI WEBSITE RECREATOR - PLAYWRIGHT ANALYZER TEST   ');
  console.log('====================================================');
  console.log(`Target URL: ${targetUrl}\n`);

  const startTime = Date.now();

  try {
    const data = await analyzeWebsite(targetUrl, {
      onProgress: (event) => {
        const bar = '='.repeat(Math.floor(event.progress / 5)).padEnd(20, ' ');
        console.log(`[${bar}] ${event.progress.toString().padStart(3, ' ')}% | ${event.message}`);
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n====================================================');
    console.log(`  ANALYSIS COMPLETE (${elapsed}s)`);
    console.log('====================================================');

    console.log(`\n📌 METADATA:`);
    console.log(`  Title:       ${data.metadata.title}`);
    console.log(`  Description: ${data.metadata.description || 'N/A'}`);
    console.log(`  Viewport:    ${data.metadata.viewport.width}x${data.metadata.viewport.height}`);

    console.log(`\n🎨 COLOR PALETTE:`);
    console.log(`  Primary:     ${data.colors.primary}`);
    console.log(`  Background:  ${data.colors.background}`);
    console.log(`  Text:        ${data.colors.textPrimary}`);
    console.log(`  Top Palette: ${data.colors.palette.slice(0, 5).map((c) => `${c.hex} (${c.role})`).join(', ')}`);

    console.log(`\n🔤 TYPOGRAPHY:`);
    console.log(`  Heading Font: ${data.typography.headingFont}`);
    console.log(`  Body Font:    ${data.typography.bodyFont}`);
    console.log(`  Scale Tokens: ${data.typography.scale.length} tokens extracted`);

    console.log(`\n🧭 NAVIGATION:`);
    console.log(`  Brand:       ${data.navigation.brand.text || data.navigation.brand.logoUrl || 'Detected'}`);
    console.log(`  Sticky:      ${data.navigation.isSticky ? 'Yes' : 'No'}`);
    console.log(`  Links (${data.navigation.links.length}): ${data.navigation.links.map((l) => l.text).join(' | ')}`);
    console.log(`  CTAs (${data.navigation.ctaButtons.length}):  ${data.navigation.ctaButtons.map((b) => b.text).join(', ') || 'None'}`);

    console.log(`\n📦 SECTIONS DETECTED (${data.sections.length}):`);
    data.sections.forEach((sec, idx) => {
      console.log(`  ${idx + 1}. [${sec.type.toUpperCase()}] ${sec.name}`);
      if (sec.heading) console.log(`     Heading: "${sec.heading}"`);
      if (sec.items.length > 0) console.log(`     Items: ${sec.items.length} cards/items`);
      if (sec.buttons.length > 0) console.log(`     Buttons: ${sec.buttons.map((b) => b.text).join(', ')}`);
    });

    console.log(`\n🖼️  ASSETS:`);
    console.log(`  Total Assets: ${data.assets.length} (${data.assets.filter((a) => a.type === 'image').length} images, ${data.assets.filter((a) => a.type === 'svg').length} svgs, ${data.assets.filter((a) => a.type === 'logo').length} logos)`);

    console.log(`\n📱 RESPONSIVE BREAKPOINTS:`);
    console.log(`  Mobile Hamburger: ${data.responsive.mobile.hamburgerDetected ? 'Detected' : 'Not detected'}`);
    console.log(`  Layout Shifts:    ${data.responsive.mobile.layoutShifts.join('; ') || 'Standard responsive flow'}`);

    // Save output sample
    const outDir = path.resolve(__dirname, '../../../output');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }
    const outputPath = path.join(outDir, 'analysis_sample.json');
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`\n💾 Saved detailed JSON output to: ${outputPath}\n`);

  } catch (err: any) {
    console.error('\n❌ Analysis failed:', err.message);
    process.exit(1);
  }
}

runCli();

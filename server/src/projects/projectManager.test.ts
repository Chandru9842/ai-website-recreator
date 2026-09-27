import * as fs from 'fs';
import * as path from 'path';
import { ProjectManager } from './projectManager';
import { SnapshotManager } from './snapshotManager';

interface TestCaseResult {
  num: number;
  name: string;
  passed: boolean;
  details: string;
}

const results: TestCaseResult[] = [];

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  PROJECT MANAGEMENT + VERSION HISTORY TEST SUITE   ');
  console.log('====================================================\n');

  const outputBase = path.resolve(__dirname, '../../../output');
  const generatedDir = path.join(outputBase, 'generated_projects');
  const versionsDir = path.join(outputBase, 'project_versions');
  const hnSource = path.join(generatedDir, 'hackernews');

  // Staging identifiers for test isolation
  const projA_Id = 'test_project_alpha';
  const projA_Dir = path.join(generatedDir, projA_Id);
  const projDel_Id = 'test_project_to_delete';
  const projDel_Dir = path.join(generatedDir, projDel_Id);
  const projRestore_Id = 'test_project_restore';
  const projRestore_Dir = path.join(generatedDir, projRestore_Id);

  // Clean up any leftovers from prior runs
  for (const d of [projA_Dir, projDel_Dir, projRestore_Dir]) {
    if (fs.existsSync(d)) fs.rmSync(d, { recursive: true, force: true });
  }
  for (const id of [projA_Id, projDel_Id, projRestore_Id, 'test_project_alpha_copy', 'alpha_clone']) {
    const sDir = path.join(versionsDir, id);
    if (fs.existsSync(sDir)) fs.rmSync(sDir, { recursive: true, force: true });
  }

  // Initialize ProjectManager
  ProjectManager.init();

  // =========================================================================
  // TEST 1: CREATE PROJECT
  // =========================================================================
  console.log('🧪 TEST 1: Create project');
  try {
    fs.mkdirSync(projA_Dir, { recursive: true });
    fs.mkdirSync(path.join(projA_Dir, 'src'), { recursive: true });
    fs.writeFileSync(path.join(projA_Dir, 'src', 'App.tsx'), 'export default function App() { return <div>V1</div>; }');

    const created = ProjectManager.createProject({
      id: projA_Id,
      name: 'Test Project Alpha',
      originalUrl: 'https://alpha.example.com',
      projectPath: projA_Dir,
      status: 'passed',
    });

    assert(created.id === projA_Id, `Expected ID ${projA_Id}, got ${created.id}`);
    assert(created.name === 'Test Project Alpha', `Name mismatch: ${created.name}`);
    assert(created.originalUrl === 'https://alpha.example.com', 'Original URL mismatch');
    assert(created.currentVersion === 1, `Expected currentVersion 1, got ${created.currentVersion}`);
    assert(created.versions.length === 1, `Expected 1 version, got ${created.versions.length}`);
    assert(created.status === 'passed', `Expected passed status, got ${created.status}`);

    results.push({
      num: 1,
      name: 'Create project',
      passed: true,
      details: `Created ${created.id} with version v1`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 1, name: 'Create project', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 2: PERSIST PROJECT REGISTRY
  // =========================================================================
  console.log('🧪 TEST 2: Persist project registry');
  try {
    const registryPath = path.resolve(outputBase, 'projects.json');
    assert(fs.existsSync(registryPath), 'projects.json does not exist on disk');

    const content = fs.readFileSync(registryPath, 'utf-8');
    const parsed = JSON.parse(content);
    assert(Array.isArray(parsed), 'Registry JSON is not an array');
    const found = parsed.find((p: any) => p.id === projA_Id);
    assert(!!found, `Project ${projA_Id} not found in persisted registry`);
    assert(found.name === 'Test Project Alpha', 'Persisted name mismatch');

    results.push({
      num: 2,
      name: 'Persist project registry',
      passed: true,
      details: `Registry verified on disk with ${parsed.length} entries`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 2, name: 'Persist project registry', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 3: RETRIEVE PROJECTS
  // =========================================================================
  console.log('🧪 TEST 3: Retrieve projects');
  try {
    const all = ProjectManager.getAllProjects();
    assert(Array.isArray(all) && all.length > 0, 'getAllProjects() returned empty array');

    const single = ProjectManager.getProject(projA_Id);
    assert(!!single, `getProject(${projA_Id}) returned null`);
    assert(single!.id === projA_Id, 'Retrieved ID mismatch');

    const byPath = ProjectManager.getProjectByPath(projA_Dir);
    assert(!!byPath && byPath.id === projA_Id, 'getProjectByPath failed to match');

    results.push({
      num: 3,
      name: 'Retrieve projects',
      passed: true,
      details: `Successfully retrieved project by ID and path`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 3, name: 'Retrieve projects', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 4: RENAME PROJECT
  // =========================================================================
  console.log('🧪 TEST 4: Rename project');
  try {
    const updated = ProjectManager.updateProject(projA_Id, {
      name: 'Renamed Alpha Website',
    });

    assert(updated.name === 'Renamed Alpha Website', `Expected new name, got ${updated.name}`);
    const fetched = ProjectManager.getProject(projA_Id);
    assert(fetched?.name === 'Renamed Alpha Website', 'Registry does not reflect updated name');

    results.push({
      num: 4,
      name: 'Rename project',
      passed: true,
      details: `Renamed to "${updated.name}"`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 4, name: 'Rename project', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 5: DUPLICATE PROJECT
  // =========================================================================
  console.log('🧪 TEST 5: Duplicate project');
  try {
    const duplicated = ProjectManager.duplicateProject(projA_Id, 'Alpha Clone');

    assert(duplicated.id !== projA_Id, 'Duplicated project must receive a unique ID');
    assert(duplicated.projectPath !== projA_Dir, 'Duplicated project must have its own path');
    assert(fs.existsSync(duplicated.projectPath), 'Duplicated directory does not exist');
    assert(
      fs.existsSync(path.join(duplicated.projectPath, 'src', 'App.tsx')),
      'Source files not copied to duplicated project'
    );
    assert(duplicated.currentVersion === 1, 'Duplicated project should start at v1');

    results.push({
      num: 5,
      name: 'Duplicate project',
      passed: true,
      details: `Duplicated ${projA_Id} to ${duplicated.id} with separate directory`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 5, name: 'Duplicate project', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 6: CREATE VERSION
  // =========================================================================
  console.log('🧪 TEST 6: Create version');
  try {
    // Modify a file in projA
    fs.writeFileSync(
      path.join(projA_Dir, 'src', 'App.tsx'),
      'export default function App() { return <div>V2 Modified</div>; }'
    );

    const newVer = ProjectManager.createVersion(
      projA_Id,
      'Added dark mode toggle',
      ['src/App.tsx'],
      { success: true, diagnosticsCount: 0 }
    );

    assert(newVer.version === 2, `Expected version 2, got ${newVer.version}`);
    assert(newVer.instruction === 'Added dark mode toggle', 'Instruction mismatch');

    const project = ProjectManager.getProject(projA_Id)!;
    assert(project.currentVersion === 2, `Project currentVersion mismatch: ${project.currentVersion}`);
    assert(project.versions.length === 2, `Expected 2 versions in history, got ${project.versions.length}`);
    assert(fs.existsSync(newVer.snapshotPath), `Snapshot directory does not exist at ${newVer.snapshotPath}`);

    results.push({
      num: 6,
      name: 'Create version',
      passed: true,
      details: `Created version v${newVer.version} and isolated snapshot`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 6, name: 'Create version', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 7: RESTORE VERSION (Using real buildable project)
  // =========================================================================
  console.log('🧪 TEST 7: Restore version');
  try {
    if (!fs.existsSync(hnSource)) {
      throw new Error(`Cannot run restore test: source hackernews project missing at ${hnSource}`);
    }

    // Set up buildable test project by copying hackernews
    fs.cpSync(hnSource, projRestore_Dir, { recursive: true });

    // Initialize in registry
    const appTsxPath = path.join(projRestore_Dir, 'src', 'App.tsx');
    const originalAppContent = fs.readFileSync(appTsxPath, 'utf-8');

    ProjectManager.createProject({
      id: projRestore_Id,
      name: 'Restore Test Project',
      projectPath: projRestore_Dir,
      status: 'passed',
    });

    // Create v2 modification
    const modifiedAppContent = originalAppContent.replace(
      'function App()',
      '/* Modified Version 2 Comment */\nfunction App()'
    );
    fs.writeFileSync(appTsxPath, modifiedAppContent, 'utf-8');

    ProjectManager.createVersion(
      projRestore_Id,
      'Added comment to App.tsx',
      ['src/App.tsx'],
      { success: true }
    );

    // Now restore back to v1
    const restoreResult = await ProjectManager.restoreVersion(projRestore_Id, 1);
    assert(restoreResult.success, `Restore failed: ${restoreResult.error}`);

    const restoredContent = fs.readFileSync(appTsxPath, 'utf-8');
    assert(
      !restoredContent.includes('/* Modified Version 2 Comment */'),
      'Restored App.tsx still contains v2 modification'
    );

    const pAfterRestore = ProjectManager.getProject(projRestore_Id)!;
    assert(pAfterRestore.currentVersion === 3, 'Restore entry should be recorded as next version v3');
    assert(pAfterRestore.status === 'passed', 'Status after restore should be passed');

    results.push({
      num: 7,
      name: 'Restore version',
      passed: true,
      details: `Restored to v1 successfully; validated with Module 4; recorded as v${pAfterRestore.currentVersion}`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 7, name: 'Restore version', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 8: FAILED RESTORE ROLLBACK
  // =========================================================================
  console.log('🧪 TEST 8: Failed restore rollback');
  try {
    const appTsxPath = path.join(projRestore_Dir, 'src', 'App.tsx');
    const preRestoreContent = fs.readFileSync(appTsxPath, 'utf-8');

    // Create a corrupted version snapshot that will deliberately fail TypeScript compilation
    const corruptVerNum = 99;
    const corruptSnapDir = path.join(versionsDir, projRestore_Id, `v${corruptVerNum}`);
    fs.mkdirSync(path.join(corruptSnapDir, 'src'), { recursive: true });
    fs.writeFileSync(
      path.join(corruptSnapDir, 'src', 'App.tsx'),
      'export default function BrokenSyntax( {{{ invalid typescript error'
    );
    // Write manifest
    fs.writeFileSync(
      path.join(corruptSnapDir, 'snapshot.json'),
      JSON.stringify({
        version: corruptVerNum,
        projectId: projRestore_Id,
        timestamp: Date.now(),
        instruction: 'Intentional corrupt test snapshot',
        files: ['src/App.tsx'],
      })
    );

    // Register corrupt version in metadata
    const projMeta = ProjectManager.getProject(projRestore_Id)!;
    projMeta.versions.push({
      version: corruptVerNum,
      instruction: 'Corrupt snapshot test',
      timestamp: Date.now(),
      modifiedFiles: ['src/App.tsx'],
      validation: { success: true },
      snapshotPath: corruptSnapDir,
    });
    ProjectManager.saveRegistry();

    // Attempt to restore corrupt version - should fail and rollback!
    const failedRestore = await ProjectManager.restoreVersion(projRestore_Id, corruptVerNum);
    assert(!failedRestore.success, 'Restore of corrupt code should have failed validation');
    assert(!!failedRestore.diagnostics, 'Diagnostics should be provided on failed restore');

    // Verify rollback: current App.tsx MUST NOT be the broken file!
    const postRollbackContent = fs.readFileSync(appTsxPath, 'utf-8');
    assert(
      postRollbackContent === preRestoreContent,
      'Rollback failed: active project was left in broken state!'
    );

    results.push({
      num: 8,
      name: 'Failed restore rollback',
      passed: true,
      details: 'Restoration failure caught by Module 4 and project safely rolled back to pre-restore state',
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 8, name: 'Failed restore rollback', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 9: DELETE PROJECT
  // =========================================================================
  console.log('🧪 TEST 9: Delete project');
  try {
    fs.mkdirSync(projDel_Dir, { recursive: true });
    ProjectManager.createProject({
      id: projDel_Id,
      name: 'Project To Delete',
      projectPath: projDel_Dir,
    });

    assert(fs.existsSync(projDel_Dir), 'Project dir should exist before delete');
    const delResult = ProjectManager.deleteProject(projDel_Id);
    assert(delResult.success, 'Delete returned failure');
    assert(!fs.existsSync(projDel_Dir), 'Project dir was not deleted from disk');
    assert(ProjectManager.getProject(projDel_Id) === null, 'Project still in registry after delete');

    results.push({
      num: 9,
      name: 'Delete project',
      passed: true,
      details: `Safely deleted ${projDel_Id} and removed registry record`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 9, name: 'Delete project', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 10: PATH TRAVERSAL REJECTION
  // =========================================================================
  console.log('🧪 TEST 10: Path traversal rejection');
  try {
    const malicious = [
      '../../secret',
      '../hackernews',
      'foo/../../bar',
      'proj/../../../etc/passwd',
      'test_proj\0nullbyte',
    ];

    let rejectedCount = 0;
    for (const bad of malicious) {
      try {
        SnapshotManager.validateProjectId(bad);
      } catch {
        rejectedCount++;
      }
    }
    assert(rejectedCount === malicious.length, `Expected ${malicious.length} rejections, got ${rejectedCount}`);

    results.push({
      num: 10,
      name: 'Path traversal rejection',
      passed: true,
      details: `Rejected all ${malicious.length} traversal vectors`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 10, name: 'Path traversal rejection', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 11: ABSOLUTE PATH REJECTION
  // =========================================================================
  console.log('🧪 TEST 11: Absolute path rejection');
  try {
    const absolutePaths = [
      'C:\\Windows\\System32',
      'C:/Users/Admin/Secret',
      '/etc/passwd',
      '/var/log/syslog',
      'D:\\output\\projects',
    ];

    let rejectedCount = 0;
    for (const p of absolutePaths) {
      try {
        SnapshotManager.validateProjectId(p);
      } catch {
        rejectedCount++;
      }
    }
    assert(rejectedCount === absolutePaths.length, `Expected ${absolutePaths.length} rejections, got ${rejectedCount}`);

    results.push({
      num: 11,
      name: 'Absolute path rejection',
      passed: true,
      details: `Rejected all ${absolutePaths.length} arbitrary absolute paths`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 11, name: 'Absolute path rejection', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 12: REGISTRY PERSISTENCE AFTER RELOAD
  // =========================================================================
  console.log('🧪 TEST 12: Registry persistence after reload');
  try {
    // Re-initialize registry from disk
    ProjectManager.init();
    const reloaded = ProjectManager.getProject(projA_Id);

    assert(!!reloaded, `Project ${projA_Id} missing after re-initialization`);
    assert(reloaded!.name === 'Renamed Alpha Website', 'Renamed title lost after reload');
    assert(reloaded!.versions.length === 2, `Expected 2 versions after reload, got ${reloaded!.versions.length}`);

    results.push({
      num: 12,
      name: 'Registry persistence after reload',
      passed: true,
      details: 'Registry survived full re-initialization from output/projects.json',
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 12, name: 'Registry persistence after reload', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 13: SNAPSHOT ISOLATION
  // =========================================================================
  console.log('🧪 TEST 13: Snapshot isolation');
  try {
    const v1Dir = path.join(versionsDir, projA_Id, 'v1');
    assert(fs.existsSync(v1Dir), `v1 snapshot dir missing at ${v1Dir}`);

    // Read v1 snapshot file
    const snapFile = path.join(v1Dir, 'src', 'App.tsx');
    const snapContent = fs.readFileSync(snapFile, 'utf-8');

    // Mutate the active project file
    const activeFile = path.join(projA_Dir, 'src', 'App.tsx');
    fs.writeFileSync(activeFile, '// Completely mutated active code');

    // Verify snapshot file did NOT mutate
    const snapContentAfter = fs.readFileSync(snapFile, 'utf-8');
    assert(snapContent === snapContentAfter, 'Active directory mutation corrupted the stored snapshot!');

    results.push({
      num: 13,
      name: 'Snapshot isolation',
      passed: true,
      details: 'Snapshots are fully immutable and isolated from subsequent live project edits',
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 13, name: 'Snapshot isolation', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // =========================================================================
  // TEST 14: VERSION ORDERING
  // =========================================================================
  console.log('🧪 TEST 14: Version ordering');
  try {
    // Create v3 and v4 on projA
    ProjectManager.createVersion(projA_Id, 'Make navbar sticky', ['src/Navbar.tsx'], { success: true });
    ProjectManager.createVersion(projA_Id, 'Change primary color to blue', ['tailwind.config.js'], { success: true });

    const p = ProjectManager.getProject(projA_Id)!;
    const versionNumbers = p.versions.map((v) => v.version);

    // Verify versions are [1, 2, 3, 4]
    for (let i = 0; i < versionNumbers.length; i++) {
      assert(versionNumbers[i] === i + 1, `Version at index ${i} is ${versionNumbers[i]}, expected ${i + 1}`);
    }

    // Verify timestamps are non-decreasing
    for (let i = 1; i < p.versions.length; i++) {
      assert(
        p.versions[i].timestamp >= p.versions[i - 1].timestamp,
        `Version timestamp inversion between v${p.versions[i - 1].version} and v${p.versions[i].version}`
      );
    }

    results.push({
      num: 14,
      name: 'Version ordering',
      passed: true,
      details: `Chronological sequence verified for versions: [${versionNumbers.join(', ')}]`,
    });
    console.log('   ✅ Passed\n');
  } catch (err: any) {
    results.push({ num: 14, name: 'Version ordering', passed: false, details: err.message });
    console.error(`   ❌ Failed: ${err.message}\n`);
  }

  // Clean up test projects
  try {
    ProjectManager.deleteProject(projA_Id);
    ProjectManager.deleteProject('alpha_clone');
    ProjectManager.deleteProject(projRestore_Id);
  } catch {}

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log('====================================================');
  console.log('                 TEST SUMMARY                       ');
  console.log('====================================================');
  let allPassed = true;
  for (const r of results) {
    const symbol = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${symbol} [Test ${r.num.toString().padStart(2, '0')}] ${r.name.padEnd(35)} : ${r.details}`);
    if (!r.passed) allPassed = false;
  }
  console.log('====================================================');

  if (!allPassed) {
    console.error('\n❌ One or more Project Management tests failed.\n');
    process.exit(1);
  } else {
    console.log(`\n🎉 All 14 Project Management tests passed successfully!\n`);
    process.exit(0);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test suite error:', err);
  process.exit(1);
});

# Project Management & Version History Architecture

The **Project Management & Version History System** provides a production-grade, stateful lifecycle engine for all websites recreated and modified by the AI Website Recreator. It persists project metadata, isolates restorable source snapshots, manages chronological version history, and guarantees atomic rollbacks on build validation failure.

---

## 1. High-Level Architecture

```
                                +-----------------------------+
                                |      Web Dashboard UI       |
                                | (Projects, Preview, History)|
                                +--------------+--------------+
                                               |
                                     REST API  |
                                               v
                          +-------------------------------------+
                          |   Express Projects Router (/api)    |
                          +--------------------+----------------+
                                               |
              +--------------------------------+--------------------------------+
              |                                                                 |
              v                                                                 v
+-------------------------------+                             +-----------------------------------+
|      ProjectManager           |                             |        SnapshotManager            |
|  - Registry state management  |                             |  - Safe isolated file copying     |
|  - output/projects.json       |                             |  - output/project_versions/       |
|  - Auto-discovery on boot     |                             |  - Path traversal validation      |
+-------------+-----------------+                             +-----------------+-----------------+
              |                                                                 |
              +--------------------------------+--------------------------------+
                                               |
                                               v
                             +-----------------------------------+
                             |   Module 4 Validator & Auto-Heal  |
                             |   (TypeScript + Vite Build Check) |
                             +-----------------+-----------------+
                                               |
                      +------------------------+------------------------+
                      | (Pass)                                          | (Fail)
                      v                                                 v
           Commit Version / Restore                          Atomic Rollback to Pre-Restore
```

### Storage Layout

```
output/
├── projects.json                      # Persistent registry metadata
├── generated_projects/                # Active project workspaces
│   ├── hackernews/
│   ├── tailwindcss/
│   └── quotes_catalog/
└── project_versions/                  # Immutable snapshot storage
    ├── hackernews/
    │   ├── v1/
    │   │   ├── snapshot.json          # Manifest & file hashes
    │   │   ├── src/
    │   │   └── package.json
    │   ├── v2/
    │   └── v3/
    └── tailwindcss/
        └── v1/
```

---

## 2. Project Metadata Schema

Each project is tracked in `output/projects.json` with the following contract:

```typescript
export interface ProjectVersion {
  version: number;
  instruction: string;
  timestamp: number;
  modifiedFiles: string[];
  validation: {
    success: boolean;
    diagnosticsCount?: number;
  };
  snapshotPath: string;
}

export interface ProjectMetadata {
  id: string;               // URL-safe sanitized identifier (e.g., 'hackernews')
  name: string;             // Human-readable title (e.g., 'Hacker News')
  originalUrl: string;      // Public URL analyzed by Module 1
  projectPath: string;      // Absolute filesystem location under generated_projects
  previewUrl: string;       // Static preview URL: /preview/<id>/
  createdAt: number;        // Epoch millisecond creation timestamp
  updatedAt: number;        // Epoch millisecond last modification timestamp
  currentVersion: number;   // Active version number
  versions: ProjectVersion[]; // Chronological version timeline
  status: 'passed' | 'failed' | 'generating' | 'healing';
}
```

---

## 3. REST API Endpoints

All endpoints are mounted under `/api/projects`:

| Method | Endpoint | Description | Request Body | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/projects` | List all projects sorted by `updatedAt` descending | None | `{ success: true, data: ProjectMetadata[] }` |
| `GET` | `/api/projects/:id` | Retrieve project details, version timeline, and source files | None | `{ success: true, data: ProjectMetadata & { files } }` |
| `POST` | `/api/projects` | Manually register/create a new project | `{ name, originalUrl, id?, projectPath? }` | `{ success: true, data: ProjectMetadata }` |
| `PATCH` | `/api/projects/:id` | Update project metadata (e.g., rename, status) | `{ name?, status?, previewUrl? }` | `{ success: true, data: ProjectMetadata }` |
| `DELETE` | `/api/projects/:id` | Safely remove project directory, snapshots, and registry entry | None | `{ success: true, message: string }` |
| `POST` | `/api/projects/:id/duplicate` | Clone project into an isolated workspace with new history | `{ newName? }` | `{ success: true, data: ProjectMetadata }` |
| `POST` | `/api/projects/:id/restore/:version` | Restore project to prior snapshot with build validation | None | `{ success: true, data: ProjectMetadata, message: string }` |

---

## 4. Project Lifecycle

1. **Autonomous Creation**:
   - When the user runs the generation pipeline (`Analyzer` → `UI Spec` → `Generator` → `Validator`), `POST /api/generate` finishes by registering the project in `ProjectManager`.
   - An initial snapshot `v1` ("Initial generation") is automatically captured.
   - The project is persisted to `output/projects.json` and immediately available in the dashboard.
2. **Auto-Discovery on Boot**:
   - If the server restarts or unindexed project folders exist in `output/generated_projects`, `ProjectManager.init()` auto-discovers them, checks for built assets in `dist/`, registers `v1`, and writes to `output/projects.json`.
3. **Renaming**:
   - `PATCH /api/projects/:id` updates project display name and `updatedAt` timestamp while preserving files and directory pointers.
4. **Duplication**:
   - `POST /api/projects/:id/duplicate` creates an independent copy under `output/generated_projects/<new_id>`.
   - Generates a unique ID, clones source code, sets `currentVersion: 1`, and initializes an isolated snapshot directory. Duplicates never share mutable files.
5. **Safe Deletion**:
   - `DELETE /api/projects/:id` verifies the path strictly resides in `output/generated_projects`, deletes project source files, deletes associated snapshot directories in `output/project_versions/<id>`, and deletes the registry entry.

---

## 5. Version Lifecycle & Snapshot Strategy

### Targeted Modification Snapshots

1. When a user submits a natural-language instruction (Module 5), the modifier identifies and changes only the affected files.
2. After file modifications, Module 4 executes build validation (`tsc --noEmit` and `vite build`).
3. **Only upon successful validation**:
   - `SnapshotManager.createSnapshot()` captures a copy of the restorable source files (`src/`, `package.json`, `index.html`, `tailwind.config.js`, `vite.config.ts`, `tsconfig.json`).
   - Bulky non-source folders (`node_modules`, `dist`, `.git`) are strictly excluded to keep snapshots lightweight (~50KB per version).
   - A `snapshot.json` manifest is written with file metadata and timestamps.
   - A new `ProjectVersion` (`vN`) is appended to `project.versions`.
   - `project.currentVersion` is incremented, and `projects.json` is saved.
4. **If modification fails validation**:
   - The modifier automatically rolls back changes.
   - No version is added to the project registry.

---

## 6. Restore System & Rollback Guarantees

Restoring a previous version (`POST /api/projects/:id/restore/:version`) must never leave a project in an unbuildable or broken state:

```
[User triggers Restore v2]
         │
         ▼
[1. Verify ID & Version Exist]
         │
         ▼
[2. Create Staging Backup (.temp_restore_backups/backup_<id>_<time>)]
         │
         ▼
[3. Copy Snapshot v2 Files into Project Directory]
         │
         ▼
[4. Run Module 4 Validation (tsc --noEmit & vite build)]
         │
  ┌──────┴──────┐
  ▼             ▼
(PASSED)      (FAILED)
  │             │
  │             ├─► Copy files back from Staging Backup
  │             ├─► Clean up Staging Backup
  │             └─► Return 422 with structured diagnostics
  │
  ├─► Clean up Staging Backup
  ├─► Append new Version entry: "Restored to v2 (<instruction>)"
  ├─► Update currentVersion to next sequential version
  ├─► Update projects.json
  └─► Return 200 with updated project metadata & source files
```

---

## 7. Security & Path Traversal Protections

Project operations handle filesystem paths, requiring strict multi-layer security guards:

1. **ID Whitelist Validation**:
   - Project IDs are constrained to `/^[a-zA-Z0-9_\-]+$/`.
   - Any ID containing `..`, `/`, `\`, null bytes (`\0`), `.env`, `.git`, or hidden characters is immediately rejected with an HTTP 400 error.
2. **Absolute Path Prohibition**:
   - Clients cannot pass arbitrary absolute paths (`C:\Windows\System32`, `/etc/passwd`, etc.).
   - All filesystem paths are derived deterministically on the server from the trusted project ID.
3. **Directory Confinement (`GENERATED_PROJECTS_DIR` & `VERSIONS_DIR`)**:
   - Every resolved path is checked via `.startsWith(AUTHORIZED_ROOT)`.
   - Any attempt to escape the designated storage root throws a security error before any filesystem API is executed.

---

## 8. Dashboard User Interface

The frontend dashboard provides a comprehensive UI:
- **Projects Registry View**:
  - Search filter by project name, ID, or original URL.
  - Project Cards displaying Name (with inline rename), Original URL, Created Date, Last Modified Date, Current Version badge, and `BUILD PASSED` status indicator.
  - Action buttons: `[ Preview ]`, `[ Open ]`, `[ Duplicate ]`, `[ Delete ]`, and `[ Create New Project ]`.
- **Project Details View**:
  - Header: Name, Original URL, Status badge, and Current Version.
  - Three Primary Tabs:
    - **Visual Preview**: Responsive iframe with Desktop (100%), Tablet (768px), and Mobile (375px) viewport modes, Open in New Window button, and in-place Module 5 natural-language modifier.
    - **Code Inspector**: Interactive file tab selector (`src/App.tsx`, `Navbar.tsx`, etc.), full source viewer, and in-place modifier.
    - **History**: Vertical chronological version timeline displaying version number badges, instruction text, timestamps, modified file counts, and `[ Restore ]` buttons for all previous snapshots.

---

## 9. Testing & Verification

The test suite in `server/src/projects/projectManager.test.ts` exercises 14 verification scenarios:

```bash
npm run test:projects
```

### Verified Test Cases:
1. **Create project**: Validates initial metadata, status, version 1 creation, and snapshot staging.
2. **Persist project registry**: Verifies `output/projects.json` is formatted and written to disk.
3. **Retrieve projects**: Confirms retrieval by ID, path, and listing all sorted entries.
4. **Rename project**: Asserts in-place renaming and timestamp updates.
5. **Duplicate project**: Confirms unique ID generation, isolated directories, and distinct snapshot trees.
6. **Create version**: Validates version incrementing (`v2`), snapshot isolation, and history tracking.
7. **Restore version**: Tests real project restore with Module 4 `tsc` + `vite build` validation.
8. **Failed restore rollback**: Injects invalid code, catches compilation errors, verifies auto-healer bounds, and confirms rollback to the exact pre-restore state.
9. **Delete project**: Asserts full directory removal, snapshot tree deletion, and registry purge.
10. **Path traversal rejection**: Tests traversal vectors (`../../secret`, `foo/../../bar`, null bytes).
11. **Absolute path rejection**: Tests absolute system paths (`C:\Windows\System32`, `/etc/passwd`).
12. **Registry persistence after reload**: Verifies `ProjectManager.init()` loads state from disk.
13. **Snapshot isolation**: Verifies active directory modifications do not affect snapshot contents.
14. **Version ordering**: Confirms strict sequential versioning (`[1, 2, 3, 4]`) and non-decreasing timestamps.

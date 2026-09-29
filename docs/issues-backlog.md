# Tessera Engineering Backlog (60 Core Technical Issues)

Simplified task tracker for core development platform features (excluding AI).

---

## Domain 1: Workspace & File Explorer (Frontend & State)

### #1: Connect `@tessera/collaboration` Workspace Tree to Web UI File Explorer
- **GitHub**: [#522](https://github.com/Kushaal-k/Tessera/issues/522)
- **Target**: `apps/web` (`apps/web/src/App.tsx`, `apps/web/src/components/FileTree.tsx`)
- **Summary**: Replace the static dummy file (`📄 {FILE_NAMES[language]}`) in `App.tsx` with a reactive `FileTree` component. Subscribe to `workspace.onFilesChanged` and `workspace.onFoldersChanged`, compute the tree with `buildWorkspaceTree()`, and trigger active file selection on click.
- **Tasks**:
  - [x] Created GitHub issue [#522](https://github.com/Kushaal-k/Tessera/issues/522)
  - [x] Render nested folders with expand/collapse toggles
  - [x] Clicking a file triggers `onSelectFile` and updates active file state
  - [x] Tree updates reactively when files/folders change in Yjs
  - [x] Keyboard navigation support (Arrow keys)

---

### #2: Inline File and Folder Creation in File Explorer
- **GitHub**: [#523](https://github.com/Kushaal-k/Tessera/issues/523)
- **Target**: `apps/web` (`apps/web/src/components/FileTree.tsx`), `packages/collaboration`
- **Summary**: Add "+ File" and "+ Folder" buttons to the explorer header. Spawns an inline text input to create items via `workspace.createFile` / `workspace.createFolder` with duplicate and invalid character validation.
- **Tasks**:
  - [x] Created GitHub issue [#523](https://github.com/Kushaal-k/Tessera/issues/523)
  - [x] Inline input with auto-focus upon clicking create buttons
  - [x] `Enter` commits creation and focuses new item; `Escape` cancels
  - [x] Auto-detect language from extension upon file creation
  - [x] Inline validation error for duplicate sibling names

---

### #3: File and Folder Inline Renaming with Conflict Handling
- **GitHub**: [#524](https://github.com/Kushaal-k/Tessera/issues/524)
- **Target**: `apps/web` (`apps/web/src/components/FileTree.tsx`), `packages/collaboration`
- **Summary**: Support inline renaming via `F2` or context menu. Update Yjs state atomically, preserve contents and child nodes, and validate against sibling collisions.
- **Tasks**:
  - [x] Created GitHub issue [#524](https://github.com/Kushaal-k/Tessera/issues/524)
  - [x] `F2` triggers rename with filename selected (excluding extension)
  - [x] Commits on `Enter`, cancels on `Escape` or blur
  - [x] Inline validation prevents sibling name conflicts
  - [x] Folder renaming updates child relative paths without changing IDs

---

### #4: File and Folder Deletion with Confirmation Dialog
- **GitHub**: [#525](https://github.com/Kushaal-k/Tessera/issues/525)
- **Target**: `apps/web`, `packages/ui-components`
- **Summary**: Add delete actions to file and folder tree items. Single files delete immediately (or with simple prompt); non-empty folders display a confirmation modal before recursive deletion.
- **Tasks**:
  - [x] Created GitHub issue [#525](https://github.com/Kushaal-k/Tessera/issues/525)
  - [x] Trash action button on hover and in context menu
  - [x] Confirmation dialog for deleting non-empty folders
  - [x] Deleting an open file closes its tab cleanly
  - [x] Recursive cleanup of all descendants in a single Yjs transaction

---

### #5: Drag-and-Drop Moving of Files & Folders with Cycle Prevention
- **GitHub**: [#526](https://github.com/Kushaal-k/Tessera/issues/526)
- **Target**: `apps/web` (`apps/web/src/components/FileTree.tsx`), `packages/collaboration`
- **Summary**: HTML5 drag-and-drop to reorganize files and folders between directories. Uses `workspace.moveFile` and `workspace.moveFolder` with cycle prevention.
- **Tasks**:
  - [x] Created GitHub issue [#526](https://github.com/Kushaal-k/Tessera/issues/526)
  - [x] Drag handle and visual drop target indicators
  - [x] Reparents to folder on drop; reparents to root when dropped on explorer background
  - [x] Enforces cycle prevention (cannot drop a folder into its own subtree)
  - [x] Sibling duplicate names blocked on drop

---

### #6: File Extension Language Mapping & Custom File Type Icons
- **GitHub**: [#536](https://github.com/Kushaal-k/Tessera/issues/536)
- **Target**: `apps/web` (`apps/web/src/utils/fileIcons.ts`), `packages/shared-types`
- **Summary**: Map extensions (`.ts`, `.py`, `.cpp`, `.rs`, `.go`, `.json`, `.css`, etc.) to specific SVG brand icons and Monaco language IDs.
- **Tasks**:
  - [x] Created GitHub issue [#536](https://github.com/Kushaal-k/Tessera/issues/536)
  - [ ] Centralized `resolveFileMetadata(fileName)` helper
  - [ ] SVG icons for supported programming and config languages
  - [ ] Fallback to generic icon and `plaintext` for unknown extensions
  - [ ] Auto-update `WorkspaceFile.language` on creation or rename

---

### #7: Quick Open File Palette (`Cmd/Ctrl + P`) with Fuzzy Matching
- **GitHub**: [#538](https://github.com/Kushaal-k/Tessera/issues/538)
- **Target**: `apps/web` (`apps/web/src/components/QuickOpenModal.tsx`)
- **Summary**: Fast file search modal toggled via `Cmd+P` / `Ctrl+P`. Flatten workspace files into relative paths with fuzzy search and keyboard selection.
- **Tasks**:
  - [x] Created GitHub issue [#538](https://github.com/Kushaal-k/Tessera/issues/538)
  - [ ] `Cmd/Ctrl+P` opens palette with focused search input
  - [ ] Fuzzy search over relative paths with highlighted matches
  - [ ] Arrow key navigation and `Enter` to open file
  - [ ] `Escape` dismisses palette cleanly

---

### #8: Workspace Export to ZIP and Directory Import
- **Target**: `apps/web` (`apps/web/src/utils/workspaceArchive.ts`), `packages/collaboration`
- **Summary**: Allow users to download their entire workspace as a `.zip` archive via `jszip`, or import an existing local folder via `webkitdirectory`.
- **Tasks**:
  - [ ] "Export ZIP" packages all files preserving directory hierarchy
  - [ ] "Import Folder" reads local directory and creates Yjs folders/files
  - [ ] Batches import in a single `doc.transact()` call to avoid socket flooding
  - [ ] Progress toast during large imports

---

## Domain 2: Multi-File Monaco Editor Experience

### #9: Multi-Tab File Bar with Active File Switching
- **GitHub**: [#534](https://github.com/Kushaal-k/Tessera/issues/534)
- **Target**: `apps/web` (`apps/web/src/components/TabBar.tsx`, `apps/web/src/App.tsx`)
- **Summary**: Top horizontal tab bar above Monaco showing all open files, active tab styling, close button (`×`), and middle-click to close.
- **Tasks**:
  - [x] Created GitHub issue [#534](https://github.com/Kushaal-k/Tessera/issues/534)
  - [x] Opening a file adds it to tabs and sets it as active
  - [x] Active tab highlighted with distinct border/color
  - [x] Closing a tab switches focus to the adjacent tab
  - [x] Middle-click closes tab; horizontal scroll on overflow

---

### #10: Dynamic Monaco Model & `Y.Text` Buffer Switching
- **GitHub**: [#535](https://github.com/Kushaal-k/Tessera/issues/535)
- **Target**: `apps/web` (`apps/web/src/components/CollaborativeEditor.tsx`)
- **Summary**: Refactor `CollaborativeEditor` to dynamically swap Monaco `ITextModel` and rebind `MonacoBinding` on file tab switch without unmounting the editor.
- **Tasks**:
  - [x] Created GitHub issue [#535](https://github.com/Kushaal-k/Tessera/issues/535)
  - [x] Manage `ITextModel` pool keyed by file URI
  - [x] Destroy previous `MonacoBinding` cleanly on switch
  - [x] Rebind `MonacoBinding` to the newly active `Y.Text` buffer
  - [x] No memory leaks or duplicate cursor listeners

---

### #11: Dirty / Unsaved & Pending Synchronization Indicator
- **GitHub**: [#539](https://github.com/Kushaal-k/Tessera/issues/539)
- **Target**: `apps/web` (`apps/web/src/components/TabBar.tsx`, `StatusBar.tsx`)
- **Summary**: Visual dot indicator on tabs when local edits are queued or waiting for sync acknowledgment from the server.
- **Tasks**:
  - [x] Created GitHub issue [#539](https://github.com/Kushaal-k/Tessera/issues/539)
  - [ ] Track `isSynced` from `TesseraSocketProvider`
  - [ ] Show dirty dot on tab while edits are unconfirmed
  - [ ] Status bar displays "Syncing..." vs "Saved"
  - [ ] Indicator persists when disconnected to warn of offline state

---

### #12: Breadcrumb Navigation Hierarchy Bar
- **Target**: `apps/web` (`apps/web/src/components/Breadcrumbs.tsx`)
- **Summary**: Breadcrumb trail below the tab bar (`root > src > components > Header.tsx`) showing current file hierarchy with dropdown navigation.
- **Tasks**:
  - [ ] Resolve ancestor folders from `workspace.getFolderPath(parentId)`
  - [ ] Clicking a folder segment shows dropdown of sibling files/folders
  - [ ] Updates automatically on tab switch or file rename

---

### #13: Per-File Cursor & Scroll Position ViewState Restoration
- **Target**: `apps/web` (`apps/web/src/components/CollaborativeEditor.tsx`)
- **Summary**: Cache and restore cursor position and vertical scroll offset per file when switching tabs.
- **Tasks**:
  - [ ] Save `editor.saveViewState()` before leaving a file
  - [ ] Restore via `editor.restoreViewState()` upon returning
  - [ ] Clear cached view state when tab is closed

---

### #14: Global Keybindings Manager
- **Target**: `apps/web` (`apps/web/src/hooks/useKeybindings.ts`)
- **Summary**: Centralized shortcut handler for `Cmd/Ctrl+S` (Save/Sync), `Cmd/Ctrl+W` (Close Tab), `Cmd/Ctrl+Enter` (Run Code), `Cmd/Ctrl+B` (Toggle Sidebar), `Ctrl+\`` (Toggle Terminal).
- **Tasks**:
  - [ ] Consistent behavior across macOS (`Cmd`) and Linux/Windows (`Ctrl`)
  - [ ] Intercept browser defaults (e.g. Save Webpage dialog on Ctrl+S)
  - [ ] Ignore shortcuts when typing in inputs/modals

---

### #15: Split Editor View (Side-by-Side File Editing)
- **Target**: `apps/web` (`apps/web/src/components/SplitEditor.tsx`)
- **Summary**: Dual-pane editor layout allowing two files to be viewed and edited side-by-side with independent Monaco bindings.
- **Tasks**:
  - [ ] Dual-pane layout with draggable horizontal split ratio
  - [ ] Drag tab to the right side to open in split pane
  - [ ] Independent `MonacoBinding` per pane
  - [ ] Closing all tabs in split pane collapses back to single view

---

### #16: Editor Status Bar (Line/Col, Encoding, Indentation, Language)
- **Target**: `apps/web` (`apps/web/src/components/StatusBar.tsx`)
- **Summary**: Bottom status bar displaying cursor line/col, selection length, file encoding (`UTF-8`), indentation (`Spaces: 2`), and language selector.
- **Tasks**:
  - [ ] Updates `Ln X, Col Y` and selection count on cursor movement
  - [ ] Displays encoding and indentation
  - [ ] Clicking language opens picker to override syntax highlighting

---

## Domain 3: Real-Time Presence, Awareness & Collaboration

### #17: Remote User Cursor & Selection Range Rendering in Monaco
- **Target**: `apps/web` (`apps/web/src/components/CollaborativeEditor.tsx`), `packages/collaboration`
- **Summary**: Style remote cursors with tooltips showing participant display names and translucent background highlights for text selections.
- **Tasks**:
  - [ ] Colored vertical cursor bar in peer's assigned color
  - [ ] Floating name tooltip that appears on move and fades after 3s
  - [ ] Semi-transparent selection highlight matching cursor color

---

### #18: Awareness Disconnect Client ID Bug Fix
- **GitHub**: [#537](https://github.com/Kushaal-k/Tessera/issues/537)
- **Target**: `apps/sync-server` (`apps/sync-server/src/server.ts`)
- **Summary**: Fix `server.ts` line 181 which calls `removeAwarenessStates(room.awareness, [room.awareness.clientID], socket)`. It should remove the disconnecting client's awareness ID, not the server's ID.
- **Tasks**:
  - [x] Created GitHub issue [#537](https://github.com/Kushaal-k/Tessera/issues/537)
  - [ ] Map `socket.id` to remote client's awareness `clientID`
  - [ ] Remove actual client awareness ID on disconnect
  - [ ] Broadcast awareness update immediately to remove ghost cursors
  - [ ] Add unit test verifying awareness cleanup on disconnect

---

### #19: Presence Idle / Away State Detection with Inactivity Timeout
- **Target**: `packages/collaboration` (`awareness.ts`), `packages/shared-types`
- **Summary**: Detect window blur or 60s of user inactivity. Broadcast `"idle"` state, dim remote cursor to 40% opacity, and restore `"active"` on any interaction.
- **Tasks**:
  - [ ] Add `status: "active" | "idle" | "away"` to participant awareness
  - [ ] 60-second inactivity timer triggers `"idle"`
  - [ ] Monaco dims idle cursors to 40%
  - [ ] Any keystroke or mouse movement immediately restores `"active"`

---

### #20: Connected Collaborators Header Avatar Stack & Participant Popover
- **Target**: `apps/web` (`apps/web/src/components/ParticipantStack.tsx`), `packages/ui-components`
- **Summary**: Header avatar stack showing initials and colored rings for connected peers. Shows `+N` badge if >5 peers; clicking opens participant popover.
- **Tasks**:
  - [ ] Overlapping avatar circles for connected participants
  - [ ] `+N` overflow badge for >5 participants
  - [ ] Popover lists participant name, active file, and online status
  - [ ] Real-time join/leave updates

---

### #21: Collaborator "Follow Mode" (Viewport & File Tracking)
- **Target**: `apps/web` (`apps/web/src/hooks/useFollowCollaborator.ts`)
- **Summary**: Clicking a collaborator's avatar engages Follow Mode. Automatically switches active tab and scrolls viewport to track the presenter's cursor.
- **Tasks**:
  - [ ] Broadcast `currentFileId` and cursor line in awareness
  - [ ] Follow Mode banner: `Following [Name] (Click to stop)`
  - [ ] Auto-switch files and scroll viewport with followed user
  - [ ] Local scroll or click disengages Follow Mode

---

### #22: Multi-Tab Awareness Deduplication per User Identity
- **Target**: `packages/collaboration` (`awareness.ts`)
- **Summary**: If a user opens the room in multiple browser tabs, group their awareness entries and prevent rendering self-remote ghost cursors.
- **Tasks**:
  - [ ] Group awareness states by `participant.id`
  - [ ] Suppress self-remote cursors for secondary tabs
  - [ ] Participant list consolidates multi-tab sessions into one entry

---

### #23: Connection State Banners & Reconnect Toast Notifications
- **Target**: `apps/web` (`apps/web/src/components/ConnectionBanner.tsx`)
- **Summary**: Prominent banner when sync connection drops showing attempt counts (`Reconnecting 2/10...`). Auto-dismissing success toast upon reconnect.
- **Tasks**:
  - [ ] Warning banner appears within 2s of disconnect
  - [ ] Displays attempt count and "Retry Now" button
  - [ ] Clears automatically with success toast upon reconnect

---

### #24: High-Contrast Collaborator Color Palette Generator
- **Target**: `packages/collaboration` (`colors.ts`), `packages/shared-types`
- **Summary**: Curated palette of 16 high-contrast colors meeting WCAG AA standards (>4.5:1 against dark `#1e1e1e` background), deterministically assigned by user ID hash.
- **Tasks**:
  - [ ] 16 WCAG AA compliant colors for dark theme
  - [ ] Deterministic assignment based on `participant.id` hash
  - [ ] Stable colors across page reloads

---

## Domain 4: Interactive Terminal System

### #25: WebSocket Terminal Gateway in Sync Server
- **GitHub**: [#543](https://github.com/Kushaal-k/Tessera/issues/543)
- **Target**: `apps/sync-server` (`terminalGateway.ts`), `packages/shared-types`
- **Summary**: WebSocket namespace `/terminal` in `sync-server` to handle terminal session creation, streaming input, output, and process lifecycle.
- **Tasks**:
  - [x] Created GitHub issue [#543](https://github.com/Kushaal-k/Tessera/issues/543)
  - [ ] Terminal socket events: `terminal:create`, `terminal:data`, `terminal:resize`, `terminal:kill`
  - [ ] Track active `TerminalSession` instances by `sessionId` and `roomId`
  - [ ] Bidirectional streaming between socket and terminal runner

---

### #26: Frontend `xterm.js` Terminal Component Integration
- **GitHub**: [#544](https://github.com/Kushaal-k/Tessera/issues/544)
- **Target**: `apps/web` (`Terminal.tsx`, `package.json`)
- **Summary**: Add `@xterm/xterm`, `@xterm/addon-fit`, and `@xterm/addon-web-links` to `apps/web`. Render an interactive terminal in the bottom dock connected to WebSocket.
- **Tasks**:
  - [x] Created GitHub issue [#544](https://github.com/Kushaal-k/Tessera/issues/544)
  - [ ] Install xterm packages and configure dark IDE theme
  - [ ] Pipe keyboard input to `terminal:data`
  - [ ] Render incoming stream in real time via `term.write()`
  - [ ] Clickable URLs via `@xterm/addon-web-links`

---

### #27: Docker PTY Container Exec Spawning
- **GitHub**: [#543](https://github.com/Kushaal-k/Tessera/issues/543)
- **Target**: `apps/sync-server` (`terminalRunner.ts`)
- **Summary**: Spawn an interactive pseudo-terminal (PTY) inside an isolated Docker container with unprivileged user permissions.
- **Tasks**:
  - [x] Created GitHub issue [#543](https://github.com/Kushaal-k/Tessera/issues/543)
  - [ ] Docker container exec with `Tty: true`, `AttachStdin: true`, `AttachStdout: true`
  - [ ] Unprivileged security settings: `User: "1000"`, `CapDrop: ["ALL"]`
  - [ ] Standard shell features (tab completion, arrow keys, `vim`) functional

---

### #28: Terminal Window Resize Synchronization (Cols/Rows)
- **Target**: `apps/web` (`Terminal.tsx`), `apps/sync-server` (`terminalGateway.ts`)
- **Summary**: Sync terminal geometry (`cols`, `rows`) on panel resize using `@xterm/addon-fit` and `exec.resize()`.
- **Tasks**:
  - [ ] Debounce resize events from `@xterm/addon-fit`
  - [ ] Emit `terminal:resize` with `{ cols, rows }`
  - [ ] Resize backend container PTY via `exec.resize()`

---

### #29: Multi-Tab Terminal Session Management
- **Target**: `apps/web` (`TerminalTabs.tsx`), `apps/sync-server`
- **Summary**: Support up to 4 concurrent terminal tabs in the bottom panel with tab creation, switching, and deletion.
- **Tasks**:
  - [ ] Tab header with "New Terminal" (`+`) action
  - [ ] Inactive terminals kept mounted in background so processes continue running
  - [ ] Closing a tab kills the associated backend container session

---

### #30: Terminal Output Scrollback History Buffer & Session Reconnection
- **Target**: `apps/sync-server` (`terminalSession.ts`)
- **Summary**: Maintain circular buffer of the last 2000 output lines on the server. Replays buffer upon client reconnect or page refresh.
- **Tasks**:
  - [ ] Circular buffer of 2000 lines per active session
  - [ ] Replay buffered output upon client reconnect
  - [ ] Seamless reconnection on page reload

---

### #31: Terminal Clear, Reset, and Interrupt Signals (`SIGINT` / `SIGKILL`)
- **Target**: `apps/web` (`Terminal.tsx`), `apps/sync-server`
- **Summary**: Support `Ctrl+C` interrupt signals and toolbar actions for "Clear Buffer" and "Kill Process".
- **Tasks**:
  - [ ] Forward `Ctrl+C` (`\x03`) to container PTY
  - [ ] "Clear Buffer" button calls `term.clear()`
  - [ ] "Kill Process" button terminates hanging processes

---

### #32: Terminal Inactivity Timeout & Container Resource Reaper
- **Target**: `apps/sync-server` (`terminalReaper.ts`)
- **Summary**: Automatically terminate terminal sessions and remove associated Docker containers after 15 minutes of inactivity.
- **Tasks**:
  - [ ] Track activity timestamp on every I/O event
  - [ ] Reaping timer terminates idle sessions after 15 minutes
  - [ ] Release socket handles and Docker container resources cleanly

---

## Domain 5: Two-Way Filesystem Synchronization

### #33: Container Filesystem Watcher Service
- **Target**: `apps/execution-engine` (`watcher.ts`), `docker-compose.yml`
- **Summary**: Inotify / `chokidar` watcher service monitoring the container workspace volume to detect external file additions, edits, and deletions.
- **Tasks**:
  - [ ] Watch shared workspace volume for file events
  - [ ] Exclude `node_modules`, `.git`, `.cache`
  - [ ] Emit structured `{ type: 'create' | 'update' | 'delete', path }` events

---

### #34: Filesystem Change Event to Workspace Operation Bridge
- **Target**: `apps/sync-server` (`fsBridge.ts`), `packages/collaboration`
- **Summary**: Translate disk change events into atomic Yjs mutations (`workspace.createFile`, `ytext.insert`, `workspace.deleteFile`) to sync changes to web clients.
- **Tasks**:
  - [ ] File creation on disk creates Yjs file node and content
  - [ ] File deletion on disk removes Yjs file node
  - [ ] Folder creation on disk creates Yjs folder node

---

### #35: Echo Loop & Feedback Prevention via Transaction Origins
- **Target**: `packages/collaboration` (`workspace.ts`), `apps/sync-server` (`fsBridge.ts`)
- **Summary**: Prevent editor writes to disk from re-triggering the disk watcher in an infinite loop by using transaction origins and a short-lived write hash cache.
- **Tasks**:
  - [ ] Tag transactions with `FS_WATCHER_ORIGIN` vs `EDITOR_ORIGIN`
  - [ ] Cache recent write hashes with 500ms TTL
  - [ ] Suppress watcher events when file hash matches recent editor write

---

### #36: Debouncing & Batching of High-Frequency Filesystem Events
- **Target**: `apps/sync-server` (`fsBridge.ts`)
- **Summary**: Debounce and batch rapid filesystem events (`git checkout`, `npm install`) within 150ms windows into a single `doc.transact()` call.
- **Tasks**:
  - [ ] 150ms debounce and batching window
  - [ ] Coalesce duplicate events for the same file
  - [ ] Apply batch in a single atomic Yjs transaction

---

### #37: Ignore Rule Engine for Build Artifacts (`.gitignore` / `.tesseraignore`)
- **Target**: `packages/collaboration` (`ignoreRules.ts`)
- **Summary**: Prevent build directories (`node_modules`, `dist`, `.next`, `target`) from being ingested into Yjs documents.
- **Tasks**:
  - [ ] Matcher using `ignore` library
  - [ ] Automatically load `.gitignore` and default exclusions
  - [ ] Custom rules in `.tesseraignore` take effect immediately

---

### #38: Binary vs Text File Detection for Synced Assets
- **Target**: `packages/collaboration` (`fileType.ts`), `packages/shared-types`
- **Summary**: Detect binary files (null byte check in first 512 bytes) to prevent inserting binary data into `Y.Text` CRDT buffers.
- **Tasks**:
  - [ ] Null byte check to detect binary files
  - [ ] Store binary files as asset metadata/blobs instead of `Y.Text`
  - [ ] UI renders image preview or binary placeholder badge

---

## Domain 6: Execution Engine & Multi-File Sandboxing

### #39: Multi-File Workspace Execution Payload
- **GitHub**: [#542](https://github.com/Kushaal-k/Tessera/issues/542)
- **Target**: `packages/shared-types`, `apps/execution-engine` (`sandbox.ts`)
- **Summary**: Update `ExecutionTask` to accept an array of workspace files `{ path: string, content: string }` and an `entrypoint` instead of a single `code: string`.
- **Tasks**:
  - [x] Created GitHub issue [#542](https://github.com/Kushaal-k/Tessera/issues/542)
  - [ ] Add `files` and `entrypoint` to `ExecutionTask` in `@tessera/shared-types`
  - [ ] Maintain backward compatibility for single-file tasks
  - [ ] Monorepo packages compile without type errors

---

### #40: Tar Stream File Injection (`putArchive`) Replacing Shell Echo
- **GitHub**: [#542](https://github.com/Kushaal-k/Tessera/issues/542)
- **Target**: `apps/execution-engine` (`sandbox.ts`)
- **Summary**: Replace `echo '${code}' > /tmp/main...` shell interpolation with Docker `container.putArchive()` using an in-memory tarball stream.
- **Tasks**:
  - [x] Created GitHub issue [#542](https://github.com/Kushaal-k/Tessera/issues/542)
  - [ ] Pack workspace files into tar stream via `tar-stream`
  - [ ] Inject archive into `/tmp` before container start
  - [ ] Eliminates shell escaping bugs and supports multi-directory structures

---

### #41: Standard Input (stdin) Interactive Streaming for Execution Tasks
- **Target**: `apps/execution-engine` (`sandbox.ts`), `packages/shared-types`
- **Summary**: Support passing optional `stdin: string` for batch tasks and connect a Redis pub/sub channel for streaming interactive user input during run.
- **Tasks**:
  - [ ] Optional `stdin` in `ExecutionTask`
  - [ ] Pipe batch stdin to container stdin stream
  - [ ] Programs using `input()` or `std::cin` complete without hanging

---

### #42: Execution Container Cgroup Metrics (Peak CPU & Memory Extraction)
- **Target**: `apps/execution-engine` (`sandbox.ts`), `packages/shared-types`
- **Summary**: Extract peak memory usage (`memoryUsageMb`) and total CPU time (`cpuUsageMs`) from container stats and return in `ExecutionResult`.
- **Tasks**:
  - [ ] Read `container.stats({ stream: false })` before container removal
  - [ ] Extract peak memory and CPU execution metrics
  - [ ] Include metrics in `ExecutionResult` and display in web Output panel

---

### #43: Compiler Error Parsers for Rust, Python, Go, and Java
- **Target**: `apps/execution-engine` (`sandbox.ts`, `src/formatters/`)
- **Summary**: Build structured error parsers for Python tracebacks, `rustc`, `go run`, and `javac` with boxed visual frames matching C++ formatting.
- **Tasks**:
  - [ ] Parsers for Python, Rust, Go, and Java compiler errors
  - [ ] Boxed visual frames with `Line X, Col Y`
  - [ ] Strip container internal `/tmp/` paths from output

---

### #44: Execution Task Cancellation Endpoint & Abort Signal
- **Target**: `apps/execution-engine` (`worker.ts`), `apps/sync-server` (`server.ts`)
- **Summary**: Add a "Stop" button in UI and `cancel-execution` socket event to terminate running execution containers immediately via `container.kill()`.
- **Tasks**:
  - [ ] "Stop" button in web UI toolbar
  - [ ] `cancel-execution` event in `sync-server`
  - [ ] Worker aborts BullMQ job and immediately kills container

---

### #45: Container Labeling and Automated Garbage Collection
- **Target**: `apps/execution-engine` (`sandbox.ts`, `cleanup.ts`)
- **Summary**: Add `Labels: { "tessera.sandbox": "true", "tessera.taskId": task.id }` to containers and run automated cleanup on worker startup and 5-min intervals.
- **Tasks**:
  - [ ] Explicit labels on all sandbox containers
  - [ ] Update `cleanup.ts` to filter by `label: ["tessera.sandbox=true"]`
  - [ ] Run cleanup on worker startup and recurring cron

---

### #46: Configurable Timeouts & Resource Quota Validation
- **Target**: `apps/execution-engine`, `apps/sync-server`
- **Summary**: Allow clients to request custom timeouts (1s-15s) with strict server validation and boundary clamping.
- **Tasks**:
  - [ ] Validate and clamp requested `timeoutMs` (1000ms - 15000ms)
  - [ ] Enforce memory limit boundaries (64MB - 512MB)
  - [ ] Reject out-of-bounds requests with clean error response

---

### #47: Multi-File Build & Run Specification per Language
- **Target**: `apps/execution-engine` (`runtimes.ts`)
- **Summary**: Declarative `RuntimeDefinition` specifying compilation and execution commands per language for multi-file projects.
- **Tasks**:
  - [ ] Multi-file build commands (e.g. `g++ *.cpp`, `go build .`)
  - [ ] Two-stage execution (compile -> run)
  - [ ] Auto-detect entrypoint file

---

## Domain 7: Sync Server, Storage & Persistence

### #48: Yjs Document Persistence Adapter (LevelDB / SQLite)
- **GitHub**: [#545](https://github.com/Kushaal-k/Tessera/issues/545)
- **Target**: `apps/sync-server` (`persistence.ts`, `server.ts`)
- **Summary**: Replace in-memory-only document storage with `y-leveldb` or SQLite persistence so rooms survive server restarts and crashes.
- **Tasks**:
  - [x] Created GitHub issue [#545](https://github.com/Kushaal-k/Tessera/issues/545)
  - [ ] Store encoded Yjs updates on disk
  - [ ] Merge persisted state when loading a room
  - [ ] Async non-blocking persistence of incremental updates

---

### #49: Grace Period Before Room Disposal on Zero Participants
- **Target**: `apps/sync-server` (`server.ts`)
- **Summary**: Replace immediate `room.doc.destroy()` on 0 participants with a 10-minute grace period before tearing down in-memory documents.
- **Tasks**:
  - [ ] 10-minute disposal timer on room empty
  - [ ] Reconnecting participant cancels destruction timer
  - [ ] Persist final state before destroying `Y.Doc` on timer expiry

---

### #50: Periodic Workspace Snapshots & Rollback History
- **Target**: `apps/sync-server` (`snapshots.ts`), `packages/collaboration`
- **Summary**: Automatic workspace snapshotting every 30 minutes of editing with an API to list snapshots and restore past versions.
- **Tasks**:
  - [ ] Snapshot state vector every 30 minutes
  - [ ] List snapshots API endpoint
  - [ ] Restore snapshot endpoint rolling back workspace via atomic transaction

---

### #51: Room Access Control & Passcode/Token Authentication
- **Target**: `apps/sync-server`, `packages/shared-types`
- **Summary**: Add optional `passcode` or signed JWT token to `join-room` payload to prevent unauthorized users from viewing or modifying private rooms.
- **Tasks**:
  - [ ] Optional passcode/token in `join-room`
  - [ ] Reject unauthorized connections with `room-access-denied`
  - [ ] Authorized participants connect seamlessly

---

### #52: WebSocket Heartbeat & Dead Connection Pruning
- **Target**: `apps/sync-server`, `packages/collaboration`
- **Summary**: Configure Socket.IO ping interval (10s) and timeout (5s) to prune dropped sockets and remove their awareness states within 15 seconds.
- **Tasks**:
  - [ ] 10s ping / 5s timeout in Socket.IO config
  - [ ] Prune dead sockets and clean up awareness states within 15s

---

### #53: Unified Health & Readiness Probes across Services
- **Target**: `apps/sync-server`, `apps/execution-engine`
- **Summary**: Comprehensive `/health` and `/ready` probes checking Redis ping, BullMQ queue connectivity, and Docker daemon socket.
- **Tasks**:
  - [ ] `/health` returns 503 if Redis or BullMQ is down
  - [ ] Expose HTTP probe on port 4001 in `execution-engine`
  - [ ] Docker Compose healthchecks reflect service readiness

---

## Domain 8: UI Primitives, Layout & Developer Experience

### #54: Resizable Split Layout (Sidebar, Editor, Output Panel)
- **GitHub**: [#546](https://github.com/Kushaal-k/Tessera/issues/546)
- **Target**: `apps/web` (`ResizableLayout.tsx`), `packages/ui-components`
- **Summary**: Draggable resizers with min/max constraints for sidebar width and bottom panel height. Dimensions saved in `localStorage`.
- **Tasks**:
  - [x] Created GitHub issue [#546](https://github.com/Kushaal-k/Tessera/issues/546)
  - [ ] Sidebar resizable between 180px and 450px
  - [ ] Bottom panel resizable between 100px and 70% screen height
  - [ ] Double-click resizer resets to default size
  - [ ] Notify Monaco and xterm of container resize

---

### #55: Unified Bottom Panel Tabs (Terminal, Output, Diagnostics)
- **GitHub**: [#546](https://github.com/Kushaal-k/Tessera/issues/546)
- **Target**: `apps/web` (`BottomPanel.tsx`)
- **Summary**: Bottom dock with tabs for `Terminal` (xterm), `Output` (run results and metrics), and `Problems` (compiler diagnostics).
- **Tasks**:
  - [x] Created GitHub issue [#546](https://github.com/Kushaal-k/Tessera/issues/546)
  - [ ] Dock with Terminal, Output, and Problems tabs
  - [ ] Executing code auto-focuses Output tab
  - [ ] Compilation errors populate Problems tab with clickable line jumps
  - [ ] Minimize, maximize, and close controls

---

### #56: Collapsible Activity Bar for Primary Sidebar
- **Target**: `apps/web` (`ActivityBar.tsx`)
- **Summary**: Far-left vertical Activity Bar (Explorer, Search, Settings, Collaborators). Clicking active icon collapses sidebar; `Cmd/Ctrl+B` toggle shortcut.
- **Tasks**:
  - [ ] Vertical Activity Bar icons
  - [ ] Collapsible sidebar to maximize editor width
  - [ ] `Cmd/Ctrl+B` shortcut toggles sidebar visibility

---

### #57: Accessible Modal and Confirm Dialog Primitives
- **Target**: `packages/ui-components` (`Dialog.tsx`, `index.ts`)
- **Summary**: Accessible `<Dialog>` and `<ConfirmModal>` components with focus trapping, `Escape` key dismissal, backdrop click, and ARIA attributes.
- **Tasks**:
  - [ ] Focus trapping and background scroll lock
  - [ ] Dismiss on `Escape` or backdrop click
  - [ ] Keyboard accessible (Tab, Shift+Tab, Enter)
  - [ ] Export from `@tessera/ui-components`

---

### #58: Toast Notification System in `@tessera/ui-components`
- **Target**: `packages/ui-components` (`Toast.tsx`, `index.ts`)
- **Summary**: Non-blocking toast notification provider and `useToast()` hook supporting `success`, `error`, `info`, and `warning` variants with auto-dismiss.
- **Tasks**:
  - [ ] `<ToastProvider>` and `useToast()` hook
  - [ ] Auto-dismiss after 4000ms with manual close action
  - [ ] Stack animation in bottom-right corner

---

### #59: Keyboard Shortcuts Help Cheat Sheet Modal
- **Target**: `apps/web` (`ShortcutsModal.tsx`)
- **Summary**: Cheat sheet modal opened via `?` or `Cmd/Ctrl+/` displaying categorized IDE shortcuts with platform-aware key glyphs.
- **Tasks**:
  - [ ] Modal opened via `?` or `Cmd/Ctrl+/`
  - [ ] Categorized shortcuts (General, Editor, Terminal, Navigation)
  - [ ] Search filter for shortcut actions

---

### #60: Full-Stack Docker Compose Configuration for Local Development
- **Target**: Root (`docker-compose.yml`, `README.md`)
- **Summary**: Expand `docker-compose.yml` to orchestrate Redis, Sync Server, Execution Worker, and Web App with bind mounts for one-command local startup.
- **Tasks**:
  - [ ] Orchestrate Redis, Sync Server, Worker, and Web App
  - [ ] Source code bind mounts for hot reloading
  - [ ] Docker socket mount for execution sandbox
  - [ ] Document `docker compose up` in `README.md`

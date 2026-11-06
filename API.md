# Forge main-process contract

Load `createForgeService` from `backend.cjs`. The renderer is `index.html` and expects `window.studioForge`. No Node integration is required. Keep context isolation, sandbox, restrictive CSP, blocked navigation and a vetted external-link handler. Do not expose raw `exec`, arbitrary file reads or commands.

```js
const service = createForgeService({
  appDataDir: path.join(app.getPath('userData'), 'forge'),
  sendProgress: event => window.webContents.send('forge:progress', event),
  // Optional only for QA: execAdapter, fetchImpl, platform, arch.
});
```

Expose asynchronous methods:

- `catalog()` → `{version,verifiedAt,matrix,sources,recipes}`.
- `getPlan(planId)` → immutable copy for native confirmation details; `activeJob()` → active job/null for a close-window warning.
- `detect()` → hardware, disk, Windows, WSL listing and compiler locations. This does not launch distributions.
- `deepDetect(distro)` → reads OS/ROS/compiler information **and may start that selected WSL distro**. Main process must show native confirmation first.
- `createPlan(options)` → main-process immutable plan. Options: `task:'linux'|'wsl'|'vc'|'cpp'`, `matrixId:'jazzy'|'humble'`, `location` English absolute Windows path, `distro` new `ZTH-...` name, `artifactId` optional previously imported cache, `desktop:boolean`, `withTools:boolean`.
- `exportPlan(planId)` → `{filename,script}` only; shell save dialog writes the returned UTF-8 text, returning `{path}` to renderer. Suggested extension `.ps1`; never automatically execute exported text.
- `start(planId,{confirmed:true})` → `{jobId}`. **Before calling, main process shows native dialog with the returned plan’s location, distro, changes, network/admin/restart requirements.** Only main passes confirmed:true. Renderer cannot pass commands or replace plan steps.
- `cancel(jobId)` → cooperative cancel; abort downloads immediately, wait for package/system installer steps to finish, then stop. Never kill existing WSL or force a restart.
- `resume(jobId,{confirmed:true})` → only in-session failed/cancelled job at checked checkpoint; native confirmation again. Restarted app shows historical jobs but does not auto-resume potentially partial installations.
- `job(jobId)` / `history()` → status and limited logs; history after restart is read-only.
- `importCache({file,expectedSha256,matrixId})` → `{artifactId,sha256,size}`. `file` must come from native picker, never arbitrary renderer path. Hash required, compare to official SHA256SUMS; no execution.
- `selectDirectory()` → native directory picker, return string/null. `selectRootfs()` → picker for tar.gz/tar/wsl, return string/null; frontend shows selected path, shell retains approved path for importCache.
- `onProgress(callback)` → subscription disposer. Events contain `jobId,status,step,percent,message`.

Native IPC must verify sender frame belongs to this application, reject cross-window calls, and map allowlisted methods individually. `start` rejects unless confirmed exactly true and plan exists in this service process. Privileged Windows installation requires the application to run as administrator; otherwise it returns a clear error and the user can export a reviewed script and run it elevated. Do not silently relaunch or grant admin rights.

If `dialogs.savePlan({filename,script})` is supplied at service creation, `exportPlan()` delegates to it. It should display `showSaveDialog`, write exactly the provided text with UTF-8, return `{path}` on success and `null` on cancellation. `dialogs.selectRootfs()` selections are remembered in the service; with this dialog adapter enabled, arbitrary renderer-supplied file paths are rejected by `importCache`.

No system-changing method is invoked by initial page load or detection. QA uses fake adapters and temp appData; no WSL install, reboot, system configuration or PATH mutation.

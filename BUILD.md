# Reproduce ZTH Studio Forge

Windows 10/11 x64, Node 22.22.2+ and Inno Setup 7 are needed for development.
Run npm ci --prefix build-runtime, then node build-release.cjs. The first command downloads pinned build dependencies including Electron 45.0.0; this is a developer requirement, not an end-user requirement.
Set ZTH_ISCC to the compiler executable if it is not in the standard per-user Inno Setup 7 location.
The builder refuses existing output folders: preserve and review previous out/ before a new build. It does not delete user data or install the product. Outputs are under out/build, out/source and out/release.
Runtime and source use explicit file allowlists; no QA outputs, personal projects, cached toolchains or developer logs are included. Source hashes are in SOURCE-MANIFEST.json; runtime and installed-file hashes are in PACKAGE-MANIFEST.json.
Inno Setup/Sharp/rcedit are build tools, not installed into the app. Third-party notices remain with the Electron payload.
Signing is not configured. Independent product AppId and AppData identity remain stable for future upgrades.

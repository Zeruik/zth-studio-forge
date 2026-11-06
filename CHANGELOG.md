# Version history

## 1.0.0 — 2026-11-06

- Added Windows/CIM/WSL registration and tool discovery without launching existing distributions by default.
- Added separate confirmed deep inspection of an existing distro, with explicit notice that it can start the distro.
- Added reviewed plans for WSL platform setup, new Jazzy/Noble or Humble/Jammy environments, Microsoft VC++ x64 runtime and Visual Studio 2022 C++ Build Tools.
- Added official-host download restrictions, Ubuntu checksum checking, fixed ROS repository package checksums, Microsoft signature validation and native-picked local rootfs cache imports.
- Added progress, cooperative cancellation, in-session retry checkpoints, review-only restart history and explicit restart/rollback limitations.
- Added engineering recipes with local checklists and Markdown export; no hardware/flight actuation.
- Added blue ZTH branding, responsive workspace, MIT license, official sources and a verified date. Noetic is EOL/reference-only; Lyrical is listed but not automated.

Validation scope: backend mock tests and DOM interaction tests. System-changing commands were not executed on the development user's machine. Production installation, network/proxy combinations and hardware virtualization require separate acceptance on an appropriate test computer.

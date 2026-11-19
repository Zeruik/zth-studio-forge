# 下一轮维护计划 / Next maintenance iteration

目标：3.0.1（候选分支已同步版本字段，尚未发布；旧标签保持不变）。

## 已实现 / Implemented

更新过时的平台回归断言：Linux/macOS 支持只读检测和手动计划，但不能自动执行 Windows 安装器；补充持续回归 workflow。

另修复 Linux 打包权限：生成的 TAR/DEB 负载和控制目录使用明确的公开读取/执行权限，不继承开发机器的私有 umask；新增 umask 077 下实际构建 DEB 的回归测试。

## 当前云实例验证 / Current cloud validation

17 mocked environment checks; 6 native-environment groups; 9 dataset groups; 8 generated workspace groups (real host C++ compile/run and Python execution); 4 DOM groups; platform/window-preference contracts passed.

Additional checks: node qa-package-permissions.cjs passed with a real synthetic DEB under umask 077. Actual Linux x64 TAR and DEB builds passed using checksum-pinned runtimes; SHA256SUMS and installed payload permissions were verified. These are validation builds with the current version number, not next-version release assets. No GUI/install lifecycle acceptance was performed.

The maintenance-branch portable regression succeeded on GitHub. Local regression also passed on Node 22.23.5. Native candidate CI is required separately before publication.

## 建议优化 / Recommended follow-up

后续优先：数据集审查结果定位、环境计划差异比较、可恢复任务历史。系统安装/WSL/ROS 与原生桌面仍需对应系统验收。

## 发布条件 / Publication gates

先完成对应平台构建与升级/数据保留验收，再同步版本字段、刷新源码清单、为新版本生成附件与 SHA-256 校验。历史 Release、标签和附件不可覆盖。当前 api.github.com 在代理 CONNECT 阶段返回 403，已将该域名加入环境配置草案；草案保存不等于运行时已应用。恢复 API 后还需核验当前用户、仓库权限、既有 Release 和候选标签是否冲突。

本文件记录源码改进和实际执行范围，不表示新版本已经发布，也不将软件/模拟测试称为实板或手机验收。

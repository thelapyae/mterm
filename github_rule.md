# GitHub Release Rules for mterm

This document outlines the rules for maintaining the `thelapyae/mterm` repository as a **distribution-only** hub.

## 1. What to Upload (Release Assets)
Only the following files should be uploaded to the GitHub Release section:

| Platform | Filename | Purpose |
| :--- | :--- | :--- |
| **macOS** | `mterm-mac-arm64.dmg` | Main installer for Mac |
| **Windows** | `mterm-Setup.exe` | Main installer for Windows |
| **Linux** | `mterm-linux.AppImage` | Portable binary for Linux |
| **Metadata** | `latest.yml` | Update info for Windows |
| **Metadata** | `latest-mac.yml` | Update info for macOS |
| **Metadata** | `latest-linux.yml` | Update info for Linux |

## 2. What NOT to Upload
- **Source Code**: Never push `.js`, `.html`, or `package.json` to the `main` branch. This repository is for binaries only.
- **Blockmaps**: `.blockmap` files are used for differential updates (downloading only changed parts). While efficient, they clutter the release UI. We omit them for a cleaner look.
- **Unpacked Folders**: Never upload `mac-arm64/` or `win-unpacked/` directories.

## 3. Main Branch Content
The `main` branch should only contain:
1. `README.md`
2. `github_rule.md` (this file)
3. The latest `.yml` metadata files (needed for `electron-updater` to find the update).

## 4. Release Naming Convention
- **Tag**: `vX.X.X` (e.g., `v1.0.4`)
- **Title**: `mterm vX.X.X`
- **Description**: Summary of changes (no technical jargon).

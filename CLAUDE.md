# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lucentia** is a Tauri 2 desktop application for downloading videos via yt-dlp. The frontend is built with Next.js 15 (static export) + React 19 + TypeScript, and the backend is Rust via Tauri.

## Commands

```bash
# Development (runs Tauri + Next.js dev server)
npm run dev:tauri

# Build (Next.js static export, then Tauri package)
npm run build && npm run build:tauri

# Lint (Biome, auto-fix)
npm run lint

# Format (Biome, write)
npm run format
```

Node.js version is pinned to 22.14.0 via Volta. Package manager is npm.

There are currently no automated tests. TypeScript tests use Vitest with `*.spec.ts` filenames—confirm with the user before writing tests.

## Architecture

### Frontend → Backend Bridge

The frontend communicates with Rust via Tauri's `invoke()`:
- `invoke("download_metadata", { url })` → returns `VideoMetadata` (title, thumbnail, duration)
- `invoke("download_video", { url, audioOnly, folderPath, bestQuality, downloadSubtitles, preferredFormat, customFilename })` → returns `Result<(), String>`

All app logic lives in `lib/hooks/useVideoDownloader.ts`, which manages state and calls these two commands. `app/page.tsx` consumes this hook and passes props to presentational components.

### Rust Backend (`src-tauri/src/`)

| File | Role |
|------|------|
| `main.rs` | Entry point; registers commands, sets PATH for ffmpeg (Homebrew on macOS), configures Windows env vars, triggers yt-dlp auto-download in a background thread at startup |
| `commands.rs` | `download_metadata` and `download_video` Tauri commands |
| `downloader.rs` | Downloads/verifies the yt-dlp binary to the OS data dir (`<data_dir>/my-video-downloader/yt-dlp[.exe]`) on first run |
| `utils.rs` | URL validation, filename sanitization (strips invalid chars, max 128 chars), path safety checks |

Key behavior: yt-dlp is **not bundled**—it is downloaded automatically on first launch to `<OS data dir>/my-video-downloader/`. The binary is re-downloaded if the version check fails.

### Next.js Configuration

`next.config.ts` sets `output: "export"` (static HTML) so Tauri can serve the built files. Do not add server-side features (API routes, server components with data fetching) that require a Node.js runtime.

### UI Components

`components/ui/` contains shadcn/ui components (Radix UI primitives + Tailwind CSS). Application-level components are `AppHeader`, `AppFooter`, `VideoForm`, and `DialogSettingPath`.

## Coding Conventions

From `.cursor/rules/`:

**TypeScript**
- Functional approach: prefer `switch`/`case` or hashmaps over if/else chains
- Early returns to minimize nesting
- No `any` type—use `unknown` instead
- JSDoc comments written in Japanese

**Formatting**
- Biome handles linting and formatting (tabs, indent width 2)
- Biome config (`biome.json`) currently only includes root-level files and `./src/**/*` in its `include` list

**Git / Commits**
- Conventional Commits format (e.g., `feat:`, `fix:`, `refactor:`) with messages in Japanese
- Use `gh` CLI for GitHub operations
- Use HEREDOC syntax for multi-line commit messages

# OpenClaw UI - Build Specification

Build a local web UI for OpenClaw that serves as a simplified control panel for a non-technical user. It runs on the same machine as OpenClaw (Mac mini, localhost).

## Tech Stack
- Frontend: React (Vite) with TypeScript
- Backend: Express.js server that shells out to the `openclaw` CLI for all operations
- Styling: Tailwind CSS, dark mode by default
- No auth (localhost only)

## Core Features

### 1. Chat Interface (main view, default tab)
- Send messages to OpenClaw and display responses in a chat-style layout
- **Model switcher:** Dropdown to switch between available models. Populate from `openclaw models` output. Show current model.
- **Agent switcher:** Dropdown to select which agent to talk to (main + any registered agents). Default to main.
- **Thinking mode toggle:** Button group with 4 states: Off / Low / Medium / High. Maps to `openclaw` reasoning commands. Show current state.
- Render markdown in messages (code blocks, bold, lists, etc.)
- Streaming responses if possible, otherwise show a loading indicator

### 2. Cron Jobs Tab
- List all cron jobs from `openclaw cron list`
- Show: name, schedule, next run, last status
- Allow creating, pausing, and deleting cron jobs via forms
- Confirmation dialog before delete

### 3. Reminders Tab
- List reminders using `remindctl` CLI (run `remindctl --help` to see available commands)
- Show by list, with due dates
- Allow marking complete and adding new reminders

### 4. Usage & Cost Tab
- Show token usage and estimated cost from `openclaw status`
- Break down by model if possible

## CLI Reference
The backend interacts with OpenClaw exclusively through the CLI. Key commands:
- `openclaw status` — current status, model, usage info
- `openclaw models` — list available models  
- `openclaw models <provider>` — list models for provider
- `openclaw cron list` — list cron jobs
- `openclaw cron add` — add cron job
- `openclaw cron delete` — delete cron job
- `remindctl` — Apple Reminders CLI (run --help for usage)

For chat, use `openclaw chat` or the webchat API if available. Check `openclaw --help` and `openclaw chat --help` for exact syntax.

## Design Principles
- **Guard rails:** Destructive actions require confirmation dialogs
- **Sensible defaults:** Pre-select current model, agent, thinking mode
- **Error handling:** Show CLI errors as user-friendly toasts, not raw stderr
- **Clean UI:** Minimal, modern, dark mode. Sidebar with tabs for Chat / Cron / Reminders / Usage.
- **Workspace-aware:** Reads from ~/.openclaw/workspace/ — visual layer over existing structure

## What NOT to do
- Don't bypass the OpenClaw CLI
- Don't create a separate database
- Don't implement auth/login
- Don't auto-run destructive commands without confirmation

## Running
- `npm run dev` should start both backend (port 3456) and frontend (port 5173 with proxy to backend)
- Backend serves API at /api/*
- Frontend proxies /api/* to backend

## After building
- Make sure everything compiles and runs with `npm run dev`
- Commit all files and push to origin/main

When completely finished, run this command to notify me:
openclaw system event --text "Done: OpenClaw UI built and running on localhost:5173" --mode now

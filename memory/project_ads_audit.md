---
name: Ads Audit Project
description: Full-stack ads analytics app built for the user - Meta Ads + Google Ads reporting dashboard
type: project
---

Full-stack web app built at `c:\Users\Cavidan Setterzade\166 ads audit`.

**Why:** User needs daily/weekly/monthly/yearly cost and metric analysis from Meta Ads and Google Ads.

**Stack:** Node.js + Express + TypeScript (server), React + TypeScript + Vite + Tailwind (client), SQLite (DB), Socket.io (chat)

**Key features:**
- Read-only: never modifies ad accounts
- Meta Ads: per-Business-Suite token management, ocean blue theme (#0082FB)
- Google Ads: OAuth + email verification, yellow/blue/green theme, top 3 keywords per search campaign
- Admin approval via email (cavidanbusiness2026@gmail.com) for new users + chat access
- Error notifications to cavidanbusiness2026@gmail.com
- 3 languages: AZ (default), RU, EN-GB; Font: Verdana
- Period comparison, export (CSV/Excel), real-time chat (Socket.io)
- Per-user data isolation (users only see their own connected accounts)
- Tokens encrypted with AES-256-CBC

**Status:** Code complete. Node.js not installed on user's machine as of 2026-05-07.

**How to apply:** When continuing work, Node.js installation is prerequisite. Setup instructions at QURULUM.md.

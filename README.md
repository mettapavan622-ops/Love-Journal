# My Love Letters — Express + SQLite Journal 💌

A romantic-themed journaling web app. Users register, log in to get a JWT,
and then create/read/update/delete their own private "love letters".
Styled with a soft pastel love theme featuring floating hearts, elegant
script fonts, and a dreamy aesthetic.

![Love Theme Preview](https://img.shields.io/badge/Theme-Soft%20Pastel%20Romance-ffb3c6?style=flat-square)
![License](https://img.shields.io/badge/License-IS-888888?style=flat-square)
![Tech](https://img.shields.io/badge/Tech-Node.js%20Express-FDE122?style=flat-square)
![DB](https://img.shields.io/badge/DB-SQLite-4DA0DA?style=flat-square)

## Features
- **Love-themed UI**: Soft blush pinks, romantic fonts (Dancing Script, Caveat, Playfair Display), and floating animated hearts
- **JWT Authentication**: Secure user registration and login with bcrypt-hashed passwords
- **Private Journaling**: Each user can only see and modify their own entries
- **Full CRUD**: Create, read, update, search, and delete journal entries
- **No frontend frameworks**: Pure vanilla HTML/CSS/JS — no build step needed
- **Per-user isolation**: SQL queries are scoped to the authenticated user ID

## Project Structure
```
journal-app/
├── index.js                  # Server entry point + all routes + static file serving
├── package.json
├── public/
│   └── index.html             # Full frontend: auth screens + entry editor (vanilla JS, no build step)
├── db/
│   ├── schema.sql             # Table definitions (user, entry)
│   └── journal.db             # SQLite DB file (auto-created on first run)
└── middleware/
    ├── logger.js               # Logs query params on each request
    └── authenticateToken.js    # Verifies JWT, attaches request.userId
```

## Setup
```bash
npm install
npm run dev      # uses nodemon, auto-restarts on file changes
# or
npm start
```
Server runs at `http://localhost:3000/` — open that URL in a browser to use the app (register, log in, write/edit/delete entries). The same server also exposes the JSON API below if you want to hit it directly (curl, Postman, etc).

### Love Theme Design Details
- **Dancing Script**: Used for the brand name "My Love Letters" with a pink gradient
- **Caveat**: Handwritten-style font for taglines and meta labels
- **Playfair Display**: Elegant serif for headings and entry titles
- **Work Sans**: Clean sans-serif for body text and editor content
- **Soft pastel color palette**: Blush pinks (#FFF7F5, #FFF1F2), romantic magenta (#DB2777), and dreamy purple-pink accents
- **Animated hearts**: Floating decorative elements with random sizes and delays

### Frontend notes
- Single static HTML file (`public/index.html`) with embedded CSS/JS — no build tooling, no framework, works as soon as Express serves it.
- The JWT is kept in an in-memory JS variable, not `localStorage`, so refreshing the page logs you out. Swap in `localStorage`/cookies if you want persistence across reloads.
- All entry requests go through the `authFetch()` helper, which attaches the `Authorization: Bearer <token>` header and auto-logs-out on a 401.

## Deploy to Render

This repository includes `render.yaml` for a Node web service backed by a
persistent 1 GB disk. In Render, choose **New > Blueprint**, connect this
repository, and apply the blueprint. Render builds from `journaling-fixed-main`,
generates `JWT_SECRET`, stores SQLite data at `/var/data/journal.db`, and uses
`/healthz` for health checks.

## API Reference

### Auth

**Register** — `POST /users/`
```json
{ "username": "rahul", "name": "Rahul", "password": "pass123", "gender": "Male", "location": "Hyderabad" }
```

**Login** — `POST /login`
```json
{ "username": "rahul", "password": "pass123" }
```
Returns: `{ "jwtToken": "..." }`

> All `/entries/` routes below require the header:
> `Authorization: Bearer <jwtToken>`

### Journal Entries

| Method | Path | Description |
|---|---|---|
| GET | `/entries/` | List your entries (supports `offset`, `limit`, `order`, `order_by`, `search_q`) |
| GET | `/entries/:entryId/` | Get a single entry |
| POST | `/entries/` | Create an entry — body: `{ "title", "content", "mood" }` |
| PUT | `/entries/:entryId/` | Update an entry — same body as POST |
| DELETE | `/entries/:entryId/` | Delete an entry |

**Example: list with filters**
```
GET /entries/?limit=5&offset=0&order=DESC&order_by=date_created&search_q=grateful
```

## Running the App
After starting the server, open [http://localhost:3000](http://localhost:3000) in your browser:
1. **Register** a new account or **log in** if you already have one
2. Click **"New love note"** to start a new entry
3. Add a title, select a mood, and write your thoughts
4. Click **"Save love note"** to store it
5. Search and browse your love letters from the sidebar

## Notes
- Passwords are hashed with `bcrypt` before storage — never stored in plain text.
- `JWT_SECRET` is required at startup and should remain private.
- Every entry route is scoped to `request.userId` from the verified token, so users can only ever see or modify their own entries.
- SQL values use parameterized queries; sort fields and directions are allowlisted.

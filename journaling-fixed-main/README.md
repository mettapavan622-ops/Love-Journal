# Journal App (Express + SQLite)

A simple journaling REST API. Each user registers, logs in to get a JWT,
and then creates/reads/updates/deletes their own private journal entries.

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

### Frontend notes
- Single static HTML file (`public/index.html`) with embedded CSS/JS — no build tooling, no framework, works as soon as Express serves it.
- The JWT is kept in an in-memory JS variable, not `localStorage`, so refreshing the page logs you out. Swap in `localStorage`/cookies if you want persistence across reloads.
- All entry requests go through the `authFetch()` helper, which attaches the `Authorization: Bearer <token>` header and auto-logs-out on a 401.

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

## Notes
- Passwords are hashed with `bcrypt` before storage — never stored in plain text.
- JWT secret is hardcoded as `"MY_SECRET_TOKEN"` for learning purposes — move this to an environment variable (`.env`) before deploying anywhere real.
- Every entry route is scoped to `request.userId` from the verified token, so users can only ever see or modify their own entries.
- SQL queries here use string interpolation for readability/teaching purposes; for production, switch to parameterized queries (`db.all(query, [param1, param2])`) to prevent SQL injection.

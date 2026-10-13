# Tidepool

Tidepool collects event posts pushed by an n8n workflow and serves them as a JSON API protected by API keys. It shows upcoming events on a public feed at `/`, and has a password-protected admin UI at `/admin` for reviewing, editing and deleting posts and for managing API keys.

It runs as a Docker container on the same host as [Pangolin](https://github.com/fosrl/pangolin), on Pangolin's Docker network. Pangolin's Traefik serves it over HTTPS through a Local site (no Newt tunnel).

## Setup

The admin UI must be served over **HTTPS**. The session cookie is `Secure`, so browsers will not keep it over plain HTTP, and form submissions are checked against `ORIGIN`.

1. Copy the project to the server and create the data directory as your normal user (uid 1000, which the container runs as):

   ```sh
   mkdir data
   cp .env.example .env
   ```

2. Generate the admin password hash. This builds the image and prompts for the password twice:

   ```sh
   sudo docker compose build
   sudo docker compose run --rm -it --no-deps tidepool npm run hash-password
   ```

3. Edit `.env`:

   ```sh
   ORIGIN=https://tidepool.example.com
   ADMIN_PASSWORD_HASH='$argon2id$v=19$m=19456,t=2,p=1$...'
   SESSION_SECRET=<output of: openssl rand -base64 48>
   DATABASE_PATH=/data/tidepool.db
   ```

   > **Argon2 hashes contain `$`.** In `.env`, wrap the hash in **single quotes** as shown above. Docker Compose expands `$` in unquoted and double-quoted values, which would silently corrupt the hash. If you put the hash directly into `docker-compose.yml` instead, write every `$` as `$$`. Using `.env` is recommended.

4. Start it:

   ```sh
   sudo docker compose up -d --build
   ```

On startup the container runs database migrations. It exits with a clear message if any required environment variable is missing or invalid; check with `sudo docker compose logs tidepool`.

Tidepool publishes no host port. It joins the external `pangolin` Docker network that Pangolin's installer creates (check the name with `sudo docker network ls`), and Traefik reaches it there at `http://tidepool:3000`. Containers on the same network, such as n8n, reach the API at `http://tidepool:3000/posts`.

### Pangolin

In the Pangolin dashboard, create an HTTP resource on your **Local** site:

- Domain: the hostname you put in `ORIGIN`, for example `tidepool.example.com`
- Target: method `http`, host `tidepool`, port `3000`

`ORIGIN` must be exactly that HTTPS URL. SvelteKit rejects form submissions from any other origin.

Pangolin puts its own login in front of resources by default. **Turn off Pangolin authentication for this resource**: the public feed must be reachable by anyone, the admin UI has its own password, and API clients authenticate with a Bearer key, which Pangolin's login would block.

Behind Traefik, every request appears to come from Traefik's IP. Login is limited to 5 failed attempts per IP per 15 minutes, so tell Tidepool to read the client IP from the header Traefik sets. Otherwise one person mistyping locks everyone out. Add to `.env`:

```sh
ADDRESS_HEADER=X-Forwarded-For
XFF_DEPTH=1
```

This trusts only the address Traefik itself appended, so clients cannot forge it. Change `XFF_DEPTH` if you add another proxy, such as Cloudflare, in front of Pangolin. The rate limit is held in memory, so restarting the container clears it.

### Sessions

Sessions last 7 days. Logging out clears the cookie in that browser. To invalidate every session, for example after a leaked cookie, change `SESSION_SECRET` and restart.

## Public feed

`/` lists every event that hasn't ended yet, soonest first, 5 at a time, and loads more as you scroll. An event without an `end` drops off once it starts. Each card shows the poster, title, time, location and summary, and links to the original post. Times are shown in the event's own UTC offset, the local time at the venue.

The feed needs no login. It loads further pages from `/events?cursor=...` and posters from `/events/:id/image`, which are public too. Without JavaScript, a **More events** link pages through the feed instead.

The admin UI is at `/admin`.

## n8n

Create a **write** key under **Admin → API keys**, then add an **HTTP Request** node:

| Setting        | Value                                                        |
| -------------- | ------------------------------------------------------------ |
| Method         | `POST`                                                       |
| URL            | `http://tidepool:3000/posts`                                 |
| Authentication | Generic Credential Type → **Header Auth**                    |
| Header Auth    | Name `Authorization`, Value `Bearer tp_...` (your write key) |
| Send Body      | On, Body Content Type **JSON**, Specify Body **Using JSON**  |

Example body (`end`, `location` and `summary` may be `null`, but every field must be present):

```json
{
	"source": "instagram",
	"source_account": "base21.space",
	"source_id": "DYD1txkPDsA",
	"source_url": "https://www.instagram.com/p/DYD1txkPDsA/",
	"source_posted_at": "2026-10-07T03:00:00+00:00",
	"title": "Night market",
	"start": "2026-10-10T20:00:00+09:00",
	"end": null,
	"location": "Base21",
	"summary": "Food and music",
	"image": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

- A new (`source`, `source_id`) pair returns **201** with the created post.
- A pair that already exists returns **200** with the stored post **unchanged**, image included, so admin edits survive when n8n re-sends a post.
- Invalid input returns **400** with a message naming each problem field. A missing or unknown key returns **401**, and a read key returns **403**.

Datetimes must be ISO 8601 with seconds and a UTC offset (`2026-10-10T20:00:00+09:00` or `2026-10-10T11:00:00Z`). `start` and `end` are stored exactly as sent, but filtering and ordering use the instant they denote, so mixed offsets sort correctly.

### Images

`image` is required: a base64 data URL of a JPEG, PNG or WebP image (`data:image/jpeg;base64,...`, `data:image/png;base64,...` or `data:image/webp;base64,...`), at most **5 MB decoded**. Tidepool also checks that the bytes really are the declared type. The base64 must not contain line breaks or spaces. Otherwise the request fails with **400** and a message such as `image: must be image/jpeg, image/png, image/webp (got image/gif)`.

In n8n, download the image with an HTTP Request node (Response Format **File**), convert it with **Extract From File → Move File to Base64 String**, then build the field with an expression, for example `data:image/jpeg;base64,{{ $json.data }}`. Use the MIME type the image actually has.

A 5 MB image is about 7 MB once base64-encoded, more than adapter-node's default 512 KB request limit, so `docker-compose.yml` sets `BODY_SIZE_LIMIT=10M`. A request body over 10 MB is rejected by the server with **413** before Tidepool validates it.

Images are stored in the SQLite database, so deleting a post also deletes its image.

### Skipping posts already seen

Tidepool remembers every post n8n has classified, so the workflow only sends new posts to classification. Use a write key for all three calls.

1. **Check** which of the scraped posts are new, up to 100 ids per call. `unseen_ids` keeps your order:

   ```sh
   curl -X POST -H "Authorization: Bearer tp_..." -H "Content-Type: application/json" \
     -d '{"source": "instagram", "source_ids": ["DYD1txkPDsA", "DYC9abcDEFg"]}' \
     http://tidepool:3000/seen/check
   # {"unseen_ids": ["DYC9abcDEFg"]}
   ```

2. **Classify** only the unseen posts.
3. **Record** the result:
   - An event: `POST /posts` as above. Creating the post marks it seen.
   - Not an event: `POST /seen`. It returns **200** `{"seen": true}`, also when the post was already seen.

     ```json
     { "source": "instagram", "source_id": "DYC9abcDEFg", "outcome": "not_event" }
     ```

`POST /seen` only accepts `not_event` and returns **400** otherwise, since events must go through `POST /posts`. `POST /seen/check` needs a read key, `POST /seen` a write key.

A post deleted in the admin UI stays seen, so a false positive is never imported again. Posts that existed before seen-tracking was added are marked seen as events when the database is migrated.

## Reading the API

Every response post includes all source fields (`source`, `source_account`, `source_id`, `source_url`, `source_posted_at`), so you can always link back to the original post.

Use a **read** key (write keys can read too). Set it once:

```sh
TIDEPOOL=https://tidepool.example.com
KEY=tp_...
```

Each post also has `image_url`, an absolute URL (built from `ORIGIN`) that serves the raw image with its `Content-Type` and `Cache-Control: private, max-age=86400`. It needs the same read key, or an admin session in the browser:

```sh
curl -H "Authorization: Bearer $KEY" -o poster.jpg "$TIDEPOOL/posts/42/image"
```

`image_url` is `null` only for posts created before images were added.

A single post:

```sh
curl -H "Authorization: Bearer $KEY" "$TIDEPOOL/posts/42"
```

Upcoming events in November 2026 from one account:

```sh
curl -G -H "Authorization: Bearer $KEY" "$TIDEPOOL/posts" \
  --data-urlencode "start_from=2026-11-01T00:00:00+09:00" \
  --data-urlencode "start_to=2026-12-01T00:00:00+09:00" \
  --data-urlencode "source_account=base21.space"
```

| Parameter        | Meaning                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `start_from`     | Only events whose `start` is at or after this instant (inclusive) |
| `start_to`       | Only events whose `start` is before this instant (exclusive)      |
| `updated_since`  | Only posts created or edited at or after this instant             |
| `source_account` | Only posts from this account                                      |
| `limit`          | Page size, 1–200, default 50                                      |
| `cursor`         | The `next_cursor` from the previous page                          |

Results are ordered by `start`, then `id`. The response is `{"posts": [...], "next_cursor": "..." | null}`. Keep requesting with the returned `next_cursor` and the **same filters** until it is `null`:

```sh
cursor=""
while :; do
  page=$(curl -sfG -H "Authorization: Bearer $KEY" "$TIDEPOOL/posts" \
    --data-urlencode "limit=200" ${cursor:+--data-urlencode "cursor=$cursor"})
  echo "$page" | jq -c '.posts[]'
  cursor=$(echo "$page" | jq -r '.next_cursor // empty')
  [ -z "$cursor" ] && break
done
```

To sync incrementally, remember when you last ran and pass that time as `updated_since`.

## Backups

All data, images included, lives in `data/tidepool.db`. The database runs in WAL mode, so while the container is running, recent writes may still be in `tidepool.db-wal`. Stop the container before copying `data/`:

```sh
sudo docker compose stop && cp -a data data-backup && sudo docker compose start
```

## Development

```sh
npm install
npm run dev     # http://localhost:5173/admin
npm test        # vitest
npm run check   # svelte-check
```

`npm run dev` reads environment variables from `.env.development.local` (git-ignored). Vite expands `$` even inside single quotes, so escape each `$` with a backslash there:

```sh
ORIGIN=http://localhost:5173
ADMIN_PASSWORD_HASH=\$argon2id\$v=19\$m=19456,t=2,p=1\$...
SESSION_SECRET=dev-secret-at-least-32-characters-long
DATABASE_PATH=local.db
```

After changing `src/lib/server/db/schema.ts`, run `npm run db:generate` and commit the new migration in `drizzle/`. Migrations run automatically on startup.

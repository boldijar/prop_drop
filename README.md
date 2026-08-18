# Prop Drop — Facebook Group Sync

Cron job that scrapes Facebook group posts with [Apify](https://docs.apify.com/api/v2) and stores them in [Upstash Redis](https://console.upstash.com/).

## What it does

1. Reads group URLs from `FACEBOOK_GROUP_URLS`
2. Loads last sync date per group from `prodrop:config` in Upstash
3. Scrapes posts newer than that date via Apify (`apify/facebook-groups-scraper` by default)
4. Appends new posts (deduped by post id) to `prodrop:posts`
5. Updates each group's last sync date in `prodrop:config`

Default start date when no config exists: **now minus 6 hours** (UTC).

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UPSTASH_REDIS_REST_URL` | yes | Upstash REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | yes | Upstash REST token |
| `APIFY_API_TOKEN` | yes | Apify API token |
| `FACEBOOK_GROUP_URLS` | yes | Comma-separated Facebook group URLs |
| `APIFY_ACTOR_ID` | no | Apify actor id (default: `apify/facebook-groups-scraper`) |
| `RESULTS_LIMIT` | no | Posts per Apify page/batch (default: `100`) |
| `LOG_LEVEL` | no | `DEBUG`, `INFO`, `WARNING`, ... (default: `INFO`) |
| `MAX_PAGES_PER_GROUP` | no | Safety cap on pages per group (default: `500`) |

## Run locally

Zero dependencies — stdlib only. Uses **exported environment variables** (same as GitHub Actions).

```bash
cp env.sh.example env.sh   # fill in your values
source env.sh
./run
```

Or run steps individually:

```bash
./sync      # 1. scrape Facebook posts
./process   # 2. extract apartments with Gemini
```

On macOS, use `python3` or `./run`, not `python` (often Python 2.7).

## GitHub Actions

Workflow: `.github/workflows/prodrop-pipeline.yml`  
Schedule: every 6 hours (UTC). Runs `./run` (sync + process). You can also trigger it manually from the Actions tab.

Add these repository secrets:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `APIFY_API_TOKEN`
- `FACEBOOK_GROUP_URLS`
- `GEMINI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Optional env vars (local `env.sh` or GitHub variables):

- `APIFY_ACTOR_ID`
- `RESULTS_LIMIT`
- `GEMINI_MODEL`
- `LOG_LEVEL`
- `MAX_PAGES_PER_GROUP`
- `PRODROP_CONFIG`

## Upstash keys

- `prodrop:config` — JSON, e.g. `{"groups":{"https://www.facebook.com/groups/example":"2026-08-18T07:00:00Z"}}`
- `prodrop:posts` — JSON array of all posts from all groups
- `prodrop:apartments` — JSON array of extracted apartment listings

## Extract apartments (Gemini)

Processes posts using rules from [`prodrop.config`](prodrop.config) — schema, prompt, storage keys, and passthrough fields are all defined there for easy frontend reuse.

```bash
./process
```

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | yes | Google Gemini API key |
| `TELEGRAM_BOT_TOKEN` | no | Telegram bot token (final notification only) |
| `TELEGRAM_CHAT_ID` | no | Telegram chat id |
| `GEMINI_MODEL` | no | Overrides `processing.geminiModel` in config |
| `PRODROP_CONFIG` | no | Path to config file (default: `./prodrop.config`) |

**Safety:** posts are only removed from the source key after a batch is successfully extracted and saved. If Gemini fails, those posts stay in the queue for the next run.

Sends only the fields listed in `geminiInputFields` to Gemini. Passthrough fields (`postText`, `postUrl`, `postedAt`, `images`, etc.) are copied from the original post JSON.

**Telegram:** sends one final message on success (count, price range, m² range) or on error (error text). No per-batch spam.

To change entity type, schema, or prompt — edit `prodrop.config` only.

## Notes

- Groups must be **public** for the default Apify actor.
- Apify runs are billed per your Apify plan; see the [actor page](https://apify.com/apify/facebook-groups-scraper).
- Incremental sync uses each group's latest scraped post timestamp. If a run returns no posts, the last sync date is left unchanged.
- Pagination keeps calling Apify in batches until a page returns fewer than `RESULTS_LIMIT` posts (or a safety stop triggers). Each page is logged with batch size, new unique posts, and cumulative total.
- For actors that support `onlyPostsOlderThan` (e.g. `simpleapi/facebook-groups-scraper`), date-window pagination is used automatically.

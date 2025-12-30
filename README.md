# Bandcamp Stats

Send currently playing track to an hosted SQLite database.

A browser extension watch for a playing track on Bandcamp and send a request to
an API that will update a SQLite database.

## Bandcamp Wrapped

Generate a beautiful Bandcamp-themed visualization of your listening stats.

> **Note:** The wrapped generator (`api/build-wrapped.ts`) was created with assistance from an LLM (Claude Sonnet 4.5)

### Configuration

Create a `.env` file in the `api` directory (or copy from `.env.example`):
```bash
cd api
cp .env.example .env
```

Edit `.env` to set your Bandcamp profile username:
```env
BANDCAMP_PROFILE=your-username
```

Alternatively, you can pass the profile username as a second command-line argument.

### Usage

Generate wrapped for the current year:
```bash
cd api
deno task wrapped
```

Generate wrapped for a specific year:
```bash
cd api
deno task wrapped 2024
```

Generate with profile username via command line (no .env needed):
```bash
cd api
deno task wrapped 2025 your-username
```

This will create a `bandcamp-wrapped-{year}.html` file in the root directory that you can open in any browser.

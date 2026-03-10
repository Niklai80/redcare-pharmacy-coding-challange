# GitHub Repository Scorer

A backend service that fetches GitHub repositories via the GitHub Search API and ranks them by a composite **popularity score** derived from stars, forks, and update recency.

---

## Table of Contents

- [Quick Start](#quick-start)
- [API](#api)
- [Scoring Algorithm](#scoring-algorithm)
- [Configuration](#configuration)
- [Project Structure](#project-structure)
- [Testing](#testing)
- [Design Decisions](#design-decisions)

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# * Optionally -> Configure environment and add your GITHUB_TOKEN to .env

# 3. Run in development mode (auto-reload)
npm run dev

# 4. Query the API
curl "http://localhost:3000/search/repositories?createdAfter=2020-01-01&language=typescript"
```

---

## API

### `GET /repositories`

Search GitHub repositories and receive them ranked by popularity score.

#### Query Parameters

| Parameter      | Type   | Required | Default | Description                                                   |
| -------------- | ------ | -------- | ------- | ------------------------------------------------------------- |
| `createdAfter` | string | ✅       | —       | ISO date (`YYYY-MM-DD`). Earliest creation date.              |
| `language`     | string | ✅       | —       | Programming language (e.g. `typescript`).                     |
| `page`         | number | ❌       | `1`     | Page number (1–1000).                                         |
| `perPage`      | number | ❌       | `30`    | Results per page (1–100).                                     |
| `sort`         | string | ❌       | `stars` | GitHub sort field: `stars`, `forks`, `updated`, `best-match`. |

#### Example Request

```
GET /repositories?createdAfter=2021-01-01&language=rust&perPage=10
```

#### Example Response

```json
{
  "totalCount": 48210,
  "page": 1,
  "perPage": 10,
  "repositories": [
    {
      "id": 123456,
      "name": "tokio",
      "fullName": "tokio-rs/tokio",
      "url": "https://github.com/tokio-rs/tokio",
      "description": "A runtime for writing reliable asynchronous applications with Rust.",
      "language": "Rust",
      "owner": "tokio-rs",
      "stars": 24000,
      "forks": 2200,
      "openIssues": 250,
      "createdAt": "2018-03-01T00:00:00Z",
      "updatedAt": "2024-01-10T12:00:00Z",
      "pushedAt": "2024-01-10T11:30:00Z",
      "topics": ["async", "runtime", "rust"],
      "popularityScore": 72.45,
      "scoreBreakdown": {
        "stars": 80.12,
        "forks": 75.33,
        "recency": 98.5
      }
    }
  ]
}
```

### `GET /health`

```json
{ "status": "ok", "timestamp": "2026-03-10T12:00:00.000Z" }
```

---

## Scoring Algorithm

Each repository receives a **popularity score** between 0 and 100, computed as a weighted sum of three normalised dimensions:

```
popularityScore = w_stars × starScore
               + w_forks × forkScore
               + w_recency × recencyScore
```

### 1. Star Score (default weight: 50%)

Uses **log-normalisation** to prevent outliers from dominating:

```
starScore = min(100, log(stars + 1) / log(200,000 + 1) × 100)
```

The reference ceiling of 200,000 corresponds to the approximate star count of the most popular repositories (e.g. the Linux kernel). Repos with fewer stars are scored proportionally on a logarithmic scale.

### 2. Fork Score (default weight: 30%)

Same log-normalisation with a reference ceiling of 50,000 forks:

```
forkScore = min(100, log(forks + 1) / log(50,000 + 1) × 100)
```

### 3. Recency Score (default weight: 20%)

Uses **exponential decay** based on days since the last push:

```
recencyScore = 100 × e^(−λ × daysSinceLastPush)
where λ = ln(2) / halfLifeDays
```

With the default half-life of 365 days:

- A repo pushed **today** scores **100**
- A repo pushed **1 year ago** scores **~50**
- A repo pushed **2 years ago** scores **~25**

This models the intuition that recent activity is a strong signal of a healthy, maintained project.

### Why log-normalisation?

Star/fork counts follow a power-law distribution — a handful of repos have millions of stars while most have hundreds. Linear normalisation would collapse >99% of repos near 0. Log scale compresses the top end and spreads the middle, giving a more useful and fair distribution.

### Tuning

All weights and the recency half-life are configurable via environment variables — see [Configuration](#configuration).

---

## Configuration

Adjust `.env` as needed:

| Variable                       | Default   | Description                                                      |
| ------------------------------ | --------- | ---------------------------------------------------------------- |
| `PORT`                         | `3000`    | HTTP port                                                        |
| `GITHUB_TOKEN`                 | —         | GitHub PAT (strongly recommended; without it you get 10 req/min) |
| `SCORE_WEIGHT_STARS`           | `0.5`     | Star weight (must sum to 1.0 with the others)                    |
| `SCORE_WEIGHT_FORKS`           | `0.3`     | Fork weight                                                      |
| `SCORE_WEIGHT_RECENCY`         | `0.2`     | Recency weight                                                   |
| `SCORE_RECENCY_HALF_LIFE_DAYS` | `365`     | Days for recency score to halve                                  |
| `REF_STARS`                    | `200_000` | Reference values for normalisation                               |
| `REF_FORKS`                    | `10-000`  | Reference values for normalisation                               |

The application validates at startup that the three weights sum to 1.0 (±0.001 tolerance) and will throw an error if they do not.

---

## Project Structure

```
src/
├── config/
│   └── config.ts           # Environment config with validation
├── handlers/
│   └── gitHubHandler.ts    # Request handler for GET /search/repositories
├── middlewares/
│   └── errorHandler.ts     # Centralised error & 404 handling
├── routes/
│   └── gitHubRoutes.ts     # Express router
├── services/
│   ├── gitHubService.ts    # GitHub Search API client
│   └── scoring.ts          # Scoring algorithm
├── types/
│   └── index.ts            # TypeScript interfaces
├── utils/
│   └── validation.ts       # Zod schemas for query params
├── tests/
│   ├── handlers/
│   │   └── gitHubHandler.test.ts
│   ├── services/
│       ├── gitHubService.test.ts
│       └── scoring.test.ts
│
└── index.ts                # Express app, entry point
```

---

## Testing

```bash
# Run all tests
npm run test

# Run with coverage report
npm run test -- --coverage

```

---

## Design Decisions

| Decision                       | Rationale                                                                                                                                                   |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zod for validation**         | Gives precise, field-level error messages with TypeScript inference — no separate type definitions needed for request shapes.                               |
| **Log-normalisation**          | Star/fork data is power-law distributed; log scale prevents top outliers from collapsing the rest of the distribution.                                      |
| **Exponential recency decay**  | Continuous and smooth — avoids the cliff edge of arbitrary date thresholds. Configurable half-life makes it easy to tune for different ecosystems.          |
| **Configurable weights**       | Different use cases (e.g. finding maintained libs vs popular ones) benefit from different weightings.                                                       |
| **Sorted by popularityScore**  | Results from GitHub are sorted by the requested `sort` field; we re-sort by our composite score so the response is always most-popular-first by our metric. |
| **`satisfies` on mapped type** | Ensures the mapping from GitHub → `ScoredRepository` is exhaustive and type-checked at compile time without widening the inferred type.                     |

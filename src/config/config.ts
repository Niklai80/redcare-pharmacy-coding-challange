import dotenv from "dotenv";

dotenv.config();

const requireEnv = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

export const config = {
  server: {
    port: parseInt(process.env.PORT ?? "3000", 10),
    nodeEnv: process.env.NODE_ENV ?? "development",
  },

  github: {
    /** Personal Access Token — optional but strongly recommended to avoid rate limits */
    token: process.env.GITHUB_TOKEN,
    apiBaseUrl: "https://api.github.com",
    /** GitHub Search API max allowed per page */
    maxPerPage: 100,
  },

  scoring: {
    ref_stars: parseInt(requireEnv("REF_STARS", "200000"), 10),
    ref_forks: parseInt(requireEnv("REF_FORKS", "10000"), 10),
    /**
     * Weights for the three scoring dimensions. Must sum to 1.0.
     * Can be overridden via environment variables.
     */
    weights: {
      stars: parseFloat(process.env.SCORE_WEIGHT_STARS ?? "0.5"),
      forks: parseFloat(process.env.SCORE_WEIGHT_FORKS ?? "0.3"),
      recency: parseFloat(process.env.SCORE_WEIGHT_RECENCY ?? "0.2"),
    },
    /**
     * Half-life for the recency decay function, in days.
     * A repo last pushed exactly this many days ago receives a recency score of 50.
     */
    recencyHalfLifeDays: parseInt(
      process.env.SCORE_RECENCY_HALF_LIFE_DAYS ?? "365",
      10,
    ),
  },
} as const;

// Runtime validation: scoring weights must sum to 1.0 (±0.001 tolerance)
const { stars, forks, recency } = config.scoring.weights;
const weightSum = stars + forks + recency;
if (Math.abs(weightSum - 1.0) > 0.001) {
  throw new Error(
    `Scoring weights must sum to 1.0, got ${weightSum.toFixed(3)}. ` +
      `Check SCORE_WEIGHT_STARS, SCORE_WEIGHT_FORKS, SCORE_WEIGHT_RECENCY.`,
  );
}

export type Config = typeof config;

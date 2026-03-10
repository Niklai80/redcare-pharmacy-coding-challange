/**
 * Scoring Algorithm
 * ─────────────────
 * The composite popularity score is a weighted sum of three normalised factors,
 * each mapped to a 0–100 range:
 *
 *  1. Stars  — log-normalised: log(stars + 1) / log(REF_STARS + 1) × 100
 *  2. Forks  — log-normalised: log(forks + 1) / log(REF_FORKS + 1) × 100
 *  3. Recency — exponential decay: 100 × e^(−λ × daysSinceLastPush)
 *               where λ = ln(2) / halfLifeDays
 *
 * Log-normalisation keeps outliers (repos with millions of stars) from
 * dominating while still rewarding engagement growth.
 *
 * Reference values define the "ceiling" for normalisation; repos that exceed
 * them are capped at 100 for that dimension.
 */

import { config } from "../config/config";
import type {
  GitHubRepository,
  ScoreBreakdown,
  ScoredRepository,
  ScoringWeights,
} from "../types";

const { ref_stars, ref_forks } = config.scoring;

const MS_PER_DAY = 1000 * 60 * 60 * 24;

export function logNormalise(value: number, reference: number): number {
  if (value <= 0) return 0;
  const normalised = (Math.log(value + 1) / Math.log(reference + 1)) * 100;
  return Math.min(normalised, 100);
}

/**
 * Computes a recency score in [0, 100] using exponential decay.
 *
 * @param lastPushedAt  Date of the last push
 * @param halfLifeDays  Days after which score halves (default: 365)
 * @param now           Override the current date (useful for testing)
 */
export function recencyScore(
  lastPushedAt: string,
  halfLifeDays: number,
  now: Date = new Date(),
): number {
  const daysSinceLastPush =
    (now.getTime() - new Date(lastPushedAt).getTime()) / MS_PER_DAY;
  const lambda = Math.LN2 / halfLifeDays;
  if (daysSinceLastPush < 0) {
    // Future push date (shouldn't happen) - treat as most recent
    return 100;
  }
  return 100 * Math.exp(-lambda * daysSinceLastPush);
}

/**
 * Computes the weighted composite score and its breakdown for a single repo.
 */
export function scoreRepository(
  repo: GitHubRepository,
  weights: ScoringWeights,
  recencyHalfLifeDays: number,
): { popularityScore: number; scoreBreakdown: ScoreBreakdown } {
  const starScore = logNormalise(repo.stargazers_count, ref_stars);
  const forkScore = logNormalise(repo.forks_count, ref_forks);
  const recency = recencyScore(repo.pushed_at, recencyHalfLifeDays);

  const popularityScore =
    weights.stars * starScore +
    weights.forks * forkScore +
    weights.recency * recency;

  return {
    popularityScore: Math.round(popularityScore * 100) / 100,
    scoreBreakdown: {
      stars: Math.round(starScore * 100) / 100,
      forks: Math.round(forkScore * 100) / 100,
      recency: Math.round(recency * 100) / 100,
    },
  };
}

/**
 * Transforms and scores an array of raw GitHub repositories.
 * Results are sorted by popularityScore descending.
 */
export function scoreRepositories(
  repos: GitHubRepository[],
  weights: ScoringWeights,
  recencyHalfLifeDays: number,
): ScoredRepository[] {
  return repos
    .map((repo) => {
      const { popularityScore, scoreBreakdown } = scoreRepository(
        repo,
        weights,
        recencyHalfLifeDays,
      );

      return {
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        url: repo.html_url,
        description: repo.description,
        language: repo.language,
        owner: repo.owner.login,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
        createdAt: repo.created_at,
        updatedAt: repo.updated_at,
        pushedAt: repo.pushed_at,
        topics: repo.topics,
        popularityScore,
        scoreBreakdown,
      } satisfies ScoredRepository;
    })
    .sort((a, b) => b.popularityScore - a.popularityScore);
}

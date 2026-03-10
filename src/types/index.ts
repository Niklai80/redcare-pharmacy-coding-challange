export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  watchers_count: number;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  topics: string[];
}

export interface GitHubSearchResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GitHubRepository[];
}

export interface SearchRepositoriesQuery {
  /** Only repos created on or after this date */
  createdAfter: string;
  /** Programming language filter (e.g. "typescript", "python") */
  language: string;
  /** Page number (default: 1) */
  page?: number;
  /** Results per page, max 100 (default: 30) */
  perPage?: number;
  /** Sort field for GitHub query (default: "stars") */
  sort?: "stars" | "forks" | "updated" | "best-match";
}

export interface ScoringWeights {
  /** Weight applied to the normalised star score (0–1) */
  stars: number;
  /** Weight applied to the normalised fork score (0–1) */
  forks: number;
  /** Weight applied to the recency score (0–1) */
  recency: number;
}

export interface ScoreBreakdown {
  /** Normalised star contribution (0–100) */
  stars: number;
  /** Normalised fork contribution (0–100) */
  forks: number;
  /** Recency contribution (0–100) — decays exponentially with time since last push */
  recency: number;
}

export interface ScoredRepository {
  id: number;
  name: string;
  fullName: string;
  url: string;
  description: string | null;
  language: string | null;
  owner: string;
  stars: number;
  forks: number;
  openIssues: number;
  createdAt: string;
  updatedAt: string;
  pushedAt: string;
  topics: string[];
  /** Composite popularity score (0–100) */
  popularityScore: number;
  /** Breakdown of how each factor contributed to the score */
  scoreBreakdown: ScoreBreakdown;
}

export interface SearchRepositoriesResponse {
  totalCount: number;
  page: number;
  perPage: number;
  repositories: ScoredRepository[];
}

import { describe, it, expect, beforeEach } from "vitest";
import {
  logNormalise,
  recencyScore,
  scoreRepository,
  scoreRepositories,
} from "../../services/scoring";
import type { GitHubRepository, ScoringWeights } from "../../types";

describe("scoring service", () => {
  const defaultWeights: ScoringWeights = {
    stars: 0.5,
    forks: 0.3,
    recency: 0.2,
  };

  const mockRepository: GitHubRepository = {
    id: 1,
    name: "test-repo",
    full_name: "user/test-repo",
    html_url: "https://github.com/user/test-repo",
    description: "A test repository",
    language: "TypeScript",
    owner: {
      login: "testuser",
      avatar_url: "test-avatar-url",
    },
    stargazers_count: 1000,
    forks_count: 100,
    open_issues_count: 5,
    watchers_count: 1000,
    created_at: "2020-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    pushed_at: "2024-03-01T00:00:00Z",
    topics: ["typescript", "testing"],
  };

  describe("logNormalise", () => {
    it("should return 0 for zero or negative values", () => {
      expect(logNormalise(0, 100)).toBe(0);
      expect(logNormalise(-10, 100)).toBe(0);
    });

    it("should return 100 when value equals reference", () => {
      expect(logNormalise(100, 100)).toBeCloseTo(100);
    });

    it("should cap values at 100 when exceeding reference", () => {
      expect(logNormalise(10000, 100)).toBe(100);
      expect(logNormalise(50000, 1000)).toBe(100);
    });

    it("should return proportional scores for values below reference", () => {
      const score = logNormalise(50, 100);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(100);
    });

    it("should scale logarithmically", () => {
      const ref = 1000;
      const score1 = logNormalise(10, ref);
      const score2 = logNormalise(100, ref);
      const score3 = logNormalise(1000, ref);

      // Larger values should have higher scores
      expect(score3).toBeGreaterThan(score2);
      expect(score2).toBeGreaterThan(score1);

      // Logarithmic scale: equal multiplicative increases lead to equal additive increases
      // 10 * 10 = 100, 100 * 10 = 1000
      const diff1 = score2 - score1;
      const diff2 = score3 - score2;
      // Due to log scale, both diffs should be similar (10x multiplier each time)
      expect(Math.abs(diff1 - diff2)).toBeLessThan(5);
    });

    it("should handle very large values", () => {
      const score = logNormalise(1000000, 1000);
      expect(score).toBe(100);
    });
  });

  describe("recencyScore", () => {
    const testDate = new Date("2024-03-10T00:00:00Z");

    it("should return 100 for recent pushes", () => {
      const recentDate = new Date(testDate.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
      const score = recencyScore(recentDate.toISOString(), 365, testDate);
      expect(score).toBeCloseTo(100, 0);
    });

    it("should return ~50 for push at half-life", () => {
      const halfLifeDate = new Date(
        testDate.getTime() - 365 * 24 * 60 * 60 * 1000,
      ); // 365 days ago
      const score = recencyScore(halfLifeDate.toISOString(), 365, testDate);
      expect(score).toBeCloseTo(50, 0);
    });

    it("should return ~25 for push at 2x half-life", () => {
      const doubleHalfLifeDate = new Date(
        testDate.getTime() - 2 * 365 * 24 * 60 * 60 * 1000,
      ); // 730 days ago
      const score = recencyScore(
        doubleHalfLifeDate.toISOString(),
        365,
        testDate,
      );
      expect(score).toBeCloseTo(25, 0);
    });

    it("should decay exponentially", () => {
      const ref = 365;
      const score1Day = recencyScore(
        new Date(testDate.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        ref,
        testDate,
      );
      const score90Days = recencyScore(
        new Date(testDate.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        ref,
        testDate,
      );
      const score180Days = recencyScore(
        new Date(testDate.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(),
        ref,
        testDate,
      );

      expect(score1Day).toBeGreaterThan(score90Days);
      expect(score90Days).toBeGreaterThan(score180Days);
    });

    it("should return 100 for future dates", () => {
      const futureDate = new Date(
        testDate.getTime() + 10 * 24 * 60 * 60 * 1000,
      ); // 10 days in future
      const score = recencyScore(futureDate.toISOString(), 365, testDate);
      expect(score).toBe(100);
    });

    it("should always return score in [0, 100] range", () => {
      const pastDate = new Date(
        testDate.getTime() - 10000 * 24 * 60 * 60 * 1000,
      ); // Very old
      const score = recencyScore(pastDate.toISOString(), 365, testDate);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should respect custom half-life values", () => {
      const testDateTo = new Date("2024-03-10T00:00:00Z");
      const halfYear = 365 / 2;
      const halfYearAgoDate = new Date(
        testDateTo.getTime() - halfYear * 24 * 60 * 60 * 1000,
      );

      const score = recencyScore(
        halfYearAgoDate.toISOString(),
        halfYear,
        testDateTo,
      );
      expect(score).toBeCloseTo(50, 0);
    });
  });

  describe("scoreRepository", () => {
    it("should return valid score structure", () => {
      const result = scoreRepository(mockRepository, defaultWeights, 365);

      expect(result).toHaveProperty("popularityScore");
      expect(result).toHaveProperty("scoreBreakdown");
      expect(result.scoreBreakdown).toHaveProperty("stars");
      expect(result.scoreBreakdown).toHaveProperty("forks");
      expect(result.scoreBreakdown).toHaveProperty("recency");
    });

    it("should calculate weighted composite score", () => {
      const result = scoreRepository(mockRepository, defaultWeights, 365);

      const { stars, forks, recency } = result.scoreBreakdown;
      const expectedScore =
        defaultWeights.stars * stars +
        defaultWeights.forks * forks +
        defaultWeights.recency * recency;

      expect(result.popularityScore).toBeCloseTo(expectedScore, 1);
    });

    it("should return scores in [0, 100] range", () => {
      const result = scoreRepository(mockRepository, defaultWeights, 365);

      expect(result.popularityScore).toBeGreaterThanOrEqual(0);
      expect(result.popularityScore).toBeLessThanOrEqual(100);

      expect(result.scoreBreakdown.stars).toBeGreaterThanOrEqual(0);
      expect(result.scoreBreakdown.stars).toBeLessThanOrEqual(100);

      expect(result.scoreBreakdown.forks).toBeGreaterThanOrEqual(0);
      expect(result.scoreBreakdown.forks).toBeLessThanOrEqual(100);

      expect(result.scoreBreakdown.recency).toBeGreaterThanOrEqual(0);
      expect(result.scoreBreakdown.recency).toBeLessThanOrEqual(100);
    });

    it("should handle repos with zero stars and forks", () => {
      const zeroRepo: GitHubRepository = {
        ...mockRepository,
        stargazers_count: 0,
        forks_count: 0,
      };

      const result = scoreRepository(zeroRepo, defaultWeights, 365);

      expect(result.popularityScore).toBeGreaterThanOrEqual(0);
      expect(result.scoreBreakdown.stars).toBe(0);
      expect(result.scoreBreakdown.forks).toBe(0);
    });

    it("should give higher score to repo with more stars", () => {
      const moreStarsRepo: GitHubRepository = {
        ...mockRepository,
        stargazers_count: 50000,
        forks_count: 5000,
        pushed_at: "2024-03-09T00:00:00Z",
      };

      const result1 = scoreRepository(mockRepository, defaultWeights, 365);
      const result2 = scoreRepository(moreStarsRepo, defaultWeights, 365);

      expect(result2.popularityScore).toBeGreaterThan(result1.popularityScore);
    });

    it("should round to 2 decimal places", () => {
      const result = scoreRepository(mockRepository, defaultWeights, 365);

      const decimalPlaces = (num: number) => {
        const match = String(num).match(/(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/);
        if (!match) return 0;
        return Math.max(
          0,
          (match[1] ? match[1].length : 0) - (match[2] ? Number(match[2]) : 0),
        );
      };

      expect(decimalPlaces(result.popularityScore)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(result.scoreBreakdown.stars)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(result.scoreBreakdown.forks)).toBeLessThanOrEqual(2);
      expect(decimalPlaces(result.scoreBreakdown.recency)).toBeLessThanOrEqual(
        2,
      );
    });
  });

  describe("scoreRepositories", () => {
    it("should return array of scored repositories", () => {
      const repos = [mockRepository, mockRepository];
      const results = scoreRepositories(repos, defaultWeights, 365);

      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
    });

    it("should sort by popularity score descending", () => {
      const repo1: GitHubRepository = {
        ...mockRepository,
        id: 1,
        stargazers_count: 1000,
        forks_count: 50,
        pushed_at: "2024-01-01T00:00:00Z",
      };
      const repo2: GitHubRepository = {
        ...mockRepository,
        id: 2,
        stargazers_count: 5000,
        forks_count: 500,
        pushed_at: "2024-03-05T00:00:00Z",
      };
      const repo3: GitHubRepository = {
        ...mockRepository,
        id: 3,
        stargazers_count: 100,
        forks_count: 10,
        pushed_at: "2023-01-01T00:00:00Z",
      };

      const results = scoreRepositories(
        [repo1, repo2, repo3],
        defaultWeights,
        365,
      );

      expect(results.length).toBeGreaterThanOrEqual(3);
      expect(results[0]!.id).toBe(2); // Most popular
      expect(results[1]!.id).toBe(1); // Medium
      expect(results[2]!.id).toBe(3); // Least popular

      expect(results[0]!.popularityScore).toBeGreaterThanOrEqual(
        results[1]!.popularityScore,
      );
      expect(results[1]!.popularityScore).toBeGreaterThanOrEqual(
        results[2]!.popularityScore,
      );
    });

    it("should transform repository data correctly", () => {
      const results = scoreRepositories([mockRepository], defaultWeights, 365);

      const scored = results[0];
      if (!scored) {
        throw new Error("Expected at least one scored repository");
      }
      expect(scored.id).toBe(mockRepository.id);
      expect(scored.name).toBe(mockRepository.name);
      expect(scored.fullName).toBe(mockRepository.full_name);
      expect(scored.url).toBe(mockRepository.html_url);
      expect(scored.description).toBe(mockRepository.description);
      expect(scored.language).toBe(mockRepository.language);
      expect(scored.owner).toBe(mockRepository.owner.login);
      expect(scored.stars).toBe(mockRepository.stargazers_count);
      expect(scored.forks).toBe(mockRepository.forks_count);
      expect(scored.openIssues).toBe(mockRepository.open_issues_count);
      expect(scored.createdAt).toBe(mockRepository.created_at);
      expect(scored.updatedAt).toBe(mockRepository.updated_at);
      expect(scored.pushedAt).toBe(mockRepository.pushed_at);
      expect(scored.topics).toEqual(mockRepository.topics);
    });

    it("should handle empty array", () => {
      const results = scoreRepositories([], defaultWeights, 365);
      expect(results).toEqual([]);
    });

    it("should respect different weight distributions", () => {
      const recencyWeights: ScoringWeights = {
        stars: 0.1,
        forks: 0.1,
        recency: 0.8,
      };

      const repo1: GitHubRepository = {
        ...mockRepository,
        id: 1,
        stargazers_count: 10000,
        pushed_at: "2020-01-01T00:00:00Z", // Very old
      };
      const repo2: GitHubRepository = {
        ...mockRepository,
        id: 2,
        stargazers_count: 100,
        pushed_at: "2024-03-09T00:00:00Z", // Very recent
      };

      const results = scoreRepositories([repo1, repo2], recencyWeights, 365);

      // With high recency weight, repo2 should score higher despite fewer stars
      expect(results[0]!.id).toBe(2);
      expect(results[1]!.id).toBe(1);
    });

    it("should maintain all repositories in result", () => {
      const repo1 = { ...mockRepository, id: 1 };
      const repo2 = { ...mockRepository, id: 2 };
      const repo3 = { ...mockRepository, id: 3 };

      const results = scoreRepositories(
        [repo1, repo2, repo3],
        defaultWeights,
        365,
      );

      const ids = results.map((r) => r.id);
      expect(ids).toContain(1);
      expect(ids).toContain(2);
      expect(ids).toContain(3);
    });
  });
});

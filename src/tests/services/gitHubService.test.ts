import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { searchGitHubRepositories } from "../../services/gitHubService";
import type { SearchRepositoriesQuery } from "../../types";

describe("gitHubService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchGitHubRepositories", () => {
    it("should successfully fetch repositories with valid parameters", async () => {
      const mockResponse = {
        total_count: 100,
        incomplete_results: false,
        items: [
          {
            id: 1,
            name: "repo1",
            full_name: "user/repo1",
            url: "https://api.github.com/repos/user/repo1",
            stars: 1000,
            forks: 100,
            watchers: 50,
            language: "TypeScript",
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const params: SearchRepositoriesQuery = {
        createdAfter: "2024-01-01",
        language: "TypeScript",
        sort: "stars",
        perPage: 10,
        page: 1,
      };

      const result = await searchGitHubRepositories(params);

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledOnce();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("q="),
        expect.objectContaining({
          headers: {
            Accept: "application/vnd.github.v3+json",
          },
        }),
      );
    });

    it("should handle API errors correctly", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: "Unprocessable Entity",
        text: vi.fn().mockResolvedValueOnce("Validation error"),
      });

      const params: SearchRepositoriesQuery = {
        createdAfter: "2024-01-01",
        language: "TypeScript",
      };

      await expect(searchGitHubRepositories(params)).rejects.toThrow(
        "GitHub API error: 422 Unprocessable Entity",
      );
    });

    it("should handle network errors", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

      const params: SearchRepositoriesQuery = {
        createdAfter: "2024-01-01",
        language: "TypeScript",
      };

      await expect(searchGitHubRepositories(params)).rejects.toThrow(
        "Failed to fetch repositories from GitHub",
      );
    });

    it("should build correct query URL with all parameters", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ items: [], total_count: 0 }),
      });

      const params: SearchRepositoriesQuery = {
        createdAfter: "2024-01-01",
        language: "JavaScript",
        sort: "forks",
        perPage: 50,
        page: 2,
      };

      await searchGitHubRepositories(params);

      const callArgs = (global.fetch as any).mock.calls[0];
      const url = callArgs[0];

      expect(url).toContain("created%3A%3E%3D2024-01-01");
      expect(url).toContain("language%3AJavaScript");
      expect(url).toContain("per_page=50");
      expect(url).toContain("page=2");
      expect(url).toContain("sort=forks");
      expect(url).toContain("order=desc");
    });

    it("should handle empty search results", async () => {
      const mockResponse = {
        total_count: 0,
        incomplete_results: false,
        items: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce(mockResponse),
      });

      const params: SearchRepositoriesQuery = {
        createdAfter: "2024-01-01",
        language: "NonExistentLanguage",
      };

      const result = await searchGitHubRepositories(params);

      expect(result.items).toEqual([]);
      expect(result.total_count).toBe(0);
    });

    it("should use default pagination when not provided", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ items: [], total_count: 0 }),
      });

      const params: SearchRepositoriesQuery = {
        createdAfter: "2024-01-01",
        language: "TypeScript",
      };

      await searchGitHubRepositories(params);

      const callArgs = (global.fetch as any).mock.calls[0];
      const url = callArgs[0];

      // Should not have page or per_page params if not provided
      expect(url).not.toContain("page=");
      expect(url).not.toContain("per_page=");
    });

    it("should include correct headers in request", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValueOnce({ items: [], total_count: 0 }),
      });

      const params: SearchRepositoriesQuery = {
        createdAfter: "2024-01-01",
        language: "TypeScript",
      };

      await searchGitHubRepositories(params);

      const callArgs = (global.fetch as any).mock.calls[0];
      const options = callArgs[1];

      expect(options.headers).toEqual({
        Accept: "application/vnd.github.v3+json",
      });
    });
  });
});

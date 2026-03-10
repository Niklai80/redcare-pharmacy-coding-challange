import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { searchRepositories } from "../../handlers/gitHubHandler";
import * as gitHubService from "../../services/gitHubService";
import * as scoringService from "../../services/scoring";
import * as validation from "../../utils/validation";
import type {
  GitHubRepository,
  ScoredRepository,
  SearchRepositoriesResponse,
} from "../../types";

describe("gitHubHandler", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      query: {
        q: "typescript",
        page: "1",
        perPage: "30",
      },
    };

    mockRes = {
      json: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("searchRepositories", () => {
    const mockGitHubRepo: GitHubRepository = {
      id: 1,
      name: "test-repo",
      full_name: "user/test-repo",
      html_url: "https://github.com/user/test-repo",
      description: "Test repository",
      language: "TypeScript",
      owner: {
        login: "testuser",
        avatar_url: "https://avatars.com/test",
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

    const mockScoredRepo: ScoredRepository = {
      id: 1,
      name: "test-repo",
      fullName: "user/test-repo",
      url: "https://github.com/user/test-repo",
      description: "Test repository",
      language: "TypeScript",
      owner: "testuser",
      stars: 1000,
      forks: 100,
      openIssues: 5,
      createdAt: "2020-01-01T00:00:00Z",
      updatedAt: "2024-01-01T00:00:00Z",
      pushedAt: "2024-03-01T00:00:00Z",
      topics: ["typescript", "testing"],
      popularityScore: 85.5,
      scoreBreakdown: {
        stars: 90,
        forks: 80,
        recency: 85,
      },
    };

    it("should successfully search and score repositories", async () => {
      const mockGitHubResponse = {
        total_count: 100,
        incomplete_results: false,
        items: [mockGitHubRepo],
      };

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          page: 1,
          perPage: 30,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue(
        mockGitHubResponse as any,
      );

      vi.spyOn(scoringService, "scoreRepositories").mockReturnValue([
        mockScoredRepo,
      ]);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCount: 100,
          page: 1,
          perPage: 30,
          repositories: [mockScoredRepo],
        }) as SearchRepositoriesResponse,
      );
    });

    it("should parse query parameters correctly", async () => {
      const parseSpyFn = vi.fn().mockReturnValue({
        createdAfter: "2024-01-01",
        language: "TypeScript",
        page: 1,
        perPage: 30,
      });

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: parseSpyFn,
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue({
        total_count: 0,
        incomplete_results: false,
        items: [],
      } as any);

      vi.spyOn(scoringService, "scoreRepositories").mockReturnValue([]);

      mockReq.query = {
        q: "javascript",
        page: "2",
        perPage: "50",
      };

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(parseSpyFn).toHaveBeenCalledWith(mockReq.query);
    });

    it("should handle empty search results", async () => {
      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          page: 1,
          perPage: 30,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue({
        total_count: 0,
        incomplete_results: false,
        items: [],
      } as any);

      vi.spyOn(scoringService, "scoreRepositories").mockReturnValue([]);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCount: 0,
          repositories: [],
        }),
      );
    });

    it("should handle multiple repositories", async () => {
      const repo2: ScoredRepository = {
        ...mockScoredRepo,
        id: 2,
        name: "another-repo",
        popularityScore: 75,
      };

      const mockGitHubResponse = {
        total_count: 200,
        incomplete_results: false,
        items: [mockGitHubRepo, mockGitHubRepo],
      };

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          page: 1,
          perPage: 30,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue(
        mockGitHubResponse as any,
      );

      vi.spyOn(scoringService, "scoreRepositories").mockReturnValue([
        mockScoredRepo,
        repo2,
      ]);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          totalCount: 200,
          repositories: expect.arrayContaining([mockScoredRepo, repo2]),
        }),
      );
    });

    it("should call scoreRepositories with correct parameters", async () => {
      const mockGitHubResponse = {
        total_count: 100,
        incomplete_results: false,
        items: [mockGitHubRepo],
      };

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          page: 1,
          perPage: 30,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue(
        mockGitHubResponse as any,
      );

      const scoringSpy = vi
        .spyOn(scoringService, "scoreRepositories")
        .mockReturnValue([mockScoredRepo]);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(scoringSpy).toHaveBeenCalledWith(
        [mockGitHubRepo],
        expect.objectContaining({
          stars: expect.any(Number),
          forks: expect.any(Number),
          recency: expect.any(Number),
        }),
        expect.any(Number),
      );
    });

    it("should use default pagination values in response", async () => {
      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          // No page/perPage provided
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue({
        total_count: 50,
        incomplete_results: false,
        items: [],
      } as any);

      vi.spyOn(scoringService, "scoreRepositories").mockReturnValue([]);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          perPage: 30,
        }),
      );
    });

    it("should pass error to next middleware on validation error", async () => {
      const validationError = new Error("Validation failed");

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockImplementation(() => {
          throw validationError;
        }),
      } as any);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(validationError);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should pass error to next middleware on GitHub API error", async () => {
      const apiError = new Error("GitHub API Error");

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          page: 1,
          perPage: 30,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockRejectedValue(
        apiError,
      );

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(apiError);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should pass error to next middleware on scoring error", async () => {
      const scoringError = new Error("Scoring failed");

      const mockGitHubResponse = {
        total_count: 100,
        incomplete_results: false,
        items: [mockGitHubRepo],
      };

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          page: 1,
          perPage: 30,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue(
        mockGitHubResponse as any,
      );

      vi.spyOn(scoringService, "scoreRepositories").mockImplementation(() => {
        throw scoringError;
      });

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledWith(scoringError);
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should return properly formatted SearchRepositoriesResponse", async () => {
      const mockGitHubResponse = {
        total_count: 123,
        incomplete_results: true,
        items: [mockGitHubRepo],
      };

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2024-01-01",
          language: "TypeScript",
          page: 2,
          perPage: 50,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue(
        mockGitHubResponse as any,
      );

      vi.spyOn(scoringService, "scoreRepositories").mockReturnValue([
        mockScoredRepo,
      ]);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const callArg = (mockRes.json as any).mock.calls[0][0];

      expect(callArg).toHaveProperty("totalCount", 123);
      expect(callArg).toHaveProperty("page", 2);
      expect(callArg).toHaveProperty("perPage", 50);
      expect(callArg).toHaveProperty("repositories");
      expect(Array.isArray(callArg.repositories)).toBe(true);
    });

    it("should preserve pagination info from parsed query", async () => {
      const mockGitHubResponse = {
        total_count: 500,
        incomplete_results: false,
        items: [mockGitHubRepo],
      };

      vi.spyOn(validation, "searchQuerySchema", "get").mockReturnValue({
        parse: vi.fn().mockReturnValue({
          createdAfter: "2023-06-01",
          language: "Python",
          page: 5,
          perPage: 100,
        }),
      } as any);

      vi.spyOn(gitHubService, "searchGitHubRepositories").mockResolvedValue(
        mockGitHubResponse as any,
      );

      vi.spyOn(scoringService, "scoreRepositories").mockReturnValue([
        mockScoredRepo,
      ]);

      await searchRepositories(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 5,
          perPage: 100,
        }),
      );
    });
  });
});

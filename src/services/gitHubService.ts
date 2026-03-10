import { config } from "../config/config";
import type { GitHubSearchResponse, SearchRepositoriesQuery } from "../types";

function buildQuery(params: SearchRepositoriesQuery): string {
  const queryParts: string[] = [];

  // Repositories created after a certain date
  queryParts.push(`created:>=${params.createdAfter}`);

  // Filter by programming language
  queryParts.push(`language:${params.language}`);

  const q = queryParts.join(" ");

  const searchParams = new URLSearchParams();
  searchParams.append("q", q);
  if (params.page) {
    searchParams.append("page", params.page.toString());
  }
  if (params.perPage) {
    searchParams.append("per_page", params.perPage.toString());
  }
  if (params.sort) {
    searchParams.append("sort", params.sort);
  }
  searchParams.append("order", "desc");

  return searchParams.toString();
}

export async function searchGitHubRepositories(
  params: SearchRepositoriesQuery,
): Promise<GitHubSearchResponse> {
  const query = buildQuery(params);
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  try {
    const response = await fetch(
      `${config.github.apiBaseUrl}/search/repositories?${query}`,
      { headers },
    );
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `GitHub API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }
    const data = (await response.json()) as GitHubSearchResponse;
    console.log(">> data: ", data);
    return data;
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch repositories from GitHub: ${errMsg}`);
  }
}

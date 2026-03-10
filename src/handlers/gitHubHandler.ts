import type { NextFunction, Request, Response } from "express";
import { searchQuerySchema } from "../utils/validation";
import { searchGitHubRepositories } from "../services/gitHubService";
import { config } from "../config/config";
import { scoreRepositories } from "../services/scoring";
import type { SearchRepositoriesResponse } from "../types";

export async function searchRepositories(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = searchQuerySchema.parse(req.query);

    // Fetch repositories from GitHub API
    const gitHubResponse = await searchGitHubRepositories(params);

    const { weights, recencyHalfLifeDays } = config.scoring;

    const repositories = scoreRepositories(
      gitHubResponse.items,
      weights,
      recencyHalfLifeDays,
    );

    const response: SearchRepositoriesResponse = {
      totalCount: gitHubResponse.total_count,
      page: params.page || 1,
      perPage: params.perPage || 30,
      repositories,
    };

    res.json(response);
  } catch (error) {
    // const errMsg = error instanceof Error ? error.message : "Unknown error";
    // res
    //   .status(500)
    //   .json({
    //     error: "An error occurred while searching repositories",
    //     details: errMsg,
    //   });
    next(error);
  }
}

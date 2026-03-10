import { Router } from "express";
import { searchRepositories } from "../handlers/gitHubHandler";

const router = Router();

/**
 * @route  GET /search/repositories
 * @desc   Search GitHub repositories and return them scored by popularity
 * @access Public
 */
router.get("/search/repositories", searchRepositories);

export default router;

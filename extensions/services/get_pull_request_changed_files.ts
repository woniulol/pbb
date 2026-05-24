import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { BitbucketAuthConfig } from "../auth.js";
import type { PbbResult } from "../client.js";
import type { BitbucketRepoInfo } from "../repository.js";
import { getBitbucketPullRequest } from "./get_pull_request.js";

const execFileAsync = promisify(execFile);

export interface BitbucketPullRequestChangedFile {
    status: string;
    path: string;
    oldPath?: string;
}

export interface BitbucketPullRequestChangedFiles {
    pullRequestId: number;
    sourceBranch: string;
    destinationBranch: string;
    diffRef: string;
    fetch: boolean;
    files: BitbucketPullRequestChangedFile[];
}

export function parseGitNameStatus(output: string): BitbucketPullRequestChangedFile[] {
    return output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
            const [status = "", firstPath = "", secondPath] = line.split("\t");

            if ((status.startsWith("R") || status.startsWith("C")) && secondPath) {
                return {
                    status,
                    oldPath: firstPath,
                    path: secondPath,
                };
            }

            return {
                status,
                path: firstPath,
            };
        });
}

export async function getBitbucketPullRequestChangedFiles(
    authConfig: BitbucketAuthConfig,
    repoInfo: BitbucketRepoInfo,
    pullRequestId: number,
    options: { fetch?: boolean } = {},
): Promise<PbbResult<BitbucketPullRequestChangedFiles>> {
    const shouldFetch = options.fetch ?? true;
    const pullRequestResult = await getBitbucketPullRequest(
        authConfig,
        repoInfo,
        pullRequestId,
    );

    if (!pullRequestResult.ok) {
        return pullRequestResult;
    }

    const sourceBranch = pullRequestResult.data.source?.branch?.name;
    const destinationBranch = pullRequestResult.data.destination?.branch?.name;

    if (!sourceBranch || !destinationBranch) {
        return {
            ok: false,
            message: `Failed to get changed files for pull request ${pullRequestId}: missing source or destination branch`,
        };
    }

    try {
        if (shouldFetch) {
            await execFileAsync("git", ["fetch", "origin"]);
        }

        const diffRef = `origin/${destinationBranch}...origin/${sourceBranch}`;
        const { stdout } = await execFileAsync("git", [
            "diff",
            "--name-status",
            diffRef,
        ]);

        return {
            ok: true,
            data: {
                pullRequestId,
                sourceBranch,
                destinationBranch,
                diffRef,
                fetch: shouldFetch,
                files: parseGitNameStatus(stdout),
            },
        };
    } catch (error) {
        return {
            ok: false,
            message:
                error instanceof Error
                    ? `Local git error: ${error.message}`
                    : "Local git error: failed to get changed files",
        };
    }
}

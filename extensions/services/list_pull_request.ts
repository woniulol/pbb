import createBitbucketClient from "../client.js";
import type { PbbResult } from "../client.js";
import type { BitbucketAuthConfig } from "../auth.js";
import type { components } from "../generated/bitbucket-types.js";
import type { BitbucketRepoInfo } from "../repository.js";
import { runBitbucketRequest } from "./request.js";

export const BITBUCKET_PULL_REQUEST_STATES = [
    "OPEN",
    "MERGED",
    "DECLINED",
    "SUPERSEDED",
] as const;

export type BitbucketPullRequestState = (typeof BITBUCKET_PULL_REQUEST_STATES)[number];

export type BitbucketPullRequestsPage = components["schemas"]["paginated_pullrequests"];

export async function listBitbucketPullRequests(
    authConfig: BitbucketAuthConfig,
    repoInfo: BitbucketRepoInfo,
    state?: BitbucketPullRequestState,
): Promise<PbbResult<BitbucketPullRequestsPage>> {
    const client = createBitbucketClient(authConfig);
    return runBitbucketRequest(
        () =>
            client.GET("/repositories/{workspace}/{repo_slug}/pullrequests", {
                params: {
                    path: {
                        workspace: repoInfo.workspace,
                        repo_slug: repoInfo.repoSlug,
                    },
                    ...(state ? { query: { state } } : {}),
                },
            }),
        "Failed to list Bitbucket pull requests",
    );
}

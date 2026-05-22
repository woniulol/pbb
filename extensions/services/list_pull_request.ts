import createBitbucketClient from "../client.js";
import type { PbbResult } from "../client.js";
import type { BitbucketAuthConfig } from "../auth.js";
import type { components } from "../generated/bitbucket-types.js";
import type { BitbucketRepoInfo } from "../repository.js";

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

    try {
        const { data, response } = await client.GET(
            "/repositories/{workspace}/{repo_slug}/pullrequests",
            {
                params: {
                    path: {
                        workspace: repoInfo.workspace,
                        repo_slug: repoInfo.repoSlug,
                    },
                    ...(state ? { query: { state } } : {}),
                },
            },
        );

        if (!response.ok || !data) {
            return {
                ok: false,
                status: response.status,
                message: `Failed to list pull requests: HTTP ${response.status}`,
            };
        }

        return {
            ok: true,
            status: response.status,
            data,
        };
    } catch (error) {
        return {
            ok: false,
            message:
                error instanceof Error
                    ? `Network error: ${error.message}`
                    : "Network error: failed to connect to Bitbucket",
        };
    }
}

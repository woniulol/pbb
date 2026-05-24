import createBitbucketClient from "../client.js";
import type { PbbResult } from "../client.js";
import type { BitbucketAuthConfig } from "../auth.js";
import type { components } from "../generated/bitbucket-types.js";
import type { BitbucketRepoInfo } from "../repository.js";
import { runBitbucketRequest } from "./request.js";

export type BitbucketPullRequest = components["schemas"]["pullrequest"];

export async function getBitbucketPullRequest(
    authConfig: BitbucketAuthConfig,
    repoInfo: BitbucketRepoInfo,
    pullRequestId: number,
): Promise<PbbResult<BitbucketPullRequest>> {
    const client = createBitbucketClient(authConfig);
    return runBitbucketRequest(
        () =>
            client.GET(
                "/repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}",
                {
                    params: {
                        path: {
                            workspace: repoInfo.workspace,
                            repo_slug: repoInfo.repoSlug,
                            pull_request_id: pullRequestId,
                        },
                    },
                },
            ),
        `Failed to get Bitbucket pull request ${pullRequestId}`,
    );
}

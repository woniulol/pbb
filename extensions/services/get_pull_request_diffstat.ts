import createBitbucketClient from "../client.js";
import type { PbbResult } from "../client.js";
import type { BitbucketAuthConfig } from "../auth.js";
import type { components } from "../generated/bitbucket-types.js";
import type { BitbucketRepoInfo } from "../repository.js";
import { getBitbucketPullRequest } from "./get_pull_request.js";
import { runBitbucketRequest } from "./request.js";

export type BitbucketPullRequestDiffstatPage =
    components["schemas"]["paginated_diffstats"];

export async function getBitbucketPullRequestDiffstat(
    authConfig: BitbucketAuthConfig,
    repoInfo: BitbucketRepoInfo,
    pullRequestId: number,
): Promise<PbbResult<BitbucketPullRequestDiffstatPage>> {
    const pullRequestResult = await getBitbucketPullRequest(
        authConfig,
        repoInfo,
        pullRequestId,
    );

    if (!pullRequestResult.ok) {
        return pullRequestResult;
    }

    const sourceHash = pullRequestResult.data.source?.commit?.hash;
    const destinationHash = pullRequestResult.data.destination?.commit?.hash;

    if (!sourceHash || !destinationHash) {
        return {
            ok: false,
            message: `Failed to get Bitbucket pull request ${pullRequestId} diffstat: missing source or destination commit hash`,
        };
    }

    const client = createBitbucketClient(authConfig);
    const spec = `${sourceHash}..${destinationHash}`;

    return runBitbucketRequest(
        () =>
            client.GET("/repositories/{workspace}/{repo_slug}/diffstat/{spec}", {
                params: {
                    path: {
                        workspace: repoInfo.workspace,
                        repo_slug: repoInfo.repoSlug,
                        spec,
                    },
                    query: {
                        topic: true,
                    },
                },
            }),
        `Failed to get Bitbucket pull request ${pullRequestId} diffstat`,
    );
}

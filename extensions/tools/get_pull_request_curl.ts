import { defineTool } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { formatBitbucketCurlError } from "../bitbucket_error.js";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import { curlJson } from "../curl/json.js";
import type { components } from "../generated/bitbucket-types.js";
import { STATUS_ICON } from "../ui.js";

export const getBitbucketPullRequestCurlParams = Type.Object({
    pullRequestId: Type.Number({ minimum: 1 }),
});

type BitbucketPullRequestResponse = components["schemas"]["pullrequest"];

export interface GetBitbucketPullRequestCurlToolDetail {
    repo?: string;
    pullRequestId?: number;
    title?: string;
    state?: string;
    sourceBranch?: string;
    destinationBranch?: string;
    url?: string;
}

function getBranchName(
    pullRequest: BitbucketPullRequestResponse,
    side: "source" | "destination",
): string | undefined {
    return pullRequest[side]?.branch?.name;
}

function getHtmlUrl(pullRequest: BitbucketPullRequestResponse): string | undefined {
    return pullRequest.links?.html?.href;
}

export const getBitbucketPullRequestCurlTool = defineTool<
    typeof getBitbucketPullRequestCurlParams,
    GetBitbucketPullRequestCurlToolDetail
>({
    name: "bitbucket_get_pull_request",
    label: "get Bitbucket pull request",
    description:
        "Get key information for a pull request in the current Bitbucket repository using curl.",
    parameters: getBitbucketPullRequestCurlParams,
    async execute(toolCallId, parameters, signal, onUpdate, ctx) {
        const context = await getBitbucketContext();
        if (!hasCompleteBitbucketContext(context)) {
            return {
                content: [
                    {
                        type: "text",
                        text: "bitbucket API access not checked",
                    },
                ],
                details: {},
            };
        }

        const { authConfig, repoInfo } = context;
        const apiBaseUrl = authConfig.apiBaseUrl.replace(/\/$/, "");
        const url = `${apiBaseUrl}/repositories/${repoInfo.workspace}/${repoInfo.repoSlug}/pullrequests/${parameters.pullRequestId}`;
        const result = await curlJson<BitbucketPullRequestResponse>({
            method: "GET",
            url,
            auth: {
                type: "basic",
                username: authConfig.user,
                password: authConfig.accessToken,
            },
        });

        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get pull request ${parameters.pullRequestId}: ${formatBitbucketCurlError(result.error)}.`,
                    },
                ],
                details: {},
            };
        }

        const pullRequest = result.value.data;
        if (!pullRequest) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Bitbucket returned an empty response body for pull request ${parameters.pullRequestId}.`,
                    },
                ],
                details: {},
            };
        }

        const sourceBranch = getBranchName(pullRequest, "source");
        const destinationBranch = getBranchName(pullRequest, "destination");
        const pullRequestUrl = getHtmlUrl(pullRequest);
        const title = pullRequest.title;
        const state = pullRequest.state;

        return {
            content: [
                {
                    type: "text",
                    text: `pull request ${parameters.pullRequestId} found: title=${title ?? "unknown"}; state=${state ?? "unknown"}; source=${sourceBranch ?? "unknown"}; destination=${destinationBranch ?? "unknown"}; url=${pullRequestUrl ?? "unknown"}`,
                },
            ],
            details: {
                repo: `${repoInfo.workspace}/${repoInfo.repoSlug}`,
                pullRequestId: parameters.pullRequestId,
                ...(title === undefined ? {} : { title }),
                ...(state === undefined ? {} : { state }),
                ...(sourceBranch === undefined ? {} : { sourceBranch }),
                ...(destinationBranch === undefined ? {} : { destinationBranch }),
                ...(pullRequestUrl === undefined ? {} : { url: pullRequestUrl }),
            },
        };
    },
    renderCall(args, theme, context) {
        return new Text(
            `${STATUS_ICON.ok} getting Bitbucket pull request ${args.pullRequestId}`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        if (!result.details || Object.keys(result.details).length === 0) {
            const firstText = result.content.find((item) => item.type === "text")?.text;
            return new Text(firstText ?? "Bitbucket PR result", 0, 0);
        }
        const text = `${STATUS_ICON.ok} pull request ${result.details.pullRequestId} found in ${result.details.repo}`;
        return new Text(text, 0, 0);
    },
});

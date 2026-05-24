import { defineTool } from "@earendil-works/pi-coding-agent";
import * as Type from "typebox";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import { getBitbucketPullRequest } from "../services/get_pull_request.js";
import { STATUS_ICON } from "../ui.js";
import { Text } from "@earendil-works/pi-tui";

export const getBitbucketPullRequestParams = Type.Object({
    pullRequestId: Type.Number({ minimum: 1 }),
});

export interface getBitbucketPullRequestToolDetail {
    repo?: string;
    pullRequestId?: number;
}

export const getBitBucketPullRequestTool = defineTool<
    typeof getBitbucketPullRequestParams,
    getBitbucketPullRequestToolDetail
>({
    name: "bitbucket_get_pull_request",
    label: "get bitbucket pull requests",
    description:
        "Use when you need to get information of a pull request for the current Bitbucket repository.",
    parameters: getBitbucketPullRequestParams,
    async execute(toolCallId, parameters, signal, onUpdate, ctx) {
        const context = await getBitbucketContext();
        if (!hasCompleteBitbucketContext(context)) {
            return {
                content: [
                    {
                        type: "text",
                        text: `bitbucket API access not checked`,
                    },
                ],
                details: {},
            };
        }

        const result = await getBitbucketPullRequest(
            context.authConfig,
            context.repoInfo,
            parameters.pullRequestId,
        );

        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get pull request ${parameters.pullRequestId}: ${result.message}.`,
                    },
                ],
                details: {},
            };
        }

        const pullRequest = result.data;
        return {
            content: [
                {
                    type: "text",
                    text: `pull request ${parameters.pullRequestId} found. ${JSON.stringify(pullRequest)}`,
                },
            ],
            details: {
                repo: `${context.repoInfo.workspace}/${context.repoInfo.repoSlug}`,
                pullRequestId: parameters.pullRequestId,
            },
        };
    },
    renderCall(args, theme, context) {
        return new Text(
            `${STATUS_ICON.ok} getting Bitbucket pull requests ${args.pullRequestId}`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        if (!result.details) {
            return new Text("Bitbucket PR result", 0, 0);
        }
        let text = `${STATUS_ICON.ok} pull request ${result.details.pullRequestId} found in ${result.details.repo}`;
        return new Text(text, 0, 0);
    },
});

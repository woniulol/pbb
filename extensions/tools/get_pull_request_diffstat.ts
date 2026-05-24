import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import { getBitbucketPullRequestDiffstat } from "../services/get_pull_request_diffstat.js";
import { STATUS_ICON } from "../ui.js";

export const getBitbucketPullRequestDiffstatParams = Type.Object({
    pullRequestId: Type.Number({ minimum: 1 }),
});

interface GetBitbucketPullRequestDiffstatToolDetails {
    repo?: string;
    pullRequestId?: number;
    count?: number;
    hasNextPage?: boolean;
}

export const getBitbucketPullRequestDiffstatTool = defineTool<
    typeof getBitbucketPullRequestDiffstatParams,
    GetBitbucketPullRequestDiffstatToolDetails
>({
    name: "bitbucket_get_pull_request_diffstat",
    label: "get Bitbucket pull request diffstat",
    description:
        "Use when you need to inspect changed files for a pull request in the current Bitbucket repository.",
    parameters: getBitbucketPullRequestDiffstatParams,

    async execute(
        toolCallId,
        parameters,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<GetBitbucketPullRequestDiffstatToolDetails>> {
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

        const result = await getBitbucketPullRequestDiffstat(
            context.authConfig,
            context.repoInfo,
            parameters.pullRequestId,
        );

        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get pull request ${parameters.pullRequestId} diffstat: ${result.message}.`,
                    },
                ],
                details: {},
            };
        }

        const diffstats = result.data.values ?? [];
        return {
            content: [
                {
                    type: "text",
                    text: `pull request ${parameters.pullRequestId} diffstat found. ${JSON.stringify(diffstats)}`,
                },
            ],
            details: {
                repo: `${context.repoInfo.workspace}/${context.repoInfo.repoSlug}`,
                pullRequestId: parameters.pullRequestId,
                count: diffstats.length,
                hasNextPage: Boolean(result.data.next),
            },
        };
    },

    renderCall(args, theme, context) {
        return new Text(
            `${STATUS_ICON.ok} getting diffstat for Bitbucket pull request #${args.pullRequestId}`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        if (!result.details) {
            return new Text("Bitbucket PR diffstat result", 0, 0);
        }

        let text = `${STATUS_ICON.ok} pull request ${result.details.pullRequestId ?? "?"} diffstat found: ${result.details.count ?? 0} file(s) changed in ${result.details.repo ?? "current repo"}`;
        if (result.details.hasNextPage) {
            text += " More changed files are available.";
        }
        return new Text(text, 0, 0);
    },
});

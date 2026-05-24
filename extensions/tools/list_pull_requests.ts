import {
    AgentToolResult,
    defineTool,
    type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import * as Type from "typebox";
import { listBitbucketPullRequests } from "../services/list_pull_request.js";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import { Text } from "@earendil-works/pi-tui";
import { STATUS_ICON } from "../ui.js";

export const listBitbucketPullRequestsParams = Type.Object({
    state: Type.Optional(
        Type.Union([
            Type.Literal("OPEN"),
            Type.Literal("MERGED"),
            Type.Literal("DECLINED"),
            Type.Literal("SUPERSEDED"),
        ]),
    ),
});

interface BitbucketListPullRequestToolDetails {
    repo?: string;
    state?: string;
    count?: number;
    hasNextPage?: boolean;
}

export const listBitbucketPullRequestsTool = defineTool<
    typeof listBitbucketPullRequestsParams,
    BitbucketListPullRequestToolDetails
>({
    name: "bitbucket_list_pull_requests",
    label: "list bitbucket pull requests",
    description:
        "Use when you need to list pull requests for the current Bitbucket repository.",
    parameters: listBitbucketPullRequestsParams,

    async execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<BitbucketListPullRequestToolDetails>> {
        const state = params.state ?? "OPEN";
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

        const result = await listBitbucketPullRequests(
            context.authConfig,
            context.repoInfo,
            state,
        );
        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to list ${state.toLowerCase()} pull requests: ${result.message}.`,
                    },
                ],
                details: {},
            };
        }

        const pullRequests = result.data.values ?? [];
        return {
            content: [
                {
                    type: "text",
                    text: `${pullRequests.length} ${state.toLowerCase()} pull request(s) found. ${JSON.stringify(pullRequests)}`,
                },
            ],
            details: {
                repo: `${context.repoInfo.workspace}/${context.repoInfo.repoSlug}`,
                state,
                count: pullRequests.length,
                hasNextPage: Boolean(result.data.next),
            },
        };
    },

    renderCall(args, theme, context) {
        const state = typeof args.state === "string" ? args.state : "OPEN";
        return new Text(
            `${STATUS_ICON.ok} listing ${state.toLowerCase()} Bitbucket pull requests`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        if (!result.details) {
            return new Text("Bitbucket PR result", 0, 0);
        }
        let text = `${STATUS_ICON.ok} ${result.details.count ?? 0} ${result.details.state?.toLowerCase() ?? "open"} pull request(s) found in ${result.details.repo}`;
        if (result.details.hasNextPage) {
            text += " More pull requests are available.";
        }
        return new Text(text, 0, 0);
    },
});

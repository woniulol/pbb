import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { formatBitbucketCurlError } from "../bitbucket_error.js";
import { curlJson } from "../curl/json.js";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import type { components } from "../generated/bitbucket-types.js";
import { STATUS_ICON } from "../ui.js";

export const createBitbucketPullRequestCurlParams = Type.Object({
    title: Type.String({ description: "Pull request title." }),
    sourceBranch: Type.String({ description: "Source branch name." }),
    destinationBranch: Type.String({ description: "Destination branch name." }),
    description: Type.Optional(
        Type.String({ description: "Pull request description." }),
    ),
    closeSourceBranch: Type.Optional(
        Type.Boolean({
            description:
                "Whether Bitbucket should close/delete the source branch after merge.",
        }),
    ),
});

type BitbucketPullRequestResponse = components["schemas"]["pullrequest"];

interface CreatePullRequestCurlToolDetails {
    repo?: string;
    pullRequestId?: number;
    title?: string;
    sourceBranch?: string;
    destinationBranch?: string;
    url?: string;
}

export const createBitbucketPullRequestCurlTool = defineTool<
    typeof createBitbucketPullRequestCurlParams,
    CreatePullRequestCurlToolDetails
>({
    name: "bitbucket_create_pull_request",
    label: "create Bitbucket pull request",
    description:
        "Create a Bitbucket pull request using curl. Keep inputs explicit: title, source branch, destination branch, and optional description.",
    parameters: createBitbucketPullRequestCurlParams,

    async execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<CreatePullRequestCurlToolDetails>> {
        const context = await getBitbucketContext();
        if (!hasCompleteBitbucketContext(context)) {
            return {
                content: [{ type: "text", text: "bitbucket API access not checked" }],
                details: {},
            };
        }

        const title = params.title.trim();
        const sourceBranch = params.sourceBranch.trim();
        const destinationBranch = params.destinationBranch.trim();

        if (!title || !sourceBranch || !destinationBranch) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Pull request title, source branch, and destination branch are required.",
                    },
                ],
                details: {},
            };
        }

        const { authConfig, repoInfo } = context;
        const apiBaseUrl = authConfig.apiBaseUrl.replace(/\/$/, "");
        const url = `${apiBaseUrl}/repositories/${repoInfo.workspace}/${repoInfo.repoSlug}/pullrequests`;
        const result = await curlJson<BitbucketPullRequestResponse>({
            method: "POST",
            url,
            headers: {
                Authorization: `Bearer ${authConfig.accessToken}`,
            },
            body: {
                title,
                source: { branch: { name: sourceBranch } },
                destination: { branch: { name: destinationBranch } },
                ...(params.description === undefined
                    ? {}
                    : { description: params.description }),
                ...(params.closeSourceBranch === undefined
                    ? {}
                    : { close_source_branch: params.closeSourceBranch }),
            },
        });

        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to create pull request: ${formatBitbucketCurlError(result.error)}`,
                    },
                ],
                details: {},
            };
        }

        const data = result.value.data;
        if (!data) {
            return {
                content: [
                    {
                        type: "text",
                        text: "Bitbucket created the pull request but returned an empty response body.",
                    },
                ],
                details: {},
            };
        }

        const pullRequestUrl = data.links?.html?.href;
        return {
            content: [
                {
                    type: "text",
                    text: `pull request ${data.id ?? "?"} created: ${pullRequestUrl ?? "no url"}`,
                },
            ],
            details: {
                repo: `${repoInfo.workspace}/${repoInfo.repoSlug}`,
                title,
                sourceBranch,
                destinationBranch,
                ...(data.id === undefined ? {} : { pullRequestId: data.id }),
                ...(pullRequestUrl === undefined ? {} : { url: pullRequestUrl }),
            },
        };
    },

    renderCall(args) {
        return new Text(
            `${STATUS_ICON.ok} creating Bitbucket pull request ${args.sourceBranch} → ${args.destinationBranch}`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        const firstText = result.content.find((item) => item.type === "text")?.text;
        if (!result.details || Object.keys(result.details).length === 0) {
            return new Text(firstText ?? "Bitbucket create pull request result", 0, 0);
        }

        return new Text(
            `${STATUS_ICON.ok} pull request ${result.details.pullRequestId ?? "?"} created: ${result.details.url ?? result.details.title ?? "no url"}`,
            0,
            0,
        );
    },
});

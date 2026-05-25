import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { formatBitbucketCurlError } from "../bitbucket_error.js";
import { curlJson } from "../curl/json.js";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import type { components } from "../generated/bitbucket-types.js";
import { STATUS_ICON } from "../ui.js";

export const createBitbucketPullRequestInlineCommentCurlParams = Type.Object({
    pullRequestId: Type.Number({ minimum: 1 }),
    path: Type.String({
        description: "Repository-relative path to the changed file to comment on.",
    }),
    line: Type.Number({
        minimum: 1,
        description: "One-based line number to anchor the comment to.",
    }),
    body: Type.String({ description: "Comment body to post." }),
    side: Type.Optional(
        Type.Union([Type.Literal("new"), Type.Literal("old")], {
            description:
                "Use new for added/current file lines (Bitbucket inline.to), or old for removed/base lines (Bitbucket inline.from). Defaults to new.",
        }),
    ),
});

type InlineCommentSide = "new" | "old";

type BitbucketCommentResponse = components["schemas"]["pullrequest_comment"];

interface CreateInlineCommentCurlToolDetails {
    repo?: string;
    pullRequestId?: number;
    commentId?: number;
    path?: string;
    line?: number;
    side?: InlineCommentSide;
    url?: string;
}

function normalizePath(path: string): string {
    return path.trim().replace(/^\.\//, "");
}

function isUnsafeRepositoryPath(path: string): boolean {
    return path.startsWith("/") || path.split("/").includes("..");
}

function getCommentId(data: BitbucketCommentResponse): number | undefined {
    return typeof data.id === "number" ? data.id : undefined;
}

function getHtmlUrl(data: BitbucketCommentResponse): string | undefined {
    const links = data.links as { html?: { href?: string } } | undefined;
    return links?.html?.href;
}

export const createBitbucketPullRequestInlineCommentCurlTool = defineTool<
    typeof createBitbucketPullRequestInlineCommentCurlParams,
    CreateInlineCommentCurlToolDetails
>({
    name: "bitbucket_create_pull_request_inline_comment",
    label: "create Bitbucket pull request inline comment",
    description:
        "Post an inline review comment to Bitbucket using curl. Before using this tool, verify the file/line belongs to the PR diff with the available PR and git diff tools.",
    parameters: createBitbucketPullRequestInlineCommentCurlParams,

    async execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<CreateInlineCommentCurlToolDetails>> {
        const context = await getBitbucketContext();
        if (!hasCompleteBitbucketContext(context)) {
            return {
                content: [{ type: "text", text: "bitbucket API access not checked" }],
                details: {},
            };
        }

        const path = normalizePath(params.path);
        if (!path || isUnsafeRepositoryPath(path)) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Invalid repository-relative path: ${params.path}`,
                    },
                ],
                details: {},
            };
        }

        const body = params.body.trim();
        if (!body) {
            return {
                content: [{ type: "text", text: "Comment body is required" }],
                details: {},
            };
        }

        const side = params.side ?? "new";
        const inline =
            side === "old" ? { path, from: params.line } : { path, to: params.line };
        const { authConfig, repoInfo } = context;
        const apiBaseUrl = authConfig.apiBaseUrl.replace(/\/$/, "");
        const url = `${apiBaseUrl}/repositories/${repoInfo.workspace}/${repoInfo.repoSlug}/pullrequests/${params.pullRequestId}/comments`;

        const result = await curlJson<BitbucketCommentResponse>({
            method: "POST",
            url,
            auth: {
                type: "basic",
                username: authConfig.user,
                password: authConfig.accessToken,
            },
            body: {
                content: { raw: body },
                inline,
            },
        });

        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to create inline comment on pull request ${params.pullRequestId}: ${formatBitbucketCurlError(result.error)}`,
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
                        text: "Bitbucket created the inline comment but returned an empty response body.",
                    },
                ],
                details: {},
            };
        }

        const commentId = getCommentId(data);
        const commentUrl = getHtmlUrl(data);
        return {
            content: [
                {
                    type: "text",
                    text: `inline comment ${commentId ?? "?"} created on pull request ${params.pullRequestId}: ${commentUrl ?? "no url"}`,
                },
            ],
            details: {
                repo: `${repoInfo.workspace}/${repoInfo.repoSlug}`,
                pullRequestId: params.pullRequestId,
                path,
                line: params.line,
                side,
                ...(commentId === undefined ? {} : { commentId }),
                ...(commentUrl === undefined ? {} : { url: commentUrl }),
            },
        };
    },

    renderCall(args) {
        return new Text(
            `${STATUS_ICON.ok} creating inline comment on Bitbucket pull request #${args.pullRequestId} (${args.path}:${args.line})`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        const firstText = result.content.find((item) => item.type === "text")?.text;
        if (!result.details || Object.keys(result.details).length === 0) {
            return new Text(firstText ?? "Bitbucket PR inline comment result", 0, 0);
        }

        const args = context.args as {
            pullRequestId?: number;
            path?: string;
            line?: number;
        };
        const pullRequestId = result.details.pullRequestId ?? args.pullRequestId ?? "?";
        const path = result.details.path ?? args.path ?? "?";
        const line = result.details.line ?? args.line ?? "?";
        return new Text(
            `${STATUS_ICON.ok} inline comment ${result.details.commentId ?? "?"} created on pull request ${pullRequestId} at ${path}:${line}`,
            0,
            0,
        );
    },
});

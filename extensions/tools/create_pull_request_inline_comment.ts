import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import {
    createBitbucketPullRequestInlineComment,
    type BitbucketInlineCommentSide,
    type CreateBitbucketPullRequestInlineCommentOptions,
} from "../services/create_pull_request_inline_comment.js";
import { STATUS_ICON } from "../ui.js";

export const createBitbucketPullRequestInlineCommentParams = Type.Object({
    pullRequestId: Type.Number({ minimum: 1 }),
    path: Type.String({
        description: "Repository-relative path to the changed file to comment on.",
    }),
    line: Type.Number({
        minimum: 1,
        description: "One-based line number to anchor the comment to.",
    }),
    body: Type.String({ description: "Markdown comment body to post." }),
    side: Type.Optional(
        Type.Union([Type.Literal("new"), Type.Literal("old")], {
            description:
                "Use new for added/current file lines (Bitbucket inline.to), or old for removed/base lines (Bitbucket inline.from). Defaults to new.",
        }),
    ),
    fetch: Type.Optional(
        Type.Boolean({
            description:
                "Whether to run git fetch before validating changed files. Defaults to true.",
        }),
    ),
});

interface CreateBitbucketPullRequestInlineCommentToolDetails {
    repo?: string;
    pullRequestId?: number;
    commentId?: number;
    path?: string;
    line?: number;
    side?: BitbucketInlineCommentSide;
    url?: string;
}

type InlineCommentRenderArgs = {
    pullRequestId?: number;
    path?: string;
    line?: number;
};

function getCommentHtmlUrl(links: unknown): string | undefined {
    if (!links || typeof links !== "object") return undefined;

    const html = (links as { html?: unknown }).html;
    if (!html || typeof html !== "object") return undefined;

    const href = (html as { href?: unknown }).href;
    return typeof href === "string" ? href : undefined;
}

export const createBitbucketPullRequestInlineCommentTool = defineTool<
    typeof createBitbucketPullRequestInlineCommentParams,
    CreateBitbucketPullRequestInlineCommentToolDetails
>({
    name: "bitbucket_create_pull_request_inline_comment",
    label: "create Bitbucket pull request inline comment",
    description:
        "Post an inline review comment on a changed file line in a Bitbucket pull request after validating that the file is modified in the PR.",
    parameters: createBitbucketPullRequestInlineCommentParams,

    async execute(
        toolCallId,
        parameters,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<CreateBitbucketPullRequestInlineCommentToolDetails>> {
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

        const commentOptions: CreateBitbucketPullRequestInlineCommentOptions = {
            path: parameters.path,
            line: parameters.line,
            body: parameters.body,
            ...(parameters.side === undefined ? {} : { side: parameters.side }),
            ...(parameters.fetch === undefined ? {} : { fetch: parameters.fetch }),
        };

        const result = await createBitbucketPullRequestInlineComment(
            context.authConfig,
            context.repoInfo,
            parameters.pullRequestId,
            commentOptions,
        );

        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `${result.message}.`,
                    },
                ],
                details: {},
            };
        }

        const commentId = typeof result.data.id === "number" ? result.data.id : undefined;
        const commentUrl = getCommentHtmlUrl(result.data.links);
        const details: CreateBitbucketPullRequestInlineCommentToolDetails = {
            repo: `${context.repoInfo.workspace}/${context.repoInfo.repoSlug}`,
            pullRequestId: parameters.pullRequestId,
            path: parameters.path,
            line: parameters.line,
            side: parameters.side ?? "new",
            ...(commentId === undefined ? {} : { commentId }),
            ...(commentUrl === undefined ? {} : { url: commentUrl }),
        };

        return {
            content: [
                {
                    type: "text",
                    text: `inline comment ${commentId ?? "?"} created on pull request ${parameters.pullRequestId}: ${commentUrl ?? "no url"}`,
                },
            ],
            details,
        };
    },

    renderCall(args, theme, context) {
        return new Text(
            `${STATUS_ICON.ok} creating inline comment on Bitbucket pull request #${args.pullRequestId} (${args.path}:${args.line})`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        const firstText = result.content.find((item) => item.type === "text")?.text;
        const hasDetails =
            result.details && Object.keys(result.details).length > 0;

        if (!hasDetails) {
            return new Text(
                firstText ?? "Bitbucket PR inline comment result",
                0,
                0,
            );
        }

        const args = context.args as InlineCommentRenderArgs;
        const pullRequestId = result.details.pullRequestId ?? args.pullRequestId ?? "?";
        const path = result.details.path ?? args.path ?? "?";
        const line = result.details.line ?? args.line ?? "?";
        const location = `${path}:${line}`;

        return new Text(
            `${STATUS_ICON.ok} inline comment ${result.details.commentId ?? "?"} created on pull request ${pullRequestId} at ${location}`,
            0,
            0,
        );
    },
});

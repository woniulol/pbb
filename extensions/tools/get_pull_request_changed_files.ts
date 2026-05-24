import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import { getBitbucketPullRequestChangedFiles } from "../services/get_pull_request_changed_files.js";
import { STATUS_ICON } from "../ui.js";

export const getBitbucketPullRequestChangedFilesParams = Type.Object({
    pullRequestId: Type.Number({ minimum: 1 }),
    fetch: Type.Optional(Type.Boolean()),
});

interface GetBitbucketPullRequestChangedFilesToolDetails {
    repo?: string;
    pullRequestId?: number;
    sourceBranch?: string;
    destinationBranch?: string;
    count?: number;
}

export const getBitbucketPullRequestChangedFilesTool = defineTool<
    typeof getBitbucketPullRequestChangedFilesParams,
    GetBitbucketPullRequestChangedFilesToolDetails
>({
    name: "bitbucket_get_pull_request_changed_files",
    label: "get Bitbucket pull request changed files",
    description:
        "Use when you need the local changed-file list for a Bitbucket pull request in the current repository.",
    parameters: getBitbucketPullRequestChangedFilesParams,

    async execute(
        toolCallId,
        parameters,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<GetBitbucketPullRequestChangedFilesToolDetails>> {
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

        const result = await getBitbucketPullRequestChangedFiles(
            context.authConfig,
            context.repoInfo,
            parameters.pullRequestId,
            parameters.fetch === undefined ? {} : { fetch: parameters.fetch },
        );

        if (!result.ok) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Failed to get changed files for pull request ${parameters.pullRequestId}: ${result.message}.`,
                    },
                ],
                details: {},
            };
        }

        return {
            content: [
                {
                    type: "text",
                    text: `pull request ${parameters.pullRequestId} changed files found. ${JSON.stringify(result.data)}`,
                },
            ],
            details: {
                repo: `${context.repoInfo.workspace}/${context.repoInfo.repoSlug}`,
                pullRequestId: parameters.pullRequestId,
                sourceBranch: result.data.sourceBranch,
                destinationBranch: result.data.destinationBranch,
                count: result.data.files.length,
            },
        };
    },

    renderCall(args, theme, context) {
        return new Text(
            `${STATUS_ICON.ok} getting local changed files for Bitbucket pull request #${args.pullRequestId}`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        if (!result.details) {
            return new Text("Bitbucket PR changed files result", 0, 0);
        }

        return new Text(
            `${STATUS_ICON.ok} pull request ${result.details.pullRequestId ?? "?"} changed files found: ${result.details.count ?? 0} file(s) changed in ${result.details.repo ?? "current repo"}`,
            0,
            0,
        );
    },
});

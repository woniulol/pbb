import createBitbucketClient from "../client.js";
import type { PbbResult } from "../client.js";
import type { BitbucketAuthConfig } from "../auth.js";
import type { components } from "../generated/bitbucket-types.js";
import type { BitbucketRepoInfo } from "../repository.js";
import {
    getBitbucketPullRequestChangedFiles,
    type BitbucketPullRequestChangedFile,
} from "./get_pull_request_changed_files.js";
import { runBitbucketRequest } from "./request.js";

export type BitbucketPullRequestInlineComment =
    components["schemas"]["pullrequest_comment"];

export type BitbucketInlineCommentSide = "new" | "old";

type InlineCommentAnchor =
    | { path: string; to: number }
    | { path: string; from: number };

type CreateBitbucketPullRequestInlineCommentBody = {
    content: {
        raw: string;
    };
    inline: InlineCommentAnchor;
};

type ValidatedInlineCommentInput = {
    path: string;
    line: number;
    body: string;
    side: BitbucketInlineCommentSide;
};

export interface CreateBitbucketPullRequestInlineCommentOptions {
    path: string;
    line: number;
    body: string;
    side?: BitbucketInlineCommentSide;
    fetch?: boolean;
}

const PULL_REQUEST_COMMENTS_PATH =
    "/repositories/{workspace}/{repo_slug}/pullrequests/{pull_request_id}/comments";

function normalizeCommentPath(path: string): string {
    return path.trim().replace(/^\.\//, "");
}

function isUnsafeRepositoryPath(path: string): boolean {
    return path.startsWith("/") || path.split("/").includes("..");
}

function validateInlineCommentInput(
    options: CreateBitbucketPullRequestInlineCommentOptions,
): PbbResult<ValidatedInlineCommentInput> {
    const path = normalizeCommentPath(options.path);

    if (!path) {
        return {
            ok: false,
            message: "Failed to create inline comment: path is required",
        };
    }

    if (isUnsafeRepositoryPath(path)) {
        return {
            ok: false,
            message: `Failed to create inline comment: path must be repository-relative (${options.path})`,
        };
    }

    if (!Number.isInteger(options.line) || options.line < 1) {
        return {
            ok: false,
            message: "Failed to create inline comment: line must be a positive integer",
        };
    }

    const body = options.body.trim();
    if (!body) {
        return {
            ok: false,
            message: "Failed to create inline comment: body is required",
        };
    }

    return {
        ok: true,
        data: {
            path,
            line: options.line,
            body,
            side: options.side ?? "new",
        },
    };
}

function changedFileMatchesPath(
    changedFile: BitbucketPullRequestChangedFile,
    path: string,
    side: BitbucketInlineCommentSide,
): boolean {
    if (side === "old") {
        return changedFile.oldPath === path || changedFile.path === path;
    }

    return changedFile.path === path;
}

function formatChangedPaths(files: BitbucketPullRequestChangedFile[]): string {
    const changedPaths = files.flatMap((file) =>
        file.oldPath ? [file.oldPath, file.path] : [file.path],
    );
    return [...new Set(changedPaths)].join(", ") || "none";
}

function createInlineCommentAnchor(
    path: string,
    line: number,
    side: BitbucketInlineCommentSide,
): InlineCommentAnchor {
    return side === "old" ? { path, from: line } : { path, to: line };
}

export async function createBitbucketPullRequestInlineComment(
    authConfig: BitbucketAuthConfig,
    repoInfo: BitbucketRepoInfo,
    pullRequestId: number,
    options: CreateBitbucketPullRequestInlineCommentOptions,
): Promise<PbbResult<BitbucketPullRequestInlineComment>> {
    const validationResult = validateInlineCommentInput(options);
    if (!validationResult.ok) {
        return validationResult;
    }

    const { path, line, body, side } = validationResult.data;

    const changedFilesResult = await getBitbucketPullRequestChangedFiles(
        authConfig,
        repoInfo,
        pullRequestId,
        options.fetch === undefined ? {} : { fetch: options.fetch },
    );

    if (!changedFilesResult.ok) {
        return changedFilesResult;
    }

    const isChangedFile = changedFilesResult.data.files.some((changedFile) =>
        changedFileMatchesPath(changedFile, path, side),
    );

    if (!isChangedFile) {
        return {
            ok: false,
            message: `Failed to create inline comment: ${path} is not modified in pull request ${pullRequestId}. Changed files: ${formatChangedPaths(changedFilesResult.data.files)}`,
        };
    }

    const client = createBitbucketClient(authConfig);
    const requestBody = {
        content: { raw: body },
        inline: createInlineCommentAnchor(path, line, side),
    } satisfies CreateBitbucketPullRequestInlineCommentBody;

    return runBitbucketRequest(
        () =>
            client.POST(PULL_REQUEST_COMMENTS_PATH, {
                params: {
                    path: {
                        workspace: repoInfo.workspace,
                        repo_slug: repoInfo.repoSlug,
                        pull_request_id: pullRequestId,
                    },
                },
                body: requestBody as unknown as BitbucketPullRequestInlineComment,
            }),
        `Failed to create inline comment on Bitbucket pull request ${pullRequestId}`,
    );
}

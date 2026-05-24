import { afterEach, describe, expect, test, vi } from "vitest";
import type { BitbucketAuthConfig } from "../extensions/auth.js";
import type { BitbucketRepoInfo } from "../extensions/repository.js";

const execFileMock = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", () => ({
    execFile: execFileMock,
}));

import { createBitbucketPullRequestInlineComment } from "../extensions/services/create_pull_request_inline_comment.js";

const authConfig: BitbucketAuthConfig = {
    accessToken: "test-token",
    apiBaseUrl: "https://api.bitbucket.org/2.0",
};

const repoInfo: BitbucketRepoInfo = {
    workspace: "team",
    repoSlug: "repo",
    remoteUrl: "git@bitbucket.org:team/repo.git",
};

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
        },
    });
}

function mockChangedFilesOutput(output: string): void {
    execFileMock.mockImplementation((
        command: string,
        args: string[],
        callback: (error: Error | null, result: { stdout: string; stderr: string }) => void,
    ) => {
        callback(null, { stdout: output, stderr: "" });
    });
}

afterEach(() => {
    vi.unstubAllGlobals();
    execFileMock.mockReset();
});

describe("createBitbucketPullRequestInlineComment", () => {
    test("validates changed file and posts inline comment", async () => {
        mockChangedFilesOutput("M\tsrc/example.ts\n");
        const pullRequestResponse = {
            type: "pullrequest",
            id: 20,
            source: { branch: { name: "feature" } },
            destination: { branch: { name: "main" } },
        };
        const commentResponse = {
            type: "pullrequest_comment",
            id: 123,
            content: { raw: "Consider extracting this." },
            inline: { path: "src/example.ts", to: 7 },
            links: { html: { href: "https://bitbucket.org/team/repo/pull-requests/20/_/diff#comment-123" } },
        };
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(pullRequestResponse))
            .mockResolvedValueOnce(jsonResponse(commentResponse, 201));
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            createBitbucketPullRequestInlineComment(authConfig, repoInfo, 20, {
                path: "./src/example.ts",
                line: 7,
                body: "Consider extracting this.",
                fetch: false,
            }),
        ).resolves.toEqual({
            ok: true,
            status: 201,
            data: commentResponse,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(execFileMock).toHaveBeenCalledWith(
            "git",
            ["diff", "--name-status", "origin/main...origin/feature"],
            expect.any(Function),
        );

        const postRequest = fetchMock.mock.calls[1]?.[0];
        const postUrl =
            postRequest instanceof Request ? postRequest.url : String(postRequest);
        expect(postUrl).toBe(
            "https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests/20/comments",
        );
        expect(postRequest).toBeInstanceOf(Request);
        const postBody = await (postRequest as Request).json();
        expect(postBody).toEqual({
            content: {
                raw: "Consider extracting this.",
            },
            inline: {
                path: "src/example.ts",
                to: 7,
            },
        });
    });

    test("rejects a file that is not modified in the pull request", async () => {
        mockChangedFilesOutput("M\tsrc/example.ts\n");
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse({
                    type: "pullrequest",
                    id: 20,
                    source: { branch: { name: "feature" } },
                    destination: { branch: { name: "main" } },
                }),
            ),
        );

        await expect(
            createBitbucketPullRequestInlineComment(authConfig, repoInfo, 20, {
                path: "src/other.ts",
                line: 7,
                body: "Consider extracting this.",
                fetch: false,
            }),
        ).resolves.toEqual({
            ok: false,
            message:
                "Failed to create inline comment: src/other.ts is not modified in pull request 20. Changed files: src/example.ts",
        });
    });

    test("returns failure when Bitbucket rejects the created comment", async () => {
        mockChangedFilesOutput("M\tsrc/example.ts\n");
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    type: "pullrequest",
                    id: 20,
                    source: { branch: { name: "feature" } },
                    destination: { branch: { name: "main" } },
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse({ type: "error", error: { message: "bad line" } }, 400),
            );
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            createBitbucketPullRequestInlineComment(authConfig, repoInfo, 20, {
                path: "src/example.ts",
                line: 700,
                body: "Consider extracting this.",
                fetch: false,
            }),
        ).resolves.toEqual({
            ok: false,
            status: 400,
            message: "Failed to create inline comment on Bitbucket pull request 20: HTTP 400 - bad line",
        });
    });
});

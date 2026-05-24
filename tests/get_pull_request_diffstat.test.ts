import { afterEach, describe, expect, test, vi } from "vitest";
import type { BitbucketAuthConfig } from "../extensions/auth.js";
import type { BitbucketRepoInfo } from "../extensions/repository.js";
import { getBitbucketPullRequestDiffstat } from "../extensions/services/get_pull_request_diffstat.js";

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

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("getBitbucketPullRequestDiffstat", () => {
    test("gets pull request first, then returns diffstat page", async () => {
        const pullRequestResponse = {
            type: "pullrequest",
            id: 20,
            title: "Test pull request",
            source: {
                commit: {
                    hash: "source123",
                },
            },
            destination: {
                commit: {
                    hash: "dest456",
                },
            },
        };
        const diffstatResponse = {
            page: 1,
            pagelen: 500,
            size: 1,
            values: [
                {
                    type: "diffstat",
                    status: "modified",
                    lines_added: 10,
                    lines_removed: 2,
                    new: {
                        path: "src/example.ts",
                    },
                },
            ],
        };
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(jsonResponse(pullRequestResponse))
            .mockResolvedValueOnce(jsonResponse(diffstatResponse));
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            getBitbucketPullRequestDiffstat(authConfig, repoInfo, 20),
        ).resolves.toEqual({
            ok: true,
            status: 200,
            data: diffstatResponse,
        });

        expect(fetchMock).toHaveBeenCalledTimes(2);

        const firstRequest = fetchMock.mock.calls[0]?.[0];
        const firstUrl =
            firstRequest instanceof Request ? firstRequest.url : String(firstRequest);
        expect(firstUrl).toBe(
            "https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests/20",
        );

        const secondRequest = fetchMock.mock.calls[1]?.[0];
        const secondUrl =
            secondRequest instanceof Request ? secondRequest.url : String(secondRequest);
        expect(secondUrl).toBe(
            "https://api.bitbucket.org/2.0/repositories/team/repo/diffstat/source123..dest456?topic=true",
        );
    });

    test("returns failure when pull request lookup fails", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse(
                    {
                        type: "error",
                        error: { message: "not found" },
                    },
                    404,
                ),
            ),
        );

        await expect(
            getBitbucketPullRequestDiffstat(authConfig, repoInfo, 20),
        ).resolves.toEqual({
            ok: false,
            status: 404,
            message: "Failed to get Bitbucket pull request 20: HTTP 404 - not found",
        });
    });

    test("returns failure when pull request is missing commit hashes", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(
                jsonResponse({
                    type: "pullrequest",
                    id: 20,
                    title: "Test pull request",
                }),
            ),
        );

        await expect(
            getBitbucketPullRequestDiffstat(authConfig, repoInfo, 20),
        ).resolves.toEqual({
            ok: false,
            message:
                "Failed to get Bitbucket pull request 20 diffstat: missing source or destination commit hash",
        });
    });

    test("returns failure when diffstat request returns non-ok HTTP response", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    type: "pullrequest",
                    id: 20,
                    source: { commit: { hash: "source123" } },
                    destination: { commit: { hash: "dest456" } },
                }),
            )
            .mockResolvedValueOnce(
                jsonResponse(
                    {
                        type: "error",
                        error: { message: "timeout" },
                    },
                    555,
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            getBitbucketPullRequestDiffstat(authConfig, repoInfo, 20),
        ).resolves.toEqual({
            ok: false,
            status: 555,
            message: "Failed to get Bitbucket pull request 20 diffstat: HTTP 555 - timeout",
        });
    });

    test("returns network error message when diffstat fetch throws", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                jsonResponse({
                    type: "pullrequest",
                    id: 20,
                    source: { commit: { hash: "source123" } },
                    destination: { commit: { hash: "dest456" } },
                }),
            )
            .mockRejectedValueOnce(new Error("connection failed"));
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            getBitbucketPullRequestDiffstat(authConfig, repoInfo, 20),
        ).resolves.toEqual({
            ok: false,
            message: "Network error: connection failed",
        });
    });
});

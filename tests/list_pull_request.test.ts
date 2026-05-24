import { afterEach, describe, expect, test, vi } from "vitest";
import type { BitbucketAuthConfig } from "../extensions/auth.js";
import type { BitbucketRepoInfo } from "../extensions/repository.js";
import { listBitbucketPullRequests } from "../extensions/services/list_pull_request.js";

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

describe("listBitbucketPullRequests", () => {
    test("returns pull request page when Bitbucket responds with 200", async () => {
        const responseBody = {
            page: 1,
            pagelen: 10,
            size: 1,
            values: [
                {
                    type: "pullrequest",
                    id: 123,
                    title: "Test pull request",
                },
            ],
        };
        const fetchMock = vi.fn().mockResolvedValue(jsonResponse(responseBody));
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            listBitbucketPullRequests(authConfig, repoInfo, "OPEN"),
        ).resolves.toEqual({
            ok: true,
            status: 200,
            data: responseBody,
        });
    });

    test("passes selected state as a query parameter", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse({
                values: [],
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        await listBitbucketPullRequests(authConfig, repoInfo, "MERGED");

        const request = fetchMock.mock.calls[0]?.[0];
        const url = request instanceof Request ? request.url : String(request);

        expect(url).toBe(
            "https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests?state=MERGED",
        );
    });

    test("omits state query parameter when state is not provided", async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            jsonResponse({
                values: [],
            }),
        );
        vi.stubGlobal("fetch", fetchMock);

        await listBitbucketPullRequests(authConfig, repoInfo);

        const request = fetchMock.mock.calls[0]?.[0];
        const url = request instanceof Request ? request.url : String(request);

        expect(url).toBe(
            "https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests",
        );
    });

    test("returns failure result for non-ok HTTP response", async () => {
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
            listBitbucketPullRequests(authConfig, repoInfo, "OPEN"),
        ).resolves.toEqual({
            ok: false,
            status: 404,
            message: "Failed to list Bitbucket pull requests: HTTP 404 - not found",
        });
    });

    test("returns network error message when fetch throws", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new Error("connection failed")),
        );

        await expect(
            listBitbucketPullRequests(authConfig, repoInfo, "OPEN"),
        ).resolves.toEqual({
            ok: false,
            message: "Network error: connection failed",
        });
    });
});

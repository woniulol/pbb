import { afterEach, describe, expect, test, vi } from "vitest";
import { checkBitbucketRepositoryAccess } from "../extensions/bitbucket.js";
import type { BitbucketAuthConfig } from "../extensions/auth.js";
import type { BitbucketRepoInfo } from "../extensions/repository.js";

const authConfig: BitbucketAuthConfig = {
    accessToken: "test-token",
    workspace: "team",
    apiBaseUrl: "https://api.bitbucket.org/2.0",
};

const repoInfo: BitbucketRepoInfo = {
    workspace: "team",
    repoSlug: "repo",
    remoteUrl: "git@bitbucket.org:team/repo.git",
};

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("checkBitbucketRepositoryAccess", () => {
    test("returns ok when Bitbucket responds with 200", async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
        });
        vi.stubGlobal("fetch", fetchMock);

        await expect(
            checkBitbucketRepositoryAccess(authConfig, repoInfo),
        ).resolves.toEqual({
            ok: true,
            status: 200,
            message: "team/repo access confirmed",
        });

        expect(fetchMock).toHaveBeenCalledWith(
            "https://api.bitbucket.org/2.0/repositories/team/repo",
            {
                method: "GET",
                headers: {
                    Authorization: "Bearer test-token",
                    Accept: "application/json",
                },
            },
        );
    });

    test("returns unauthorized message for 401", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 401,
            }),
        );

        await expect(
            checkBitbucketRepositoryAccess(authConfig, repoInfo),
        ).resolves.toEqual({
            ok: false,
            status: 401,
            message: "unauthorized: token is invalid or expired",
        });
    });

    test("returns forbidden message for 403", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 403,
            }),
        );

        await expect(
            checkBitbucketRepositoryAccess(authConfig, repoInfo),
        ).resolves.toEqual({
            ok: false,
            status: 403,
            message: "forbidden: token does not have access to this repository",
        });
    });

    test("returns not found message for 404", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 404,
            }),
        );

        await expect(
            checkBitbucketRepositoryAccess(authConfig, repoInfo),
        ).resolves.toEqual({
            ok: false,
            status: 404,
            message: "repo not found or token cannot access it",
        });
    });

    test("returns fallback message for unknown HTTP status", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue({
                ok: false,
                status: 500,
            }),
        );

        await expect(
            checkBitbucketRepositoryAccess(authConfig, repoInfo),
        ).resolves.toEqual({
            ok: false,
            status: 500,
            message: "Unknown failure",
        });
    });

    test("returns network error message when fetch throws", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockRejectedValue(new Error("connection failed")),
        );

        await expect(
            checkBitbucketRepositoryAccess(authConfig, repoInfo),
        ).resolves.toEqual({
            ok: false,
            message: "Network error: connection failed",
        });
    });
});

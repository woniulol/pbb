import { expect, test, describe, vi } from "vitest";
import {
    parseBitbucketRemoteUrl,
    getBitbucketRepoInfoFromGit,
} from "../extensions/repository.js";

describe("parseBitbucketRemote", () => {
    test("parse SSH Bitbucket remotes", () => {
        expect(parseBitbucketRemoteUrl("git@bitbucket.org:team/repo.git")).toEqual({
            workspace: "team",
            repoSlug: "repo",
        });
    });

    test("parses HTTPS Bitbucket remotes without dot git", () => {
        expect(parseBitbucketRemoteUrl("https://bitbucket.org/team/repo")).toEqual({
            workspace: "team",
            repoSlug: "repo",
        });
    });

    test("parses HTTPS Bitbucket remotes with dot git", () => {
        expect(parseBitbucketRemoteUrl("https://bitbucket.org/team/repo.git")).toEqual({
            workspace: "team",
            repoSlug: "repo",
        });
    });

    test("rejects non-Bitbucket remotes", () => {
        expect(
            parseBitbucketRemoteUrl("https://github.com/team/repo.git"),
        ).toBeUndefined();
    });
});

// describe("getGitOriginUrl", () => {
//
//     test("get git origin url", async () => {
//         expect(await getGitOriginUrl()).toEqual("git@github.com:woniulol/pbb.git")
//     })
//
// });

describe("getBitbucketRepoInfoFromGit", () => {
    test("get Bitbucket repo info from git", async () => {
        const getOriginUrl = vi
            .fn()
            .mockResolvedValue("git@bitbucket.org:team/repo.git");
        expect(await getBitbucketRepoInfoFromGit(getOriginUrl)).toEqual({
            remoteUrl: "git@bitbucket.org:team/repo.git",
            repoSlug: "repo",
            workspace: "team",
        });
    });

    test("returns undefined when origin is missing", async () => {
        const getOriginUrl = vi.fn().mockResolvedValue(undefined);
        expect(await getBitbucketRepoInfoFromGit(getOriginUrl)).toBeUndefined();
    });

    test("returns undefined for non-Bitbucket origin", async () => {
        const getOriginUrl = vi.fn().mockResolvedValue("git@github.com:team/repo.git");
        expect(await getBitbucketRepoInfoFromGit(getOriginUrl)).toBeUndefined();
    });
});

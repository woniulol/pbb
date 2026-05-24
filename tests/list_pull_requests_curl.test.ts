import { describe, expect, test } from "vitest";
import {
    buildPullRequestsUrl,
    formatPullRequestSummary,
} from "../extensions/tools/list_pull_requests_curl.js";
import type { components } from "../extensions/generated/bitbucket-types.js";

type PullRequest = components["schemas"]["pullrequest"];

describe("buildPullRequestsUrl", () => {
    test("builds a paginated Bitbucket pull request URL", () => {
        expect(
            buildPullRequestsUrl({
                apiBaseUrl: "https://api.bitbucket.org/2.0/",
                workspace: "team",
                repoSlug: "repo",
                state: "OPEN",
                page: 251,
                pagelen: 10,
            }),
        ).toBe(
            "https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests?state=OPEN&page=251&pagelen=10",
        );
    });

    test("includes query and sort when provided", () => {
        expect(
            buildPullRequestsUrl({
                apiBaseUrl: "https://api.bitbucket.org/2.0",
                workspace: "team",
                repoSlug: "repo",
                state: "MERGED",
                page: 2,
                pagelen: 20,
                query: 'title~"SKU"',
                sort: "-updated_on",
            }),
        ).toBe(
            "https://api.bitbucket.org/2.0/repositories/team/repo/pullrequests?state=MERGED&page=2&pagelen=20&q=title%7E%22SKU%22&sort=-updated_on",
        );
    });
});

describe("formatPullRequestSummary", () => {
    test("formats a lean pull request summary", () => {
        const pullRequest = {
            id: 21,
            title: "Fix SKU validation",
            state: "OPEN",
            source: { branch: { name: "feature/sku" } },
            destination: { branch: { name: "main" } },
            author: { display_name: "Jane Developer" },
            updated_on: "2026-05-24T12:00:00Z",
            links: {
                html: {
                    href: "https://bitbucket.org/team/repo/pull-requests/21",
                },
            },
        } as PullRequest;

        expect(formatPullRequestSummary(pullRequest)).toBe(
            "#21 Fix SKU validation [OPEN] feature/sku -> main; author=Jane Developer; updated=2026-05-24T12:00:00Z; url=https://bitbucket.org/team/repo/pull-requests/21",
        );
    });

    test("falls back when optional fields are missing", () => {
        expect(formatPullRequestSummary({} as PullRequest)).toBe(
            "#? untitled [unknown] unknown -> unknown; author=unknown; updated=unknown; url=unknown",
        );
    });
});

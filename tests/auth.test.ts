import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { getBitbucketAuthConfig } from "../extensions/auth.js";

const ENV_KEYS = [
    "PBB_BITBUCKET_USER",
    "PBB_BITBUCKET_ACCESS_TOKEN",
    "PBB_BITBUCKET_API_BASE_URL",
] as const;

const originalEnv = { ...process.env };

beforeEach(() => {
    for (const key of ENV_KEYS) {
        delete process.env[key];
    }
});

afterEach(() => {
    process.env = { ...originalEnv };
});

describe("getBitbucketAuthConfig", () => {
    test("returns config when required environment variables are set", () => {
        process.env.PBB_BITBUCKET_USER = "test-user";
        process.env.PBB_BITBUCKET_ACCESS_TOKEN = "test-token";

        expect(getBitbucketAuthConfig()).toEqual({
            user: "test-user",
            accessToken: "test-token",
            apiBaseUrl: "https://api.bitbucket.org/2.0",
        });
    });

    test("uses custom API base URL when configured", () => {
        process.env.PBB_BITBUCKET_USER = "test-user";
        process.env.PBB_BITBUCKET_ACCESS_TOKEN = "test-token";
        process.env.PBB_BITBUCKET_API_BASE_URL = "https://example.com/api";

        expect(getBitbucketAuthConfig()).toEqual({
            user: "test-user",
            accessToken: "test-token",
            apiBaseUrl: "https://example.com/api",
        });
    });

    test("returns undefined when user is missing", () => {
        process.env.PBB_BITBUCKET_ACCESS_TOKEN = "test-token";

        expect(getBitbucketAuthConfig()).toBeUndefined();
    });

    test("returns undefined when access token is missing", () => {
        process.env.PBB_BITBUCKET_USER = "test-user";

        expect(getBitbucketAuthConfig()).toBeUndefined();
    });
});

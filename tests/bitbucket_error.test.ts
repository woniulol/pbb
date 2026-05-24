import { describe, expect, test } from "vitest";
import {
    formatBitbucketCurlError,
    getBitbucketErrorMessage,
} from "../extensions/bitbucket_error.js";
import type { CurlJsonError } from "../extensions/curl/json.js";

describe("getBitbucketErrorMessage", () => {
    test("extracts error.message", () => {
        expect(
            getBitbucketErrorMessage({ error: { message: "line is invalid" } }),
        ).toBe("line is invalid");
    });

    test("extracts error.detail when message is missing", () => {
        expect(getBitbucketErrorMessage({ error: { detail: "bad request" } })).toBe(
            "bad request",
        );
    });

    test("extracts top-level message", () => {
        expect(getBitbucketErrorMessage({ message: "unauthorized" })).toBe(
            "unauthorized",
        );
    });

    test("returns undefined for unknown shapes", () => {
        expect(getBitbucketErrorMessage({ error: { code: 400 } })).toBeUndefined();
        expect(getBitbucketErrorMessage(undefined)).toBeUndefined();
        expect(getBitbucketErrorMessage("plain text")).toBeUndefined();
    });
});

describe("formatBitbucketCurlError", () => {
    test("enriches http_error with Bitbucket message", () => {
        const error: CurlJsonError = {
            kind: "http_error",
            message: "HTTP 400",
            status: 400,
            data: { error: { message: "line is invalid" } },
        };

        expect(formatBitbucketCurlError(error)).toBe("HTTP 400 - line is invalid");
    });

    test("keeps generic message when http_error has no Bitbucket message", () => {
        const error: CurlJsonError = {
            kind: "http_error",
            message: "HTTP 500",
            status: 500,
            rawBody: "<html>server error</html>",
        };

        expect(formatBitbucketCurlError(error)).toBe("HTTP 500");
    });

    test("does not enrich non-http errors", () => {
        const error: CurlJsonError = {
            kind: "curl_error",
            message: "curl failed",
        };

        expect(formatBitbucketCurlError(error)).toBe("curl failed");
    });
});

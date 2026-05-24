import { afterEach, describe, expect, test, vi } from "vitest";
import { curlJson } from "../extensions/curl/json.js";

const { execFileMock, execFileAsyncMock } = vi.hoisted(() => {
    const asyncMock = vi.fn();
    const mock = vi.fn();
    Object.assign(mock, {
        [Symbol.for("nodejs.util.promisify.custom")]: asyncMock,
    });
    return { execFileMock: mock, execFileAsyncMock: asyncMock };
});

vi.mock("node:child_process", () => ({
    execFile: execFileMock,
}));

function mockCurlStdout(stdout: string, stderr = ""): void {
    execFileAsyncMock.mockResolvedValue({ stdout, stderr });
}

afterEach(() => {
    execFileMock.mockReset();
    execFileAsyncMock.mockReset();
});

describe("curlJson", () => {
    test("returns parsed JSON for a successful response", async () => {
        mockCurlStdout('{"id":123}\n__PI_CURL_HTTP_STATUS__:200');

        await expect(
            curlJson<{ id: number }>({
                method: "GET",
                url: "https://example.com/items/123",
            }),
        ).resolves.toEqual({
            ok: true,
            value: {
                status: 200,
                data: { id: 123 },
                rawBody: '{"id":123}',
            },
        });
    });

    test("passes JSON headers and stringifies request body", async () => {
        mockCurlStdout('{"ok":true}\n__PI_CURL_HTTP_STATUS__:201');

        await curlJson<{ ok: boolean }>({
            method: "POST",
            url: "https://example.com/items",
            headers: {
                Authorization: "Bearer token",
            },
            body: {
                title: "hello",
            },
        });

        expect(execFileAsyncMock).toHaveBeenCalledTimes(1);
        const [command, args] = execFileAsyncMock.mock.calls[0] ?? [];
        expect(command).toBe("curl");
        expect(args).toEqual(
            expect.arrayContaining([
                "--request",
                "POST",
                "--header",
                "Accept: application/json",
                "--header",
                "Authorization: Bearer token",
                "--header",
                "Content-Type: application/json",
                "--data",
                JSON.stringify({ title: "hello" }),
                "--write-out",
                "\n__PI_CURL_HTTP_STATUS__:%{http_code}",
                "https://example.com/items",
            ]),
        );
    });

    test("returns parse_error for successful response with invalid JSON", async () => {
        mockCurlStdout("not json\n__PI_CURL_HTTP_STATUS__:200");

        const result = await curlJson<{ id: number }>({
            method: "GET",
            url: "https://example.com/items/123",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe("parse_error");
            expect(result.error.status).toBe(200);
            expect(result.error.rawBody).toBe("not json");
            expect(result.error.message).toContain("Failed to parse curl JSON response");
        }
    });

    test("returns http_error and parsed data for non-2xx JSON response", async () => {
        mockCurlStdout(
            '{"error":{"message":"line is invalid"}}\n__PI_CURL_HTTP_STATUS__:400',
        );

        await expect(
            curlJson<{ id: number }>({
                method: "GET",
                url: "https://example.com/items/123",
            }),
        ).resolves.toEqual({
            ok: false,
            error: {
                kind: "http_error",
                message: "HTTP 400",
                status: 400,
                data: { error: { message: "line is invalid" } },
                rawBody: '{"error":{"message":"line is invalid"}}',
                stderr: "",
            },
        });
    });

    test("returns http_error without data for non-2xx non-JSON response", async () => {
        mockCurlStdout("<html>server error</html>\n__PI_CURL_HTTP_STATUS__:500");

        await expect(
            curlJson<{ id: number }>({
                method: "GET",
                url: "https://example.com/items/123",
            }),
        ).resolves.toEqual({
            ok: false,
            error: {
                kind: "http_error",
                message: "HTTP 500",
                status: 500,
                data: undefined,
                rawBody: "<html>server error</html>",
                stderr: "",
            },
        });
    });

    test("returns parse_error when the HTTP status marker is missing", async () => {
        mockCurlStdout('{"id":123}');

        await expect(
            curlJson<{ id: number }>({
                method: "GET",
                url: "https://example.com/items/123",
            }),
        ).resolves.toEqual({
            ok: false,
            error: {
                kind: "parse_error",
                message: "Failed to parse curl response: missing HTTP status marker",
                rawBody: '{"id":123}',
                stderr: "",
            },
        });
    });

    test("returns parse_error when the HTTP status marker is invalid", async () => {
        mockCurlStdout('{"id":123}\n__PI_CURL_HTTP_STATUS__:oops');

        await expect(
            curlJson<{ id: number }>({
                method: "GET",
                url: "https://example.com/items/123",
            }),
        ).resolves.toEqual({
            ok: false,
            error: {
                kind: "parse_error",
                message: "Failed to parse curl response: invalid HTTP status oops",
                rawBody: '{"id":123}',
                stderr: "",
            },
        });
    });

    test("returns curl_error when curl execution fails", async () => {
        execFileAsyncMock.mockRejectedValue(new Error("curl: could not resolve host"));

        const result = await curlJson<{ id: number }>({
            method: "GET",
            url: "https://example.invalid/items/123",
        });

        expect(result.ok).toBe(false);
        if (!result.ok) {
            expect(result.error.kind).toBe("curl_error");
            expect(result.error.message).toBe("curl failed: curl: could not resolve host");
        }
    });
});

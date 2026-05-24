import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { err, ok, type Result } from "../result.js";

const execFileAsync = promisify(execFile);
const HTTP_STATUS_MARKER = "__PI_CURL_HTTP_STATUS__:";

export type CurlJsonMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type CurlJsonOptions = {
    method: CurlJsonMethod;
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
    maxBuffer?: number;
};

export type CurlJsonResponse<T> = {
    status: number;
    data: T | undefined;
    rawBody: string;
};

export type CurlJsonErrorKind = "curl_error" | "http_error" | "parse_error";

export type CurlJsonError = {
    kind: CurlJsonErrorKind;
    message: string;
    status?: number;
    data?: unknown;
    rawBody?: string;
    stderr?: string;
};

/**
 * Parse stdout produced by curlJson.
 *
 * curlJson appends the HTTP status code with:
 *   --write-out "\n__PI_CURL_HTTP_STATUS__:%{http_code}"
 *
 * Expected stdout shape:
 *   <response body>\n__PI_CURL_HTTP_STATUS__:<http_code>
 *
 * The response body may contain newlines, so we search for the last marker
 * instead of splitting on the first or last newline.
 */
function parseCurlStdout(
    stdout: string,
): Result<{ rawBody: string; status: number }, CurlJsonError> {
    const markerIndex = stdout.lastIndexOf(HTTP_STATUS_MARKER);
    if (markerIndex < 0) {
        return err({
            kind: "parse_error",
            message: "Failed to parse curl response: missing HTTP status marker",
            rawBody: stdout,
        });
    }

    const rawBody = stdout.slice(0, markerIndex).replace(/\n$/, "");
    const statusText = stdout.slice(markerIndex + HTTP_STATUS_MARKER.length).trim();
    const status = Number(statusText);

    if (!Number.isInteger(status)) {
        return err({
            kind: "parse_error",
            message: `Failed to parse curl response: invalid HTTP status ${statusText}`,
            rawBody,
        });
    }

    return ok({ rawBody, status });
}

function parseJsonBody(
    rawBody: string,
    status: number,
): Result<unknown, CurlJsonError> {
    try {
        return ok(rawBody ? JSON.parse(rawBody) : undefined);
    } catch (error) {
        return err({
            kind: "parse_error",
            message:
                error instanceof Error
                    ? `Failed to parse curl JSON response: ${error.message}`
                    : "Failed to parse curl JSON response",
            status,
            rawBody,
        });
    }
}

function tryParseJsonBody(rawBody: string): unknown | undefined {
    try {
        return rawBody ? JSON.parse(rawBody) : undefined;
    } catch {
        return undefined;
    }
}

function buildCurlArgs(options: CurlJsonOptions): string[] {
    const args = [
        "--silent",
        "--show-error",
        "--request",
        options.method,
        "--header",
        "Accept: application/json",
    ];

    for (const [name, value] of Object.entries(options.headers ?? {})) {
        args.push("--header", `${name}: ${value}`);
    }

    if (options.body !== undefined) {
        args.push(
            "--header",
            "Content-Type: application/json",
            "--data",
            JSON.stringify(options.body),
        );
    }

    args.push("--write-out", `\n${HTTP_STATUS_MARKER}%{http_code}`, options.url);
    return args;
}

export async function curlJson<T>(
    options: CurlJsonOptions,
): Promise<Result<CurlJsonResponse<T>, CurlJsonError>> {
    try {
        const { stdout, stderr } = await execFileAsync("curl", buildCurlArgs(options), {
            // Default to 10 MiB. Node's execFile maxBuffer is measured in bytes.
            maxBuffer: options.maxBuffer ?? 10 * 1024 * 1024,
        });
        const parsed = parseCurlStdout(stdout);
        if (!parsed.ok) {
            return err({ ...parsed.error, stderr });
        }
        const { rawBody, status } = parsed.value;

        if (status < 200 || status >= 300) {
            /**
             * Preserve HTTP failure as the primary error. Error bodies are often
             * JSON, so we parse opportunistically for callers that want details,
             * but invalid/non-JSON error bodies should not mask the HTTP status.
             */
            return err({
                kind: "http_error",
                message: `HTTP ${status}`,
                status,
                data: tryParseJsonBody(rawBody),
                rawBody,
                stderr,
            });
        }

        const parsedJson = parseJsonBody(rawBody, status);
        if (!parsedJson.ok) {
            return err({ ...parsedJson.error, stderr });
        }

        return ok({
            status,
            data: parsedJson.value as T,
            rawBody,
        });
    } catch (error) {
        return err({
            kind: "curl_error",
            message:
                error instanceof Error
                    ? `curl failed: ${error.message}`
                    : "curl failed",
        });
    }
}

import type { CurlJsonError } from "./curl/json.js";

/**
 * Extract a human-readable message from Bitbucket's JSON error shape.
 *
 * This intentionally lives outside the generic curlJson layer. curlJson should
 * only understand curl execution, HTTP status framing, and generic JSON parsing.
 * It must not assume that every API represents errors as `error.message`,
 * `error.detail`, or `message`; those shapes are API-specific. Keeping this
 * logic here preserves the abstraction boundary while still letting Bitbucket
 * tools show nicer errors such as `HTTP 400 - line is invalid`.
 */
export function getBitbucketErrorMessage(data: unknown): string | undefined {
    if (!data || typeof data !== "object") return undefined;

    const error = (data as { error?: unknown }).error;
    if (error && typeof error === "object") {
        const message = (error as { message?: unknown; detail?: unknown }).message;
        const detail = (error as { message?: unknown; detail?: unknown }).detail;
        if (typeof message === "string" && message.trim()) return message;
        if (typeof detail === "string" && detail.trim()) return detail;
    }

    const message = (data as { message?: unknown }).message;
    return typeof message === "string" && message.trim() ? message : undefined;
}

export function formatBitbucketCurlError(error: CurlJsonError): string {
    if (error.kind !== "http_error") {
        return error.message;
    }

    const bitbucketMessage = getBitbucketErrorMessage(error.data);
    return bitbucketMessage ? `${error.message} - ${bitbucketMessage}` : error.message;
}

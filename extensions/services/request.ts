import type { PbbResult } from "../client.js";

type BitbucketRequestResult<T> = {
    data?: T;
    error?: unknown;
    response: Response;
};

function extractBitbucketErrorMessage(error: unknown): string | undefined {
    if (!error || typeof error !== "object") {
        return undefined;
    }

    const maybeError = error as {
        error?: { message?: unknown; detail?: unknown };
        message?: unknown;
        detail?: unknown;
    };

    const message =
        maybeError.error?.message ??
        maybeError.error?.detail ??
        maybeError.message ??
        maybeError.detail;

    return typeof message === "string" && message.trim() ? message : undefined;
}

export async function runBitbucketRequest<T>(
    request: () => Promise<BitbucketRequestResult<T>>,
    failureMessage?: string,
): Promise<PbbResult<T>> {
    if (!failureMessage) failureMessage = "Bitbucket request error";
    try {
        const { data, error, response } = await request();
        if (!response.ok || !data) {
            const errorMessage = extractBitbucketErrorMessage(error);
            return {
                ok: false,
                status: response.status,
                message: `${failureMessage}: HTTP ${response.status}${errorMessage ? ` - ${errorMessage}` : ""}`,
            };
        }
        return {
            ok: true,
            status: response.status,
            data,
        };
    } catch (error) {
        return {
            ok: false,
            message:
                error instanceof Error
                    ? `Network error: ${error.message}`
                    : "Network error: failed to connect to Bitbucket",
        };
    }
}

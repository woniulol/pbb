import type { BitbucketAuthConfig } from "./auth.js";
import type { BitbucketRepoInfo } from "./repository.js";

export interface BitbucketRepoAccessResult {
    ok: boolean;
    status?: number;
    message: string;
}

const BITBUCKET_ACCESS_ERROR_MESSAGES: Record<number, string> = {
    401: "unauthorized: token is invalid or expired",
    403: "forbidden: token does not have access to this repository",
    404: "repo not found or token cannot access it",
};

export async function checkBitbucketRepositoryAccess(
    authConfig: BitbucketAuthConfig,
    repoInfo: BitbucketRepoInfo,
): Promise<BitbucketRepoAccessResult> {
    const { accessToken, apiBaseUrl } = authConfig;
    const { workspace, repoSlug } = repoInfo;
    const url = `${apiBaseUrl}/repositories/${workspace}/${repoSlug}`;
    try {
        const respond = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
            },
        });

        if (respond.ok) {
            return {
                ok: true,
                status: respond.status,
                message: `${workspace}/${repoSlug} access confirmed`,
            };
        }

        return {
            ok: false,
            status: respond.status,
            message:
                BITBUCKET_ACCESS_ERROR_MESSAGES[respond.status] ?? "Unknown failure",
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

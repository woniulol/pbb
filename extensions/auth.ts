import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import process from "node:process";

const ENV_PREFIX = "PBB_BITBUCKET";

export interface BitbucketAuthConfig {
    userToken: string;
    workspace: string;
    apiBaseUrl: string;
}

type BitbucketAuthStatusFields = Record<keyof BitbucketAuthConfig, boolean>
type BitbucketAuthEnvFields = Record<keyof BitbucketAuthConfig, string>

const BITBUCKET_ENV: BitbucketAuthEnvFields = {
     userToken: `${ENV_PREFIX}_USER_TOKEN`,
     workspace: `${ENV_PREFIX}_WORKSPACE`,
     apiBaseUrl: `${ENV_PREFIX}_API_BASE_URL`,
}
const DEFAULT_BITBUCKET_API_BASE_URL = "https://api.bitbucket.org/2.0";

export type BitbucketAuthStatus = BitbucketAuthStatusFields & {
    isReady: boolean;
};

export function getBitbucketAuthStatus(): BitbucketAuthStatus {
    const status = {} as BitbucketAuthStatusFields;

    for (const key of Object.keys(BITBUCKET_ENV) as Array<keyof BitbucketAuthConfig>) {
        if (key === "apiBaseUrl") {
            status[key] = Boolean(
                process.env[BITBUCKET_ENV[key]] ?? DEFAULT_BITBUCKET_API_BASE_URL
            );
        } else {
            status[key] = Boolean(process.env[BITBUCKET_ENV[key]]);
        }
    }

    return {
        ...status,
        isReady: Object.values(status).every(Boolean),
    }

}

export async function handlePbbAuthCommand(
    ctx: ExtensionCommandContext
): Promise<void> {
    const status = getBitbucketAuthStatus();

    const lines = (
        Object.keys(BITBUCKET_ENV) as Array<keyof BitbucketAuthConfig>
    ).map((key) => {
        const envName = BITBUCKET_ENV[key];
        const state = status[key] ? "✓" : "✗";
        return `${state} ${envName}`;
    });

    const message = [
        `pbb auth: ${status.isReady ? "configured" : "incomplete config"}.\n`,
        ...lines,
    ].join("\n");

    ctx.ui.notify(message, status.isReady ? "info" : "warning");
}


import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import process from "node:process";
import { STATUS_ICON } from "./ui.js";

const ENV_PREFIX = "PBB_BITBUCKET";

export interface BitbucketAuthConfig {
    user: string;
    accessToken: string;
    apiBaseUrl: string;
}

type BitbucketAuthStatusFields = Record<keyof BitbucketAuthConfig, boolean>;
type BitbucketAuthEnvFields = Record<keyof BitbucketAuthConfig, string>;

const BITBUCKET_ENV: BitbucketAuthEnvFields = {
    user: `${ENV_PREFIX}_USER`,
    accessToken: `${ENV_PREFIX}_ACCESS_TOKEN`,
    apiBaseUrl: `${ENV_PREFIX}_API_BASE_URL`,
};
const DEFAULT_BITBUCKET_API_BASE_URL = "https://api.bitbucket.org/2.0";

export type BitbucketAuthStatus = BitbucketAuthStatusFields & {
    isReady: boolean;
};

export function getBitbucketBasicAuthHeader(authConfig: BitbucketAuthConfig): string {
    const credentials = Buffer.from(
        `${authConfig.user}:${authConfig.accessToken}`,
    ).toString("base64");
    return `Basic ${credentials}`;
}

export function getBitbucketAuthConfig(): BitbucketAuthConfig | undefined {
    const config = {} as BitbucketAuthConfig;

    for (const key of Object.keys(BITBUCKET_ENV) as Array<keyof BitbucketAuthConfig>) {
        const envName = BITBUCKET_ENV[key];
        const envValue = process.env[envName];
        if (key === "apiBaseUrl") {
            config[key] = envValue ?? DEFAULT_BITBUCKET_API_BASE_URL;
            continue;
        }
        if (!envValue) {
            return undefined;
        }
        config[key] = envValue;
    }
    return config;
}

export function getBitbucketAuthStatus(): BitbucketAuthStatus {
    const config = getBitbucketAuthConfig();
    const status = {} as BitbucketAuthStatusFields;

    for (const key of Object.keys(BITBUCKET_ENV) as Array<keyof BitbucketAuthConfig>) {
        if (config) {
            status[key] = Boolean(config[key]);
            continue;
        }

        if (key === "apiBaseUrl") {
            status[key] = Boolean(
                process.env[BITBUCKET_ENV[key]] ?? DEFAULT_BITBUCKET_API_BASE_URL,
            );
            continue;
        }

        status[key] = Boolean(process.env[BITBUCKET_ENV[key]]);
    }

    return {
        ...status,
        isReady: Boolean(config),
    };
}

export async function handlePbbAuthCommand(
    ctx: ExtensionCommandContext,
): Promise<void> {
    const status = getBitbucketAuthStatus();

    const lines = (Object.keys(BITBUCKET_ENV) as Array<keyof BitbucketAuthConfig>).map(
        (key) => {
            const envName = BITBUCKET_ENV[key];
            const state = status[key] ? STATUS_ICON.ok : STATUS_ICON.missing;
            return `${state} ${envName}`;
        },
    );

    const message = [
        `pbb auth: ${status.isReady ? "configured" : "incomplete config"}.\n`,
        ...lines,
    ].join("\n");

    ctx.ui.notify(message, status.isReady ? "info" : "warning");
}

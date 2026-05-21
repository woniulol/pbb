import { execFile } from "node:child_process";
import { promisify } from "node:util";

export interface ParsedBitbucketRemote {
    workspace: string;
    repoSlug: string;
}

export interface BitbucketRepoInfo extends ParsedBitbucketRemote {
    remoteUrl: string;
}

const execFileAsync = promisify(execFile);

/**
 * Parse remote url such as:
 *
 * - git@bitbucket.org:<workspace>/<repoSlug>.git
 * - https://bitbucket.org/<workspace>/<repoSlug>
 * - https://bitbucket.org/<workspace>/<repoSlug>.git
 *
 */
export function parseBitbucketRemoteUrl(
    remoteUrl: string,
): ParsedBitbucketRemote | undefined {
    const trimmed = remoteUrl.trim();

    const sshMatch = trimmed.match(/^git@bitbucket\.org:([^/]+)\/(.+?)(?:\.git)?$/);
    if (sshMatch && sshMatch[1] && sshMatch[2]) {
        return {
            workspace: sshMatch[1],
            repoSlug: sshMatch[2],
        };
    }

    const httpMatch = trimmed.match(
        /^https:\/\/bitbucket\.org\/([^/]+)\/(.+?)(?:\.git)?$/,
    );
    if (httpMatch && httpMatch[1] && httpMatch[2]) {
        return {
            workspace: httpMatch[1],
            repoSlug: httpMatch[2],
        };
    }

    return undefined;
}

export async function getGitOriginUrl(): Promise<string | undefined> {
    try {
        const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"]);
        const remoteUrl = stdout.trim();
        return remoteUrl || undefined;
    } catch {
        return undefined;
    }
}

export async function getBitbucketRepoInfoFromGit(
    getOriginUrl = getGitOriginUrl,
): Promise<BitbucketRepoInfo | undefined> {
    const remoteUrl = await getOriginUrl();
    if (!remoteUrl) {
        return undefined;
    }

    const parsed = parseBitbucketRemoteUrl(remoteUrl);
    if (!parsed) {
        return undefined;
    }

    return { ...parsed, remoteUrl };
}

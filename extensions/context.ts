import { BitbucketAuthConfig, getBitbucketAuthConfig } from "./auth.js";
import { BitbucketRepoInfo, getBitbucketRepoInfoFromGit } from "./repository.js";

export interface BitbucketContext {
    authConfig: BitbucketAuthConfig | undefined;
    repoInfo: BitbucketRepoInfo | undefined;
}

export interface CompleteBitbucketContext {
    authConfig: BitbucketAuthConfig;
    repoInfo: BitbucketRepoInfo;
}

export async function getBitbucketContext(): Promise<BitbucketContext> {
    const authConfig = getBitbucketAuthConfig();
    const repoInfo = await getBitbucketRepoInfoFromGit();
    return { authConfig, repoInfo };
}

export function hasCompleteBitbucketContext(
    context: BitbucketContext,
): context is CompleteBitbucketContext {
    return Boolean(context.authConfig && context.repoInfo);
}

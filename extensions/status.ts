import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getBitbucketAuthConfig } from "./auth.js";
import { getBitbucketRepoInfoFromGit } from "./repository.js";
import { checkBitbucketRepositoryAccess } from "./bitbucket.js";
import { STATUS_ICON } from "./ui.js";

export async function handlePbbStatusCommand(
    ctx: ExtensionCommandContext,
): Promise<void> {
    const authConfig = getBitbucketAuthConfig();
    const repoInfo = await getBitbucketRepoInfoFromGit();
    const lines = ["pbb status:\n"];

    lines.push(
        `${authConfig ? STATUS_ICON.ok : STATUS_ICON.missing} auth ${authConfig ? "configured" : "incomplete"}`,
    );

    lines.push(
        repoInfo
            ? `${STATUS_ICON.ok} repo detected: ${repoInfo.workspace}/${repoInfo.repoSlug}`
            : `${STATUS_ICON.missing} repo not detected`,
    );

    if (!authConfig || !repoInfo) {
        lines.push(`${STATUS_ICON.missing} Bitbucket API access not checked`);
        ctx.ui.notify(lines.join("\n"), "warning");
        return;
    }

    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    let frame = 0;
    const renderLoading = () => {
        ctx.ui.setWidget("pbb-status", [
            ...lines,
            `${spinnerFrames[frame % spinnerFrames.length]} checking Bitbucket API access...\n`,
        ]);
        frame += 1;
    };
    renderLoading();

    const interval = setInterval(renderLoading, 100);

    try {
        const accessCheck = await checkBitbucketRepositoryAccess(authConfig, repoInfo);
        clearInterval(interval);
        const finalLines = [
            ...lines,
            `${accessCheck.ok ? STATUS_ICON.ok : STATUS_ICON.missing} ${accessCheck.message}`,
        ];
        ctx.ui.notify(finalLines.join("\n"), accessCheck.ok ? "info" : "warning");
        ctx.ui.setWidget("pbb-status", undefined);
    } catch (error) {
        clearInterval(interval);
        throw error;
    }
}

import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { getBitbucketContext, hasCompleteBitbucketContext } from "./context.js";
import {
    BITBUCKET_PULL_REQUEST_STATES,
    type BitbucketPullRequestState,
    listBitbucketPullRequests,
} from "./services/list_pull_request.js";
import { runWithSpinner, STATUS_ICON } from "./ui.js";

function parsePullRequestState(
    stateArg: string | undefined,
): BitbucketPullRequestState | undefined {
    if (!stateArg) {
        return "OPEN";
    }

    const normalizedState = stateArg.toUpperCase();
    const matchedState = BITBUCKET_PULL_REQUEST_STATES.find(
        (state) => state === normalizedState,
    );

    return matchedState;
}

export async function handlePbbPrCommand(
    ctx: ExtensionCommandContext,
    stateArg?: string,
): Promise<void> {
    const state = parsePullRequestState(stateArg);
    if (!state) {
        ctx.ui.notify(
            `Unknown pull request state: ${stateArg}\n\nSupported states: ${BITBUCKET_PULL_REQUEST_STATES.join(", ")}`,
            "warning",
        );
        return;
    }

    const context = await getBitbucketContext();
    const stateLabel = state.toLowerCase();
    const lines = [`${stateLabel} prs:`, ""];

    if (!hasCompleteBitbucketContext(context)) {
        lines.push(`${STATUS_ICON.missing} Bitbucket context incomplete`);
        ctx.ui.notify(lines.join("\n"), "warning");
        return;
    }

    const result = await runWithSpinner(
        ctx,
        "pbb-pr",
        lines,
        `fetching ${stateLabel} Bitbucket pull requests...`,
        () => listBitbucketPullRequests(context.authConfig, context.repoInfo, state),
    );

    if (!result.ok) {
        lines.push(`${STATUS_ICON.missing} ${result.message}`);
        ctx.ui.notify(lines.join("\n"), "warning");
        return;
    }

    const pullRequests = result.data.values ?? [];
    if (pullRequests.length === 0) {
        lines.push(`${STATUS_ICON.ok} no ${stateLabel} pull requests`);
        ctx.ui.notify(lines.join("\n"), "info");
        return;
    }

    lines.push(
        `${STATUS_ICON.ok} found ${pullRequests.length} ${stateLabel} pull request(s)\n`,
    );
    for (const pr of pullRequests) {
        const title = pr.title ?? "untitled pull request";
        const id = pr.id ? `#${pr.id}` : "#?";
        lines.push(`${id} ${title}`);
    }

    if (result.data.next) {
        lines.push("");
        lines.push(
            "More pull requests are available. Pagination support coming later.",
        );
    }

    ctx.ui.notify(lines.join("\n"), "info");
}

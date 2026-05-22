import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { handlePbbAuthCommand } from "./auth.js";
import { handlePbbPrCommand } from "./pr.js";
import { BITBUCKET_PULL_REQUEST_STATES } from "./services/list_pull_request.js";
import { handlePbbStatusCommand } from "./status.js";
import registerPbbTools from "./tools.js";

const PBB_SUBCOMMANDS: AutocompleteItem[] = [
    {
        value: "auth",
        label: "auth",
        description: "check Bitbucket auth configuration",
    },
    {
        value: "help",
        label: "help",
        description: "show help",
    },
    {
        value: "status",
        label: "status",
        description: "check Bitbucket repository/access status",
    },
    {
        value: "pr",
        label: "pr",
        description: "list Bitbucket pull requests",
    },
];

const PBB_PR_STATE_COMPLETIONS: AutocompleteItem[] = BITBUCKET_PULL_REQUEST_STATES.map(
    (state) => ({
        value: `pr ${state.toLowerCase()}`,
        label: state.toLowerCase(),
        description: `list ${state.toLowerCase()} pull requests`,
    }),
);

export default function (pi: ExtensionAPI) {
    registerPbbTools(pi);

    pi.registerCommand("pbb", {
        description: "Show pbb package help",
        getArgumentCompletions: async (argumentPrefix: string) => {
            const prefix = argumentPrefix.trimStart().toLowerCase();

            if (prefix.startsWith("pr ")) {
                const matches = PBB_PR_STATE_COMPLETIONS.filter((item) =>
                    item.value.startsWith(prefix),
                );
                return matches.length > 0 ? matches : null;
            }

            const subcommandPrefix = prefix.trimEnd();
            const matches = PBB_SUBCOMMANDS.filter((item) => {
                return item.value.startsWith(subcommandPrefix);
            });
            return matches.length > 0 ? matches : null;
        },
        handler: async (args, ctx) => {
            const [subcommand = "", stateArg] = args.trim().toLowerCase().split(/\s+/);
            switch (subcommand) {
                case "auth": {
                    await handlePbbAuthCommand(ctx);
                    return;
                }

                case "pr": {
                    await handlePbbPrCommand(ctx, stateArg);
                    return;
                }

                case "help":
                case "":
                    ctx.ui.notify(
                        `pbb is a Pi package for Bitbucket.

pbb commands:
    /pbb auth           check Bitbucket auth configuration
    /pbb help           show help
    /pbb pr             list open pull requests
        /pbb pr open        list open pull requests
        /pbb pr merged      list merged pull requests
        /pbb pr declined    list declined pull requests
        /pbb pr superseded  list superseded pull requests
    /pbb status         check Bitbucket configuration

environment:
   PBB_BITBUCKET_ACCESS_TOKEN     required
   PBB_BITBUCKET_API_BASE_URL     optional, defaults to https://api.bitbucket.org/2.0`,

                        "info",
                    );
                    return;

                case "status": {
                    await handlePbbStatusCommand(ctx);
                    return;
                }

                default:
                    ctx.ui.notify(`Unknown pbb command: ${subcommand}`, "warning");
                    return;
            }
        },
    });
}

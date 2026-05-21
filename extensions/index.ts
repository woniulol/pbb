import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { AutocompleteItem } from "@earendil-works/pi-tui";
import { handlePbbAuthCommand } from "./auth.js";
import { handlePbbStatusCommand } from "./status.js";

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
];

export default function (pi: ExtensionAPI) {
    pi.registerCommand("pbb", {
        description: "Show pbb package help",
        getArgumentCompletions: async (argumentPrefix: string) => {
            const prefix = argumentPrefix.trim().toLowerCase();
            const matches = PBB_SUBCOMMANDS.filter((item) => {
                return item.value.startsWith(prefix);
            });
            return matches.length > 0 ? matches : null;
        },
        handler: async (args, ctx) => {
            const subcommand = args.trim().toLowerCase();
            switch (subcommand) {
                case "auth": {
                    await handlePbbAuthCommand(ctx);
                    return;
                }

                case "help":
                case "":
                    ctx.ui.notify(
                        `pbb is a Pi package for Bitbucket.

pbb commands:
    /pbb auth       check Bitbucket auth configuration
    /pbb help       show help
    /pbb status     check Bitbucket configuration

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

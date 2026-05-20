import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { handlePbbAuthCommand } from "./auth.js";

export default function(pi: ExtensionAPI) {

    pi.registerCommand("pbb", {
        description: "Show pbb package help",
        handler: async (args, ctx) => {
            const subcommand = args.trim().toLowerCase();
            switch (subcommand) {
                case "auth": {
                    await handlePbbAuthCommand(ctx);
                    return;
                }

                case "help":
                case "":
                    ctx.ui.notify(`pbb is a Pi package for Bitbucket.

pbb commands:
    /pbb auth       Check Bitbucket auth configuration
    /pbb help       Show help
    /pbb status     Check Bitbucket configuration`,
                        "info");
                    return;

                case "status":
                    ctx.ui.notify("pbb status: config check coming soon.", "info");
                    return;

                default:
                    ctx.ui.notify(`Unknown pbb command: ${subcommand}`, "warning");
                    return;
            }
        }
    });
}

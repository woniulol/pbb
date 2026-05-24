import {
    defineTool,
    truncateHead,
    type AgentToolResult,
} from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { getGitDiff } from "../git/diff.js";
import { STATUS_ICON } from "../ui.js";

export const gitGetDiffParams = Type.Object({
    baseRef: Type.String({
        description:
            "Base git ref to compare from. For pull request review, use the destination branch ref, for example origin/main.",
    }),
    headRef: Type.String({
        description:
            "Head git ref to compare to. For pull request review, use the source branch ref, for example origin/feature-branch.",
    }),
    mode: Type.Optional(
        Type.Union([Type.Literal("summary"), Type.Literal("patch")], {
            description:
                "Use summary first to list changed files and diff stats. Use patch with path to inspect actual code changes for one file.",
        }),
    ),
    path: Type.Optional(
        Type.String({
            description:
                "File path to inspect. Required when mode is patch. Omit for summary mode.",
        }),
    ),
    diffStyle: Type.Optional(
        Type.Union([Type.Literal("three-dot"), Type.Literal("two-dot")], {
            description:
                "Use three-dot for normal pull request review. Use two-dot only when explicitly comparing branch tips.",
        }),
    ),
});

interface GitGetDiffToolDetails {
    baseRef?: string;
    headRef?: string;
    diffRef?: string;
    mode?: string;
    path?: string;
    truncated?: boolean;
}

export const gitGetDiffTool = defineTool<
    typeof gitGetDiffParams,
    GitGetDiffToolDetails
>({
    name: "git_get_diff",
    label: "get git diff",
    description:
        "Use git_get_diff to inspect local git changes. For PR review, call summary mode first with destination as baseRef and source as headRef, then call patch mode with a specific path for files that need review. Use three-dot unless the user asks for tip-to-tip comparison.",
    parameters: gitGetDiffParams,

    async execute(
        toolCallId,
        parameters,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<GitGetDiffToolDetails>> {
        const result = await getGitDiff(parameters);

        if (!result.ok) {
            return {
                content: [{ type: "text", text: result.message }],
                details: {},
            };
        }

        const truncation = truncateHead(result.data.output, {
            maxLines: parameters.mode === "patch" ? 300 : 200,
            maxBytes: parameters.mode === "patch" ? 30_000 : 15_000,
        });

        const text = [
            `git diff ${result.data.diffRef}${result.data.path ? ` -- ${result.data.path}` : ""}`,
            "",
            truncation.content || "No diff output.",
            truncation.truncated
                ? "\n[Output truncated. Request a narrower path-specific patch if needed.]"
                : "",
        ].join("\n");

        return {
            content: [{ type: "text", text }],
            details: {
                baseRef: result.data.baseRef,
                headRef: result.data.headRef,
                diffRef: result.data.diffRef,
                mode: result.data.mode,
                ...(result.data.path !== undefined ? { path: result.data.path } : {}),
                truncated: truncation.truncated,
            },
        };
    },

    renderCall(args, theme, context) {
        const mode = typeof args.mode === "string" ? args.mode : "summary";
        return new Text(
            `${STATUS_ICON.ok} getting ${mode} git diff ${args.baseRef}...${args.headRef}`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        if (!result.details) {
            return new Text("Git diff result", 0, 0);
        }

        let text = `${STATUS_ICON.ok} git diff ${result.details.diffRef ?? ""}`;
        if (result.details.path) {
            text += ` -- ${result.details.path}`;
        }
        if (result.details.truncated) {
            text += " (truncated)";
        }
        return new Text(text, 0, 0);
    },
});

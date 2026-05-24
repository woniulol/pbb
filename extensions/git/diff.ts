import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { PbbResult } from "../client.js";

const execFileAsync = promisify(execFile);

export type GitDiffMode = "summary" | "patch";
export type GitDiffStyle = "three-dot" | "two-dot";

export interface GitDiffOptions {
    baseRef: string;
    headRef: string;
    mode?: GitDiffMode;
    path?: string;
    diffStyle?: GitDiffStyle;
}

export interface GitDiffResult {
    baseRef: string;
    headRef: string;
    diffRef: string;
    mode: GitDiffMode;
    diffStyle: GitDiffStyle;
    path?: string;
    output: string;
}

function buildDiffRef(
    baseRef: string,
    headRef: string,
    diffStyle: GitDiffStyle,
): string {
    return diffStyle === "three-dot"
        ? `${baseRef}...${headRef}`
        : `${baseRef}..${headRef}`;
}

export async function getGitDiff(
    options: GitDiffOptions,
): Promise<PbbResult<GitDiffResult>> {
    const mode = options.mode ?? "summary";
    const diffStyle = options.diffStyle ?? "three-dot";
    const diffRef = buildDiffRef(options.baseRef, options.headRef, diffStyle);

    if (mode === "patch" && !options.path) {
        return {
            ok: false,
            message:
                "git diff patch mode requires a path to avoid returning an oversized diff",
        };
    }

    const args =
        mode === "summary"
            ? ["diff", "--stat", "--name-status", diffRef]
            : ["diff", diffRef, "--", options.path as string];

    try {
        const { stdout } = await execFileAsync("git", args, {
            maxBuffer: 10 * 1024 * 1024,
        });

        const result: GitDiffResult = {
            baseRef: options.baseRef,
            headRef: options.headRef,
            diffRef,
            mode,
            diffStyle,
            output: stdout,
        };

        if (options.path !== undefined) {
            result.path = options.path;
        }

        return {
            ok: true,
            data: result,
        };
    } catch (error) {
        return {
            ok: false,
            message:
                error instanceof Error
                    ? `Local git diff error: ${error.message}`
                    : "Local git diff error: failed to run git diff",
        };
    }
}

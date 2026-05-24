---
name: bitbucket-pr-review
description: Review Bitbucket pull requests, propose inline review comments, ask the user to approve suggestions with questionnaire, and post only approved comments. Use when the user asks to review a Bitbucket PR, suggest PR comments, or post inline comments to a PR.
---

# Bitbucket PR Review

Use this workflow when reviewing a Bitbucket pull request or preparing inline review comments.

## Core rule

Never post review comments without explicit user approval.

## Workflow

1. Identify the pull request.
    - If the PR ID is known, use `bitbucket_get_pull_request`.
    - If the PR ID is unknown, use `bitbucket_list_pull_requests` with `query`, `sort`, `page`, and `pagelen` instead of scanning many pages.

2. Inspect the changes.
    - Use `git_get_diff` or other available diff tools to inspect changed files and line context.
    - Confirm each proposed inline comment targets a file and line that belongs to the PR diff.

3. Prepare candidate inline comments in this shape:

    ```json
    {
        "path": "path/to/file.ts",
        "line": 123,
        "side": "new",
        "body": "Concise actionable review comment.",
        "reason": "Why this comment is useful."
    }
    ```

    Use `side: "new"` for current/new file lines and `side: "old"` for removed/base lines.

4. Ask the user to approve suggestions with the `questionnaire` tool.
    - Ask one question per candidate comment.
    - Options should include at least:
        - `post` / `Post comment as-is`
        - `skip` / `Skip comment`
    - Set `allowOther: true` so the user can type a revised comment body.
    - Include the file, line, side, reason, proposed comment body, and a small relevant diff hunk in the prompt.
    - Keep the diff hunk short: usually 3–8 lines around the target line.
    - Do not include the entire file diff unless the user asks.
    - Treat a custom typed answer as approval with the typed text replacing the proposed comment body.

5. Post only approved comments.
    - For each `post` answer, call `bitbucket_create_pull_request_inline_comment` with the original proposed body.
    - For each custom typed answer, call `bitbucket_create_pull_request_inline_comment` with the user's typed replacement body.
    - Do not post skipped or unapproved suggestions.

## Comment quality

- Keep comments concise and actionable.
- Prefer comments that identify correctness, reliability, maintainability, security, or test coverage issues.
- Avoid nitpicks unless the user requested style-focused review.
- Avoid duplicate comments on the same issue.

## Context discipline

- Keep summaries lean.
- Do not dump full API responses into the conversation unless the user explicitly asks.
- When listing candidate comments, include only the fields needed for user approval: path, line, side, body, and reason.

import { defineTool, type AgentToolResult } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import * as Type from "typebox";
import { formatBitbucketCurlError } from "../bitbucket_error.js";
import { getBitbucketContext, hasCompleteBitbucketContext } from "../context.js";
import { curlJson } from "../curl/json.js";
import type { components } from "../generated/bitbucket-types.js";
import { STATUS_ICON } from "../ui.js";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_LEN = 10;
const MAX_PAGE_LEN = 50;
const DEFAULT_MAX_PAGES = 1;
const MAX_PAGES = 5;

export const listBitbucketPullRequestsCurlParams = Type.Object({
    state: Type.Optional(
        Type.Union([
            Type.Literal("OPEN"),
            Type.Literal("MERGED"),
            Type.Literal("DECLINED"),
            Type.Literal("SUPERSEDED"),
        ]),
    ),
    page: Type.Optional(
        Type.Number({
            minimum: 1,
            description: "Starting page to fetch. Defaults to 1.",
        }),
    ),
    pagelen: Type.Optional(
        Type.Number({
            minimum: 1,
            maximum: MAX_PAGE_LEN,
            description: `Pull requests per page. Defaults to ${DEFAULT_PAGE_LEN}; capped at ${MAX_PAGE_LEN}.`,
        }),
    ),
    maxPages: Type.Optional(
        Type.Number({
            minimum: 1,
            maximum: MAX_PAGES,
            description: `Maximum number of pages to fetch from the starting page. Defaults to ${DEFAULT_MAX_PAGES}; capped at ${MAX_PAGES}.`,
        }),
    ),
    query: Type.Optional(
        Type.String({
            description:
                'Optional Bitbucket q filter, for example title~"SKU". Prefer query over scanning many pages when searching by vague topic.',
        }),
    ),
    sort: Type.Optional(
        Type.String({
            description:
                "Optional Bitbucket sort expression, for example -updated_on. Defaults to Bitbucket's endpoint behavior.",
        }),
    ),
});

type PullRequestPage = components["schemas"]["paginated_pullrequests"];
type PullRequest = components["schemas"]["pullrequest"];

interface ListBitbucketPullRequestsCurlToolDetails {
    repo?: string;
    state?: string;
    count?: number;
    page?: number;
    pagelen?: number;
    pagesFetched?: number;
    size?: number;
    hasMore?: boolean;
    nextPage?: number;
    truncated?: boolean;
}

function appendQueryParam(
    params: URLSearchParams,
    key: string,
    value: string | number | undefined,
): void {
    if (value !== undefined && value !== "") {
        params.set(key, String(value));
    }
}

export function buildPullRequestsUrl(options: {
    apiBaseUrl: string;
    workspace: string;
    repoSlug: string;
    state: string;
    page: number;
    pagelen: number;
    query?: string;
    sort?: string;
}): string {
    const apiBaseUrl = options.apiBaseUrl.replace(/\/$/, "");
    const baseUrl = `${apiBaseUrl}/repositories/${options.workspace}/${options.repoSlug}/pullrequests`;
    const queryParams = new URLSearchParams();
    appendQueryParam(queryParams, "state", options.state);
    appendQueryParam(queryParams, "page", options.page);
    appendQueryParam(queryParams, "pagelen", options.pagelen);
    appendQueryParam(queryParams, "q", options.query);
    appendQueryParam(queryParams, "sort", options.sort);
    return `${baseUrl}?${queryParams.toString()}`;
}

function getBranchName(
    pullRequest: PullRequest,
    side: "source" | "destination",
): string {
    return pullRequest[side]?.branch?.name ?? "unknown";
}

function getAuthorName(pullRequest: PullRequest): string {
    const displayName = pullRequest.author?.display_name;
    const nickname = pullRequest.author?.nickname;
    if (typeof displayName === "string") return displayName;
    if (typeof nickname === "string") return nickname;
    return "unknown";
}

function getHtmlUrl(pullRequest: PullRequest): string {
    const links = pullRequest.links as { html?: { href?: string } } | undefined;
    return links?.html?.href ?? "unknown";
}

export function formatPullRequestSummary(pullRequest: PullRequest): string {
    const id = pullRequest.id ?? "?";
    const title = pullRequest.title ?? "untitled";
    const state = pullRequest.state ?? "unknown";
    const source = getBranchName(pullRequest, "source");
    const destination = getBranchName(pullRequest, "destination");
    const author = getAuthorName(pullRequest);
    const updatedOn = pullRequest.updated_on ?? "unknown";
    const url = getHtmlUrl(pullRequest);

    return `#${id} ${title} [${state}] ${source} -> ${destination}; author=${author}; updated=${updatedOn}; url=${url}`;
}

export const listBitbucketPullRequestsCurlTool = defineTool<
    typeof listBitbucketPullRequestsCurlParams,
    ListBitbucketPullRequestsCurlToolDetails
>({
    name: "bitbucket_list_pull_requests",
    label: "list Bitbucket pull requests",
    description:
        "List a bounded page range of Bitbucket pull requests using curl. Use this for browsing/searching; if a PR ID is known, use bitbucket_get_pull_request directly instead of scanning pages.",
    parameters: listBitbucketPullRequestsCurlParams,

    async execute(
        toolCallId,
        params,
        signal,
        onUpdate,
        ctx,
    ): Promise<AgentToolResult<ListBitbucketPullRequestsCurlToolDetails>> {
        const context = await getBitbucketContext();
        if (!hasCompleteBitbucketContext(context)) {
            return {
                content: [{ type: "text", text: "bitbucket API access not checked" }],
                details: {},
            };
        }

        const state = params.state ?? "OPEN";
        const page = params.page ?? DEFAULT_PAGE;
        const pagelen = params.pagelen ?? DEFAULT_PAGE_LEN;
        const maxPages = params.maxPages ?? DEFAULT_MAX_PAGES;
        const { authConfig, repoInfo } = context;
        let nextUrl: string | undefined = buildPullRequestsUrl({
            apiBaseUrl: authConfig.apiBaseUrl,
            workspace: repoInfo.workspace,
            repoSlug: repoInfo.repoSlug,
            state,
            page,
            pagelen,
            ...(params.query === undefined ? {} : { query: params.query }),
            ...(params.sort === undefined ? {} : { sort: params.sort }),
        });
        const pullRequests: PullRequest[] = [];
        let pagesFetched = 0;
        let size: number | undefined;
        let hasMore = false;
        let nextPage: number | undefined;

        while (nextUrl && pagesFetched < maxPages) {
            const result: Awaited<ReturnType<typeof curlJson<PullRequestPage>>> =
                await curlJson<PullRequestPage>({
                    method: "GET",
                    url: nextUrl,
                    headers: {
                        Authorization: `Bearer ${authConfig.accessToken}`,
                    },
                });

            if (!result.ok) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to list ${state.toLowerCase()} pull requests: ${formatBitbucketCurlError(result.error)}.`,
                        },
                    ],
                    details: {},
                };
            }

            const pageData: PullRequestPage | undefined = result.value.data;
            if (!pageData) {
                return {
                    content: [
                        {
                            type: "text",
                            text: "Bitbucket returned an empty response body while listing pull requests.",
                        },
                    ],
                    details: {},
                };
            }

            pullRequests.push(...(pageData.values ?? []));
            size ??= pageData.size;
            pagesFetched += 1;
            nextUrl = pageData.next;
            hasMore = Boolean(nextUrl);
        }

        if (hasMore) {
            nextPage = page + pagesFetched;
        }
        const truncated = hasMore;
        const summaries = pullRequests.map(formatPullRequestSummary);
        const sizeText = size === undefined ? "unknown total" : `${size} total`;
        const moreText = truncated
            ? `\nResults truncated: fetched ${pagesFetched} page(s), and more results exist. Re-run with page=${nextPage ?? page + pagesFetched}, increase maxPages up to ${MAX_PAGES}, or use query filters to narrow the search.`
            : "";

        return {
            content: [
                {
                    type: "text",
                    text: `${pullRequests.length} ${state.toLowerCase()} pull request(s) found from page ${page}, ${pagesFetched} page(s) fetched, ${sizeText}, has_more=${hasMore}${nextPage === undefined ? "" : `, next_page=${nextPage}`}.\n${summaries.join("\n")}${moreText}`,
                },
            ],
            details: {
                repo: `${repoInfo.workspace}/${repoInfo.repoSlug}`,
                state,
                count: pullRequests.length,
                page,
                pagelen,
                pagesFetched,
                ...(size === undefined ? {} : { size }),
                hasMore,
                ...(nextPage === undefined ? {} : { nextPage }),
                truncated,
            },
        };
    },

    renderCall(args, theme, context) {
        const state = typeof args.state === "string" ? args.state : "OPEN";
        return new Text(
            `${STATUS_ICON.ok} listing ${state.toLowerCase()} Bitbucket pull requests`,
            0,
            0,
        );
    },

    renderResult(result, options, theme, context) {
        if (!result.details || Object.keys(result.details).length === 0) {
            const firstText = result.content.find((item) => item.type === "text")?.text;
            return new Text(firstText ?? "Bitbucket PR result", 0, 0);
        }
        let text = `${STATUS_ICON.ok} ${result.details.count ?? 0} ${result.details.state?.toLowerCase() ?? "open"} pull request(s) found in ${result.details.repo}`;
        if (result.details.truncated) {
            text += ` Results truncated; next page: ${result.details.nextPage ?? "unknown"}.`;
        }
        return new Text(text, 0, 0);
    },
});

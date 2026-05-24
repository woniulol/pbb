import { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createBitbucketPullRequestCurlTool } from "./create_pull_request_curl.js";
import { createBitbucketPullRequestInlineCommentCurlTool } from "./create_pull_request_inline_comment_curl.js";
import { getBitbucketPullRequestCurlTool } from "./get_pull_request_curl.js";
import { gitGetDiffTool } from "./git_get_diff.js";
import { listBitbucketPullRequestsCurlTool } from "./list_pull_requests_curl.js";

export default function registerPbbTools(pi: ExtensionAPI) {
    pi.registerTool(listBitbucketPullRequestsCurlTool);
    pi.registerTool(getBitbucketPullRequestCurlTool);
    pi.registerTool(createBitbucketPullRequestCurlTool);
    pi.registerTool(createBitbucketPullRequestInlineCommentCurlTool);
    pi.registerTool(gitGetDiffTool);
}

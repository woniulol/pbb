import createClient from "openapi-fetch";
import type { Client } from "openapi-fetch";
import type { paths } from "./generated/bitbucket-types.js";
import {
    getBitbucketBasicAuthHeader,
    type BitbucketAuthConfig,
} from "./auth.js";

export type PbbResult<T> =
    | {
          ok: true;
          status?: number;
          data: T;
      }
    | {
          ok: false;
          status?: number;
          message: string;
      };

export default function createBitbucketClient(
    authConfig: BitbucketAuthConfig,
): Client<paths> {
    const { apiBaseUrl } = authConfig;
    return createClient<paths>({
        baseUrl: apiBaseUrl,
        headers: {
            Authorization: getBitbucketBasicAuthHeader(authConfig),
            Accept: "application/json",
        },
    });
}

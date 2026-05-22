import createClient from "openapi-fetch";
import type { Client } from "openapi-fetch";
import type { paths } from "./generated/bitbucket-types.js";
import type { BitbucketAuthConfig } from "./auth.js";

export type PbbResult<T> =
    | {
          ok: true;
          status: number;
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
    const { accessToken, apiBaseUrl } = authConfig;
    return createClient<paths>({
        baseUrl: apiBaseUrl,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
        },
    });
}

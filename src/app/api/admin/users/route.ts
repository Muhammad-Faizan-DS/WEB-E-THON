import { route, body, input } from "@/server/http";
import { account, accountPatch, userQuery } from "@/lib/contracts/operations";
import { createAccount, editAccount, searchAccounts } from "@/server/admin";

/** ?role=candidate|examiner|admin&q=<name or email>&page=<n>, 20 per page. */
export const GET = route(["admin"], (request) => {
  const query = new URL(request.url).searchParams;
  return searchAccounts(input(userQuery, { role: query.get("role") || undefined, q: query.get("q") || undefined, page: query.get("page") ?? undefined }));
});
export const POST = route(["admin"], async (request, _params, actor) => createAccount(actor.id, await body(request, account)), 201);
export const PATCH = route(["admin"], async (request, _params, actor) => editAccount(actor.id, await body(request, accountPatch)));

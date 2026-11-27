import { route, body } from "@/server/http";
import { account, accountPatch } from "@/lib/contracts/operations";
import { listAccounts, createAccount, editAccount } from "@/server/admin";

export const GET = route(["admin"], () => listAccounts());
export const POST = route(["admin"], async (request, _params, actor) => createAccount(actor.id, await body(request, account)), 201);
export const PATCH = route(["admin"], async (request, _params, actor) => editAccount(actor.id, await body(request, accountPatch)));

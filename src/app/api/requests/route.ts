import { route, body } from "@/server/http";
import { requestPatch } from "@/lib/contracts/operations";
import { listRequests, decideRequest } from "@/server/requests";

export const GET = route(["admin","examiner"], (_request, _params, actor) => listRequests(actor));
export const PATCH = route(["admin","examiner"], async (request, _params, actor) => decideRequest(actor, await body(request, requestPatch)));

import { body, route } from "@/server/http";
import { disputeInput } from "@/lib/contracts/operations";
import { fileDispute, listDisputes } from "@/server/disputes";

export const GET = route(["candidate", "examiner", "admin"], (_request, _params, actor) => listDisputes(actor));
export const POST = route(["candidate"], async (request, _params, actor) => fileDispute(actor, await body(request, disputeInput)), 201);

import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { unblockInput } from "@/lib/contracts/operations";
import { unblock } from "@/server/requests";

export const POST = route(["admin"], async (request, params, actor) => unblock(actor.id, input(id, params.id), (await body(request, unblockInput)).reason));

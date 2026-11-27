import { body, input, route } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { disputeUpdate } from "@/lib/contracts/operations";
import { answerDispute } from "@/server/disputes";

export const PATCH = route(["examiner", "admin"], async (request, params, actor) =>
  answerDispute(actor, input(id, params.id), await body(request, disputeUpdate)));

import { route, body, input } from "@/server/http";
import { handInput, id } from "@/lib/contracts/core";
import { raiseHand } from "@/server/attempts";

/** Candidate raises or lowers their hand during an active attempt (own attempt, current session only). */
export const POST = route(["candidate"], async (request, params, actor) => {
  const data = await body(request, handInput);
  return raiseHand(actor, input(id, params.id), data.sessionId, data.raised, data.message);
}, 200, true);

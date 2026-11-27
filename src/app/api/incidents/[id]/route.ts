import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { incidentReview } from "@/lib/contracts/operations";
import { decideIncident } from "@/server/monitor";

export const PATCH = route(["admin","examiner"], async (request, params, actor) => decideIncident(actor, input(id, params.id), await body(request, incidentReview)));

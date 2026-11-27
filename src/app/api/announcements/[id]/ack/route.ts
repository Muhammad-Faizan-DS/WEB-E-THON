import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { acknowledgeAnnouncement } from "@/server/monitor";

/** Candidate read receipt ("Got it") for an announcement addressed to them. */
export const POST = route(["candidate"], (_request, params, actor) => acknowledgeAnnouncement(actor, input(id, params.id)));

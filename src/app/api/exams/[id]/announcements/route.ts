import { route, body, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { announcementInput } from "@/lib/contracts/operations";
import { postAnnouncement } from "@/server/monitor";

export const POST = route(["examiner"], async (request, params, actor) => postAnnouncement(actor, input(id, params.id), await body(request, announcementInput)), 201);

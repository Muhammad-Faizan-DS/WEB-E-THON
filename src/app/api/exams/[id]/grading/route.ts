import { route, input } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { gradingQueue } from "@/server/grading";

export const GET = route(["examiner"], (_request, params, actor) => gradingQueue(actor.id, input(id, params.id)));

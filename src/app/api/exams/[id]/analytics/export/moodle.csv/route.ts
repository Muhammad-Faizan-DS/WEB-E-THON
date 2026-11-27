import { route, input, fileResponse } from "@/server/http";
import { id } from "@/lib/contracts/core";
import { moodleGrades } from "@/server/analytics";

export const GET = route(["examiner"], async (_request, params, actor) => fileResponse(await moodleGrades(actor.id, input(id, params.id)), "grades.csv", "text/csv; charset=utf-8"));

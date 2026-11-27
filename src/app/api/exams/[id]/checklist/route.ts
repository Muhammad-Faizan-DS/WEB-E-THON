import { idInput } from "@/lib/contracts/core";
import { getChecklist } from "@/server/exams";
import { input, route } from "@/server/http";

export const GET = route(["examiner"], (_request, params, actor) =>
  getChecklist(actor.id, input(idInput, params).id));

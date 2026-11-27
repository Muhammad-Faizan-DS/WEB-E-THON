import { idInput } from "@/lib/contracts/core";
import { publishExam } from "@/server/exams";
import { input, route } from "@/server/http";

export const POST = route(["examiner"], (_request, params, actor) =>
  publishExam(actor.id, input(idInput, params).id, false));

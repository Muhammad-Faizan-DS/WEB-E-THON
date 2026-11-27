import { body, input, route } from "@/server/http";
import { examInput, examPatch, id } from "@/lib/contracts/core";
import { createExam, getExam, listExams, updateExam } from "@/server/exams";

export const GET = route(["examiner", "admin"], (request, _params, actor) => {
  const examId = new URL(request.url).searchParams.get("id");
  if (actor.role === "admin") return listExams();
  return examId === null ? listExams(actor.id) : getExam(actor.id, input(id, examId));
});
export const POST = route(["examiner"], async (request, _params, actor) =>
  createExam(actor.id, await body(request, examInput)), 201);
export const PATCH = route(["examiner"], async (request, _params, actor) => {
  const { id, ...patch } = await body(request, examPatch);
  return updateExam(actor.id, id, patch);
});

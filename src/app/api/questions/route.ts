import { body, input, route } from "@/server/http";
import { idInput, questionInput, questionUpdate } from "@/lib/contracts/core";
import { createQuestion, listQuestions, removeQuestion, updateQuestion } from "@/server/questions";

export const GET = route(["examiner", "admin"], (_request, _params, actor) => listQuestions(actor.role === "examiner" ? actor.id : undefined));
export const POST = route(["examiner"], async (request, _params, actor) =>
  createQuestion(actor.id, await body(request, questionInput)), 201);
export const PATCH = route(["examiner"], async (request, _params, actor) => {
  const { id, question } = await body(request, questionUpdate);
  return updateQuestion(actor.id, id, question);
});
export const DELETE = route(["examiner"], (request, _params, actor) =>
  removeQuestion(actor.id, input(idInput, { id: new URL(request.url).searchParams.get("id") }).id));

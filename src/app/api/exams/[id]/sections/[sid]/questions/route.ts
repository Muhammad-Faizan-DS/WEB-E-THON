import { z } from "zod";
import { body, input, route } from "@/server/http";
import { id, questionInput, questionUpdate } from "@/lib/contracts/core";
import { createSectionQuestion, detachFromSection, listSectionQuestions, updateSectionQuestion } from "@/server/sections";

const target = z.object({ id, sid: id });

export const GET = route(["examiner"], (_request, params, actor) => {
  const { id: examId, sid } = input(target, params);
  return listSectionQuestions(actor.id, examId, sid);
});
export const POST = route(["examiner"], async (request, params, actor) => {
  const { id: examId, sid } = input(target, params);
  return createSectionQuestion(actor.id, examId, sid, await body(request, questionInput));
}, 201);
export const PATCH = route(["examiner"], async (request, params, actor) => {
  const { id: examId, sid } = input(target, params);
  const { id: questionId, question } = await body(request, questionUpdate);
  return updateSectionQuestion(actor.id, examId, sid, questionId, question);
});
export const DELETE = route(["examiner"], (request, params, actor) => {
  const { id: examId, sid } = input(target, params);
  return detachFromSection(actor.id, examId, sid, input(id, new URL(request.url).searchParams.get("questionId")));
});

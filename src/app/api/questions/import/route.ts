import { route, body } from "@/server/http";
import { questionImport } from "@/lib/contracts/operations";
import { importQuestions } from "@/server/imports";

export const POST = route(["examiner"], async (request, _params, actor) => {
  const data = await body(request, questionImport);
  return importQuestions(actor.id, { ...data, commit: data.commit || new URL(request.url).searchParams.get("commit") === "true" });
});

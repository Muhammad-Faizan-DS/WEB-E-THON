import { route } from "@/server/http";
import { candidateResults } from "@/server/grading";

export const GET = route(["candidate"], (_request, _params, actor) => candidateResults(actor.id));

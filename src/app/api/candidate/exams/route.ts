import { route } from "@/server/http";
import { candidateExams } from "@/server/start";

export const GET = route(["candidate"], (_request, _params, actor) => candidateExams(actor.id));

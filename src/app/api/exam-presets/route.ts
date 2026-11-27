import { route } from "@/server/http";
import { examPresets } from "@/lib/contracts/sections";

export const GET = route(["examiner", "admin"], async () => examPresets);

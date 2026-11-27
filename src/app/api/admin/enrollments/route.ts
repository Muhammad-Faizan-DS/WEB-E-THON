import { route } from "@/server/http";
import { blockedEnrollments } from "@/server/requests";

export const GET = route(["admin"], () => blockedEnrollments());

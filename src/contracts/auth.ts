import { z } from "zod";

export const Role = z.enum(["admin", "examiner", "candidate"]);
export type Role = z.infer<typeof Role>;

export const LoginRequest = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
export type LoginRequest = z.infer<typeof LoginRequest>;

export const Preferences = z.object({
  textSize: z.enum(["sm", "md", "lg", "xl"]).default("md"),
  layout: z.enum(["single", "split"]).default("single"),
  navigatorPosition: z.enum(["left", "right"]).default("left"),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  reduceMotion: z.boolean().default(false),
});
export type Preferences = z.infer<typeof Preferences>;
export const DEFAULT_PREFERENCES: Preferences = { textSize: "md", layout: "single", navigatorPosition: "left", theme: "system", reduceMotion: false };

export const Me = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: Role,
  preferences: Preferences,
});
export type Me = z.infer<typeof Me>;

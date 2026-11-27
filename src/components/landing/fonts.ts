import { Montserrat, Poppins } from "next/font/google";

/** Record Book faces. Loaded by the homepage only; the app screens keep their own stack for now. */
export const display = Montserrat({ subsets: ["latin"], weight: ["600", "700", "800", "900"], variable: "--font-montserrat", display: "swap" });
export const body = Poppins({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-poppins", display: "swap" });

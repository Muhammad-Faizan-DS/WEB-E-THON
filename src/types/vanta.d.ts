declare module "vanta/dist/vanta.dots.min" {
  export interface VantaEffect { destroy(): void; resize(): void; setOptions?(o: Record<string, unknown>): void }
  const DOTS: (options: Record<string, unknown>) => VantaEffect;
  export default DOTS;
}

/** three r134 ships no types; it is only handed to Vanta. */
declare module "three";

declare module "vanta/dist/vanta.topology.min" {
  interface VantaP5 { loop(): void; noLoop(): void }
  export interface VantaEffect { destroy(): void; resize(): void; p5?: VantaP5 }
  const TOPOLOGY: (options: Record<string, unknown>) => VantaEffect;
  export default TOPOLOGY;
}

/** p5 is only handed to Vanta as an opaque constructor. */
declare module "p5" {
  const p5: unknown;
  export default p5;
}

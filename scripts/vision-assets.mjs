import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, copyFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const wasm = join(dirname(require.resolve("@mediapipe/tasks-vision")), "wasm");
const target = join(process.cwd(), "public", "models", "vision");
const modelUrl = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
const modelPath = join(target, "blaze_face_short_range.tflite");
await mkdir(target, { recursive: true });
await Promise.all((await readdir(wasm)).map((name) => copyFile(join(wasm, name), join(target, name))));
let model = await readFile(modelPath).catch(() => null);
if (!model) {
  const response = await fetch(modelUrl);
  if (!response.ok) throw new Error("Model download failed with HTTP " + response.status);
  model = Buffer.from(await response.arrayBuffer());
}
if (model.length < 16 || model.toString("ascii", 4, 8) !== "TFL3") throw new Error("Invalid TensorFlow Lite model.");
const digest = createHash("sha256").update(model).digest("hex");
if (digest !== "b4578f35940bf5a1a655214a1cce5cab13eba73c1297cd78e1a04c2380b0152f") throw new Error("Unexpected camera model checksum.");
await writeFile(modelPath, model);
console.log("Camera assets ready.");

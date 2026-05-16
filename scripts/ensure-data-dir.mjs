import { mkdirSync } from "node:fs";
import { join } from "node:path";

mkdirSync(join(process.cwd(), "data"), { recursive: true });

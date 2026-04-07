import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

const REPORTS_DIR = join(process.cwd(), "harness", "reports");

async function safeRead(name: string) {
  try {
    const raw = await readFile(join(REPORTS_DIR, name), "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  return NextResponse.json({
    incidents: await safeRead("runtime-incidents.json"),
    learned_failures: await safeRead("runtime-learned-failures.json")
  });
}

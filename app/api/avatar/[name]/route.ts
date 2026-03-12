import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ name: string }> },
) {
  const { name } = await context.params;
  const safeName = path.basename(name);
  const normalized = safeName.toLowerCase();

  if (!normalized.endsWith(".png") && !normalized.endsWith(".jpg") && !normalized.endsWith(".jpeg")) {
    return NextResponse.json({ error: "Invalid file" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "Imagenes", safeName);

  try {
    const buffer = await readFile(filePath);
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": normalized.endsWith(".png") ? "image/png" : "image/jpeg",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

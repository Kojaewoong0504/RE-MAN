import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    status: "not_implemented",
    message: "이메일 발송은 MVP 이후 단계에서 연결됩니다."
  });
}

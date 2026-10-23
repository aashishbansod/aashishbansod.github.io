import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: "OTP verification API is working.",
      data: body,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "Invalid OTP verification request.",
        code: "INVALID_REQUEST",
      },
      { status: 400 }
    );
  }
}
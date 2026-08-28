import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export function updateSession(_request: NextRequest) {
	return NextResponse.next({ request: _request });
}

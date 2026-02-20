import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

async function deleteByFilter(entityApi: any, filter: Record<string, string>) {
  const records = await entityApi.filter(filter);
  for (const record of records || []) {
    await entityApi.delete(record.id);
  }
  return (records || []).length;
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get("origin"));

  if (req.method === "OPTIONS") {
    return new Response(null, { headers });
  }

  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers });
  }
` `
  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== true) {
      return Response.json({ error: "Deletion must be explicitly confirmed." }, { status: 400, headers });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: "Unauthorized" }, { status: 401, headers });
    }

    const email = String(user.email).toLowerCase().trim();
    const report: Record<string, number> = {};

    report.userPreferences = await deleteByFilter(
      base44.asServiceRole.entities.UserPreferences,
      { created_by: email },
    );
    report.dailyBriefings = await deleteByFilter(
      base44.asServiceRole.entities.DailyBriefing,
      { created_by: email },
    );
    report.userNewsCache = await deleteByFilter(
      base44.asServiceRole.entities.UserNewsCache,
      { user_email: email },
    );

    // Best-effort cleanup for users who also joined a landing waitlist.
    try {
      report.waitlistSignup = await deleteByFilter(
        base44.asServiceRole.entities.WaitlistSignup,
        { email },
      );
    } catch {
      report.waitlistSignup = 0;
    }

    // Final compliance step: permanently remove the auth identity itself.
    await base44.auth.deleteMe();

    return Response.json(
      {
        success: true,
        deleted: report,
        message: "Account and user data deleted successfully.",
      },
      { headers },
    );
  } catch (error) {
    console.error("deleteAccount failed:", error);
    return Response.json(
      { error: "Failed to delete account.", details: error?.message || "unknown error" },
      { status: 500, headers },
    );
  }
});


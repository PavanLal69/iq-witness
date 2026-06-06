// src/app/api/cases/[id]/reports/[format]/route.ts
// Generates a simple HTML report (PDF/DOCX generation requires server-side libraries)
// On Vercel free tier, we generate an HTML report that opens in the browser.

import { NextRequest, NextResponse } from "next/server";
import { getCase, getTimeline, getEntities } from "@/lib/firestore";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; format: string }> }) {
  try {
    const { id, format } = await params;
    const body = await req.json().catch(() => ({}));
    const { report_type = "police", custom_notes = "" } = body;

    const caseData = await getCase(id);
    if (!caseData) return NextResponse.json({ detail: "Case not found" }, { status: 404 });

    const events = await getTimeline(id);
    const entities = await getEntities(id);

    const reportTypeLabel: Record<string, string> = {
      police: "Police Complaint Summary",
      insurance: "Insurance Claim Summary",
      hr: "HR Investigation Report",
      disciplinary: "College Disciplinary Brief",
      legal: "Legal Evidence Brief",
    };

    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>WitnessIQ Report — ${caseData.title}</title>
  <style>
    body { font-family: Georgia, serif; max-width: 820px; margin: 40px auto; color: #1a1a1a; font-size: 13px; line-height: 1.6; }
    .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 12px; margin-bottom: 24px; }
    .confidential { color: #cc0000; font-size: 10px; font-family: Arial, sans-serif; text-transform: uppercase; letter-spacing: 2px; font-weight: bold; }
    h1 { font-size: 20px; margin: 8px 0; }
    h2 { font-size: 14px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-top: 24px; text-transform: uppercase; font-family: Arial, sans-serif; }
    .meta-table td { padding: 2px 8px 2px 0; }
    .meta-table td:first-child { font-weight: bold; color: #555; width: 140px; }
    .event { border-left: 3px solid #333; padding-left: 12px; margin-bottom: 14px; }
    .event-time { font-family: monospace; font-size: 11px; color: #555; }
    .event-title { font-weight: bold; }
    .entity-tag { display: inline-block; border: 1px solid #ccc; padding: 2px 8px; border-radius: 3px; margin: 3px; font-size: 11px; font-family: Arial, sans-serif; }
    .entity-type { font-size: 9px; color: #777; text-transform: uppercase; margin-right: 4px; }
    .footer { margin-top: 40px; border-top: 1px solid #ccc; padding-top: 12px; font-size: 10px; color: #999; font-style: italic; }
  </style>
</head>
<body>
  <div class="header">
    <div class="confidential">Confidential // Forensic Investigation Brief</div>
    <h1>${reportTypeLabel[report_type] || "Investigation Report"}: ${caseData.title}</h1>
  </div>

  <table class="meta-table">
    <tr><td>Case Reference:</td><td><strong>CASE-${id.slice(0, 8).toUpperCase()}</strong></td></tr>
    <tr><td>Date Compiled:</td><td>${new Date().toLocaleDateString()}</td></tr>
    <tr><td>Report Type:</td><td>${reportTypeLabel[report_type] || report_type}</td></tr>
    <tr><td>Status:</td><td>${caseData.status}</td></tr>
  </table>

  <h2>Executive Summary</h2>
  <p>${caseData.description || "No description provided."}</p>
  ${custom_notes ? `<p><strong>Analyst Addendum:</strong> ${custom_notes}</p>` : ""}

  <h2>Correlated Timeline (${events.length} events)</h2>
  ${events.map(ev => `
    <div class="event">
      <div class="event-time">${new Date(ev.timestamp).toLocaleString()}</div>
      <div class="event-title">${ev.title}</div>
      <div>${ev.description}</div>
    </div>
  `).join("")}

  <h2>Key Entities (${entities.length})</h2>
  <div>
    ${entities.map(e => `<span class="entity-tag"><span class="entity-type">${e.type}</span>${e.name}</span>`).join("")}
  </div>

  <div class="footer">
    This document was compiled automatically using multi-source evidence synthesis technology by WitnessIQ. 
    Generated: ${new Date().toISOString()}
  </div>
</body>
</html>`;

    // Return as HTML (downloadable)
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `attachment; filename="WitnessIQ_Report_Case_${id}.html"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

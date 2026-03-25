import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { medication, dosage, frequency, duration, patient_allergies, current_medications } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a clinical pharmacology AI assistant. You analyze prescriptions for safety.
You must check for:
1. Drug-drug interactions between the new medication and current medications
2. Allergy alerts if the patient has known allergies that may react with the new medication
3. Dosage safety - whether the dosage seems within normal clinical ranges

Respond ONLY using the provided tool. Be thorough but concise. If there are no issues, return severity "safe".`;

    const userPrompt = `Check this prescription for safety:

NEW MEDICATION: ${medication}
DOSAGE: ${dosage}
FREQUENCY: ${frequency}
DURATION: ${duration || "Not specified"}

PATIENT KNOWN ALLERGIES: ${patient_allergies || "None reported"}

CURRENT/RECENT MEDICATIONS: ${current_medications?.length ? current_medications.join(", ") : "None on record"}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "drug_safety_report",
              description: "Return a drug safety analysis report",
              parameters: {
                type: "object",
                properties: {
                  severity: {
                    type: "string",
                    enum: ["safe", "warning", "danger"],
                    description: "Overall severity: safe=no issues, warning=potential concerns, danger=serious risk",
                  },
                  summary: {
                    type: "string",
                    description: "One-line summary of findings",
                  },
                  interactions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        type: { type: "string", enum: ["drug_interaction", "allergy", "dosage"] },
                        severity: { type: "string", enum: ["low", "moderate", "high", "critical"] },
                        description: { type: "string" },
                        recommendation: { type: "string" },
                      },
                      required: ["type", "severity", "description", "recommendation"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["severity", "summary", "interactions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "drug_safety_report" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI analysis failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall) {
      return new Response(JSON.stringify({ error: "AI did not return structured data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const report = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(report), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("drug-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

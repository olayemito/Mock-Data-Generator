export function buildPrompt(config, fields, batchSize, previous_distribution_summary, formId) {
  const count = batchSize || config.entries || 10

  const cleanFields = fields && fields.length > 0
    ? fields.filter(f => f.name && !f.name.startsWith("_"))
    : []

  let fieldList
  let fieldCount

  if (cleanFields.length > 0) {
    fieldList = cleanFields.map(f => {
      let line = `- ${f.name} (type: ${f.type})`
      if (f.choices && f.choices.length > 0) {
        line += ` — ALLOWED VALUES ONLY: [${f.choices.join(", ")}]`
      }
      return line
    }).join("\n")
    fieldCount = cleanFields.length
  } else {
    fieldList = [
      "- name (type: text)",
      "- age (type: integer) — realistic ages between 18 and 65",
      "- gender (type: select_one) — ALLOWED VALUES ONLY: [male, female]",
      "- location (type: text)",
    ].join("\n")
    fieldCount = 4
  }

  // ── Generation mode: 'uniform' → UNIFORM, otherwise REALISTIC ──────────────
  // activeMode = UNIFORM when uniform selected OR baseline N < 10 (cold-start fallback);
  // otherwise REALISTIC. {GENERATION_MODE} interpolates activeMode so the prompt header
  // matches the distribution fallback (no cold-start contradiction / hallucinated distros).
  // totalRows is preferred; totalRecords is the actual key emitted by computeDistribution.
  const totalBaselineRows =
    previous_distribution_summary?.totalRows ??
    previous_distribution_summary?.totalRecords ?? 0
  const activeMode =
    (config.distribution === "uniform" || totalBaselineRows < 10) ? "UNIFORM" : "REALISTIC"

  // ── Empirical distribution matrix (REALISTIC only, and only once N >= 10) ───
  let contextBlock = ""
  if (previous_distribution_summary && previous_distribution_summary.fields) {
    const lines = []
    for (const [name, info] of Object.entries(previous_distribution_summary.fields)) {
      const total = info && info.total ? info.total : 0
      if (total <= 0) continue
      const parts = Object.entries(info.counts || {})
        .map(([v, c]) => `${v} ${Math.round((c / total) * 100)}% (${c})`)
        .join(", ")
      lines.push(`- ${name}: ${parts} [n=${total}]`)
    }
    if (lines.length > 0) {
      contextBlock =
        `PREVIOUS DISTRIBUTION (from ${previous_distribution_summary.totalRecords || 0} rows already generated):\n` +
        lines.join("\n")
    }
  }
  const distributions =
    (activeMode === "REALISTIC" && contextBlock)
      ? contextBlock
      : "None (Uniform selection across allowed choice keys)"

  const formIdStr = formId || "(not provided)"

  const system =
`You are an enterprise-grade synthetic data generation engine specifically designed for KoboToolbox and OpenRosa field data platforms.

YOUR MISSION:
Analyze the provided XLSForm asset schema, field specifications, and empirical distribution metrics to generate highly realistic, schema-valid, ready-to-submit survey records.

================================================================================
1. CRITICAL FIELD KEY RULE (NON-NEGOTIABLE)
================================================================================
Every key in your generated JSON objects MUST match the exact internal XLSForm XML field name (the 'name' attribute in the schema).
- NEVER use human-readable question labels, display text, or column titles.
- Example: Use "caregiver_edu", NOT "1. Caregiver's highest educational level".

================================================================================
2. FIELD TYPE & VALUE FORMATTING CONSTRAINTS
================================================================================
- select_one: Return exactly one choice key string from the allowed choices array (e.g., "Secondary").
- select_multiple (CRITICAL): Return selected choice keys as a SINGLE SPACE-DELIMITED STRING.
  * CORRECT: "coil indoor_spray repellent"
  * INCORRECT: ["coil", "indoor_spray"], "coil, indoor_spray"
- integer / decimal: Return numeric string or number within observed min/max limits.
- text / string: Generate contextually realistic brief text.
- PII / Sensitive Fields: If a field is flagged as PII (names, phone numbers, GPS, addresses), generate fictitious, realistic placeholder text. Never output real personal data.

================================================================================
3. CONDITIONAL SKIP LOGIC & DEPENDENCIES
================================================================================
Implicitly respect survey skip logic:
- If a trigger question is negative (e.g., "fever_14d": "No"), leave dependent follow-up fields (e.g., "fever_treatment") as NULL or OMIT them entirely from that record.
- Do NOT generate answers for questions that would be skipped in a real survey workflow.

================================================================================
4. GENERATION MODES
================================================================================
Target Mode: "${activeMode}" (REALISTIC or UNIFORM)

- REALISTIC MODE:
  Strictly weigh the value frequencies for each field according to the provided empirical percentage distribution matrix.

- UNIFORM MODE:
  Ignore existing baseline frequencies and select uniformly with equal probability across all allowed choice keys defined in the schema.

================================================================================
5. RUNTIME INPUT DATA
================================================================================
- Target Form ID: "${formIdStr}"
- Total Rows to Generate: ${count}
- Schema Fields & Allowed Choices:
${fieldList}

- Empirical Distribution Matrix (Used only if REALISTIC mode):
${distributions}

================================================================================
6. OUTPUT FORMAT CONSTRAINTS
================================================================================
1. Output MUST be a valid JSON Array containing exactly ${count} submission objects.
2. Do NOT wrap your output in markdown code blocks (e.g. do NOT use \`\`\`json or \`\`\`). Return ONLY raw JSON text.
3. Ensure the JSON is completely closed and valid.

[EXAMPLE EXPECTED OUTPUT STRUCTURE]
[
  {
    "caregiver_edu": "Secondary",
    "household_size": "5",
    "fever_14d": "Yes",
    "malaria_diag": "RDT",
    "mosquito_methods": "coil indoor_spray",
    "smc_received": "Yes",
    "smc_cycles": "3"
  }
]`

  const user =
`Generate exactly ${count} ${activeMode}-mode records for form "${formIdStr}" following ALL rules above. ` +
`Return ONLY the raw JSON array — no markdown fences, no prose, no explanation.`

  return [
    { role: "system", content: system },
    { role: "user",   content: user },
  ]
}

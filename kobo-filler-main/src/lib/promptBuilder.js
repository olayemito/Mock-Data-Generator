export function buildPrompt(config, fields, batchSize, previous_distribution_summary) {
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

  // ── Build previous distribution summary block (state continuity) ──────────
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

  const system =
    `You are a synthetic survey-response generator producing realistic, internally consistent data for a field survey in ${config.country || "Nigeria"}.\n\n` +
    `OUTPUT CONTRACT:\n` +
    `- Return ONLY a raw JSON array of objects (first character '[', last character ']').\n` +
    `- No prose, no markdown, no code fences.\n` +
    `- Every object MUST include ALL ${fieldCount} fields with non-empty values.\n\n` +
    (contextBlock
      ? `STATE CONTINUITY — CRITICAL:\n${contextBlock}\n\n` +
        `You MUST preserve these categorical proportions in the new rows you generate (keep the same relative frequencies for each category, allowing only minor natural variance).\n` +
        `You MUST maintain skip-logic consistency: conditional/dependent fields must follow the same dependency patterns established above (e.g., if a "pregnant" field is only "yes" when gender is "female", keep that rule). Do not contradict the previously established value distributions.`
      : `This is the first batch — distribute values realistically across all allowed options and establish consistent skip-logic patterns.`)

  const user =
    `Generate exactly ${count} synthetic survey responses for a field survey in ${config.country || "Nigeria"}.\n\n` +
    `FIELDS (${fieldCount} total):\n${fieldList}\n\n` +
    `STRICT RULES:\n` +
    `- Fields marked "ALLOWED VALUES ONLY": use ONLY those exact values, nothing else\n` +
    `- text fields: realistic, culturally appropriate values for ${config.country || "Nigeria"}\n` +
    `- integer/decimal fields: realistic numeric values\n` +
    `- Distribution: ${config.distribution || "realistic"} — vary values naturally across all options\n` +
    `- Every row MUST include ALL ${fieldCount} fields — no missing fields\n` +
    `- Output ONLY a raw JSON array. No explanation, no markdown, no code fences\n` +
    `- First character must be [ and last character must be ]\n\n` +
    `Example format: [{"field1":"value1","field2":"value2"},{"field1":"value3","field2":"value4"}]`

  return [
    { role: "system", content: system },
    { role: "user",   content: user },
  ]
}

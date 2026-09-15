// Pure JS hash — no Node.js crypto dependency
function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit int
  }
  return hash.toString(36)
}

export function removeDuplicates(rows) {
  const seen = new Set()
  return rows.filter(r => {
    const hash = simpleHash(JSON.stringify(r))
    if (seen.has(hash)) return false
    seen.add(hash)
    return true
  })
}

import * as XLSX from "xlsx"

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement("a")
  a.href    = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportExcel(rows) {
  if (!rows?.length) return
  // Strip internal KoboFiller metadata columns before exporting
  const clean = rows.map(({ _rowId, _id, ...r }) => r)
  const ws    = XLSX.utils.json_to_sheet(clean)
  const wb    = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Data")
  const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" })
  triggerDownload(new Blob([wbout], { type: "application/octet-stream" }), "synthetic-data.xlsx")
}

export function exportCSV(rows) {
  if (!rows?.length) return
  // Strip internal KoboFiller metadata columns before exporting
  const clean   = rows.map(({ _rowId, _id, ...r }) => r)
  const columns = Object.keys(clean[0])

  const escape = (val) => {
    const str = String(val ?? "")
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const csvContent = [
    columns.map(escape).join(","),
    ...clean.map(row => columns.map(col => escape(row[col])).join(",")),
  ].join("\n")

  triggerDownload(
    new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" }),
    "synthetic-data.csv"
  )
}

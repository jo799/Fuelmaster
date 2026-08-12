/**
 * Converts an array of flat objects into a CSV file and triggers a browser
 * download. Used by every "Export" button across the platform so there's one
 * implementation to get right rather than 20 slightly different ones.
 */
export function exportToCsv<T extends object>(filename: string, rows: T[]) {
  if (rows.length === 0) {
    alert("There's no data to export yet.");
    return;
  }

  const headers = Object.keys(rows[0]) as (keyof T)[];
  const escape = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    // Quote any field containing a comma, quote, or newline; double up internal quotes.
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `${filename}-${stamp}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

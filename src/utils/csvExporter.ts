import { Response } from 'express';

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV(data: any[], headers: string[]): string {
  if (data.length === 0) {
    return headers.join(',') + '\n';
  }

  // Create CSV rows
  const rows = data.map(item => {
    return headers.map(header => {
      const value = getNestedValue(item, header);
      // Escape commas and quotes in values
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    });
  });

  // Combine headers and rows
  const csvLines = [headers.join(','), ...rows.map(row => row.join(','))];
  return csvLines.join('\n');
}

/**
 * Get nested value from object using dot notation (e.g., 'product.name')
 */
function getNestedValue(obj: any, path: string): any {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    if (value === null || value === undefined) {
      return null;
    }
    value = value[key];
  }
  return value;
}

/**
 * Send CSV file as response
 */
export function sendCSVResponse(res: Response, csvContent: string, filename: string): void {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}


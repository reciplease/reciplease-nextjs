const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => string }[] = [
  // DD/MM/YYYY or DD-MM-YYYY
  {
    re: /\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/,
    parse: (m) => `${m[3]}-${m[2]}-${m[1]}`,
  },
  // MM/YYYY or MM-YYYY
  {
    re: /\b(\d{2})[\/\-](\d{4})\b/,
    parse: (m) => `${m[2]}-${m[1]}-01`,
  },
  // DD MMM YYYY (e.g. 12 Jan 2026)
  {
    re: /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i,
    parse: (m) => {
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
    },
  },
  // MMM YYYY (e.g. Jan 2026)
  {
    re: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})\b/i,
    parse: (m) => {
      const months: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
      };
      return `${m[2]}-${months[m[1].toLowerCase()]}-01`;
    },
  },
  // YYYY-MM-DD
  {
    re: /\b(\d{4})-(\d{2})-(\d{2})\b/,
    parse: (m) => `${m[1]}-${m[2]}-${m[3]}`,
  },
];

export function parseDate(text: string): string | null {
  for (const { re, parse } of DATE_PATTERNS) {
    const m = text.match(re);
    if (m) {
      try {
        const iso = parse(m);
        if (!isNaN(Date.parse(iso))) return iso;
      } catch {
        // try next pattern
      }
    }
  }
  return null;
}

// CSV Parser for Recall Ingest
// Converts raw CSV text → IngestRecord[] with header normalization

import { parse } from 'csv-parse/sync';
import type { IngestRecord } from './ingestAgent';

// Map common CSV header variations to canonical field names
const HEADER_MAP: Record<string, keyof IngestRecord> = {
  // firstName
  'firstname': 'firstName',
  'first_name': 'firstName',
  'first name': 'firstName',
  'fname': 'firstName',
  // lastName
  'lastname': 'lastName',
  'last_name': 'lastName',
  'last name': 'lastName',
  'lname': 'lastName',
  // phone
  'phone': 'phone',
  'phone_number': 'phone',
  'phonenumber': 'phone',
  'phone number': 'phone',
  'mobile': 'phone',
  'cell': 'phone',
  // email
  'email': 'email',
  'email_address': 'email',
  'emailaddress': 'email',
  'email address': 'email',
  // lastVisitDate
  'lastvisitdate': 'lastVisitDate',
  'last_visit_date': 'lastVisitDate',
  'last visit date': 'lastVisitDate',
  'lastvisit': 'lastVisitDate',
  'last_visit': 'lastVisitDate',
  'last visit': 'lastVisitDate',
  // location
  'location': 'location',
  'office': 'location',
  'office_location': 'location',
  'office location': 'location',
  'preferred location': 'location',
  'preferred_location': 'location',
  'branch': 'location',
  'clinic': 'location',
  'site': 'location',
};

// Special column that contains "Last, First" combined name
const COMBINED_NAME_HEADERS = ['patient', 'patient name', 'patient_name', 'patientname', 'name'];

// Column that indicates patient already has a future appointment
const NEXT_APPT_HEADERS = ['next appointment date', 'next_appointment_date', 'next appointment', 'next_appt', 'next appt'];

export interface CsvParseResult {
  records: IngestRecord[];
  skipped: number;
  errors: string[];
}

export function parseRecallCsv(csvText: string): CsvParseResult {
  const result: CsvParseResult = { records: [], skipped: 0, errors: [] };

  // Strip BOM if present
  let cleaned = csvText.replace(/^\uFEFF/, '');

  // Auto-detect and skip PMS title/metadata rows before the real header.
  // Strategy: find the first line that contains known data headers (Phone, Patient, Email).
  const lines = cleaned.split('\n');
  let headerLineIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 20); i++) {
    const lower = lines[i].toLowerCase();
    if (lower.includes('phone') && (lower.includes('patient') || lower.includes('first'))) {
      headerLineIdx = i;
      break;
    }
  }
  if (headerLineIdx > 0) {
    cleaned = lines.slice(headerLineIdx).join('\n');
  }

  let rawRows: Record<string, string>[];
  try {
    rawRows = parse(cleaned, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`CSV parse error: ${msg}`);
    return result;
  }

  if (rawRows.length === 0) {
    result.errors.push('CSV contains no data rows');
    return result;
  }

  for (let i = 0; i < rawRows.length; i++) {
    const raw = rawRows[i];
    const mapped: Partial<IngestRecord> = {};
    let hasNextAppointment = false;

    for (const [csvHeader, value] of Object.entries(raw)) {
      const normalized = csvHeader.toLowerCase().trim();

      // Check for combined "Last, First" name column
      if (COMBINED_NAME_HEADERS.includes(normalized) && value) {
        const { first, last } = parseCombinedName(value);
        if (first) mapped.firstName = first;
        if (last) mapped.lastName = last;
        continue;
      }

      // Check for next appointment date (skip patients already scheduled)
      if (NEXT_APPT_HEADERS.includes(normalized) && value) {
        hasNextAppointment = true;
        continue;
      }

      const field = HEADER_MAP[normalized];
      if (field && value) {
        (mapped as Record<string, string>)[field] = value;
      }
    }

    // Skip patients with upcoming appointments — they don't need recall
    if (hasNextAppointment) {
      result.skipped++;
      continue;
    }

    // Validate required fields
    if (!mapped.firstName) {
      result.errors.push(`Row ${i + 2}: missing firstName`);
      result.skipped++;
      continue;
    }
    if (!mapped.phone) {
      result.errors.push(`Row ${i + 2}: missing phone`);
      result.skipped++;
      continue;
    }

    // Normalize lastVisitDate to ISO if parseable
    if (mapped.lastVisitDate) {
      const parsed = new Date(mapped.lastVisitDate);
      if (!isNaN(parsed.getTime())) {
        mapped.lastVisitDate = parsed.toISOString().split('T')[0];
      }
    }

    result.records.push({
      firstName: mapped.firstName,
      lastName: mapped.lastName,
      phone: mapped.phone,
      email: mapped.email,
      lastVisitDate: mapped.lastVisitDate,
      location: mapped.location,
    });
  }

  return result;
}

// Parse "Last, First Middle" or "Last, First ~" format into separate names
function parseCombinedName(raw: string): { first: string; last: string } {
  // Remove trailing ~ or other markers (PMS inactive flags)
  const clean = raw.replace(/\s*~\s*/g, ' ').trim();
  const commaIdx = clean.indexOf(',');
  if (commaIdx === -1) {
    return { first: clean, last: '' };
  }
  const last = clean.slice(0, commaIdx).trim();
  // First name may include middle initial: "Anthony M" → take just first word
  const firstPart = clean.slice(commaIdx + 1).trim();
  const first = firstPart.split(/\s+/)[0] || firstPart;
  return { first, last };
}

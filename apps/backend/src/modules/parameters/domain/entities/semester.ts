import { InvalidSemesterDataError } from '../errors/invalid-semester-data-error.js';

export interface SemesterProperties {
  readonly id: string;
  code: string;
  startDate: string;
  endDate: string;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const SEMESTER_CODE_PATTERN = /^\d{4}-(I|II)$/;
const DATE_FORMAT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(dateString: string): boolean {
  if (!DATE_FORMAT_PATTERN.test(dateString)) {
    return false;
  }

  const parts = dateString.split('-');
  const yearStr = parts[0];
  const monthStr = parts[1];
  const dayStr = parts[2];
  if (!yearStr || !monthStr || !dayStr) {
    return false;
  }

  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  if (month < 1 || month > 12) {
    return false;
  }

  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  const maxDays = daysInMonth[month - 1];
  if (maxDays === undefined) {
    return false;
  }

  return day >= 1 && day <= maxDays;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export class Semester {
  private constructor(private readonly props: SemesterProperties) {}

  public static create(rawProps: SemesterProperties): Semester {
    const code = Semester.validateAndNormalizeCode(rawProps.code);
    const { startDate, endDate } = Semester.validateDates(rawProps.startDate, rawProps.endDate);

    return new Semester({
      ...rawProps,
      code,
      startDate,
      endDate,
    });
  }

  public get id(): string {
    return this.props.id;
  }

  public get code(): string {
    return this.props.code;
  }

  public get startDate(): string {
    return this.props.startDate;
  }

  public get endDate(): string {
    return this.props.endDate;
  }

  public get createdBy(): string | null | undefined {
    return this.props.createdBy;
  }

  public get updatedBy(): string | null | undefined {
    return this.props.updatedBy;
  }

  public get createdAt(): Date {
    return this.props.createdAt;
  }

  public get updatedAt(): Date {
    return this.props.updatedAt;
  }

  private static validateAndNormalizeCode(rawCode: string): string {
    const trimmed = typeof rawCode === 'string' ? rawCode.trim() : '';

    if (!SEMESTER_CODE_PATTERN.test(trimmed)) {
      throw new InvalidSemesterDataError(
        'El código del semestre debe tener el formato AAAA-I o AAAA-II (por ejemplo, 2027-I)',
      );
    }

    return trimmed;
  }

  private static validateDates(
    rawStartDate: string,
    rawEndDate: string,
  ): { startDate: string; endDate: string } {
    const trimmedStart = typeof rawStartDate === 'string' ? rawStartDate.trim() : '';
    const trimmedEnd = typeof rawEndDate === 'string' ? rawEndDate.trim() : '';

    if (!isValidCalendarDate(trimmedStart)) {
      throw new InvalidSemesterDataError(
        'La fecha de inicio debe ser una fecha de calendario válida en formato AAAA-MM-DD.',
      );
    }

    if (!isValidCalendarDate(trimmedEnd)) {
      throw new InvalidSemesterDataError(
        'La fecha de fin debe ser una fecha de calendario válida en formato AAAA-MM-DD.',
      );
    }

    if (trimmedStart >= trimmedEnd) {
      throw new InvalidSemesterDataError('La fecha de inicio debe ser anterior a la fecha de fin.');
    }

    return { startDate: trimmedStart, endDate: trimmedEnd };
  }
}

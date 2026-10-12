/**
 * Hong Kong Fiscal Year Utilities
 * Hong Kong fiscal year: April 1 - March 31
 */

/**
 * Get the fiscal year for a given date
 * e.g., February 2024 -> FY2024 (Apr 2023 - Mar 2024)
 *       May 2024 -> FY2025 (Apr 2024 - Mar 2025)
 */
export function getFiscalYear(date: Date = new Date()): number {
    const month = date.getMonth(); // 0-11
    const year = date.getFullYear();

    // If April (3) or later, it's the next fiscal year
    // FY is named after the ending year
    return month >= 3 ? year + 1 : year;
}

/**
 * Get the fiscal year string (e.g., "FY2024")
 */
export function getFiscalYearString(date: Date = new Date()): string {
    return `FY${getFiscalYear(date)}`;
}

/**
 * Get the start and end dates of a fiscal year
 */
export function getFiscalYearRange(fy: number): { start: Date; end: Date } {
    return {
        start: new Date(fy - 1, 3, 1), // April 1 of previous calendar year
        end: new Date(fy, 2, 31, 23, 59, 59, 999) // March 31 of FY year
    };
}

/**
 * Get all fiscal years from a start year to current (or specified end)
 */
export function getFiscalYearOptions(startYear: number = 2020, endYear?: number): number[] {
    const end = endYear ?? getFiscalYear(new Date());
    const years: number[] = [];
    for (let year = startYear; year <= end; year++) {
        years.push(year);
    }
    return years;
}

/**
 * Check if a date is within a fiscal year
 */
export function isInFiscalYear(date: Date, fy: number): boolean {
    const { start, end } = getFiscalYearRange(fy);
    return date >= start && date <= end;
}

/**
 * Get the quarter for a date (Q1 = Apr-Jun, Q2 = Jul-Sep, Q3 = Oct-Dec, Q4 = Jan-Mar)
 */
export function getFiscalQuarter(date: Date = new Date()): number {
    const month = date.getMonth(); // 0-11

    // Hong Kong FY quarters
    if (month >= 3 && month <= 5) return 1; // Apr, May, Jun
    if (month >= 6 && month <= 8) return 2; // Jul, Aug, Sep
    if (month >= 9 && month <= 11) return 3; // Oct, Nov, Dec
    return 4; // Jan, Feb, Mar
}

/**
 * Get quarter date range (Hong Kong FY: Apr-Mar)
 */
export function getQuarterRange(
    fy: number,
    quarter: number
): { start: Date; end: Date } {
    switch (quarter) {
        case 1: // Q1: Apr-Jun
            return {
                start: new Date(fy - 1, 3, 1), // April 1
                end: new Date(fy - 1, 5, 30, 23, 59, 59, 999) // Jun 30
            };
        case 2: // Q2: Jul-Sep
            return {
                start: new Date(fy - 1, 6, 1), // July 1
                end: new Date(fy - 1, 8, 30, 23, 59, 59, 999) // Sep 30
            };
        case 3: // Q3: Oct-Dec
            return {
                start: new Date(fy - 1, 9, 1), // Oct 1
                end: new Date(fy - 1, 11, 31, 23, 59, 59, 999) // Dec 31
            };
        case 4: // Q4: Jan-Mar
            return {
                start: new Date(fy, 0, 1), // Jan 1
                end: new Date(fy, 2, 31, 23, 59, 59, 999) // Mar 31
            };
        default:
            throw new Error(`Invalid quarter: ${quarter}`);
    }
}

/**
 * Format fiscal year for display (Hong Kong FY: Apr-Mar)
 */
export function formatFiscalYear(fy: number): string {
    return `FY${fy} (Apr ${fy - 1} - Mar ${fy})`;
}

/**
 * Format quarter for display (Hong Kong FY quarters)
 */
export function formatQuarter(fy: number, quarter: number): string {
    const quarterNames = ['Q1 (Apr-Jun)', 'Q2 (Jul-Sep)', 'Q3 (Oct-Dec)', 'Q4 (Jan-Mar)'];
    return `FY${fy} ${quarterNames[quarter - 1]}`;
}

/**
 * Get month name in fiscal year context (Hong Kong FY: Apr = month 1)
 */
export function getFiscalMonth(date: Date): { month: string; fyMonth: number } {
    const months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December'
    ];
    const month = date.getMonth();
    // HK FY month: April = 1, May = 2, ..., March = 12
    const fyMonth = month >= 3 ? month - 2 : month + 10;
    return { month: months[month], fyMonth };
}

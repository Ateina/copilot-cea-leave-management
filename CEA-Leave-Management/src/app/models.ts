export interface VacationRequestFilter {
    userEmail?: string;
}

export interface VacationSummary {
      status: string;
      type: string;
      startDate: string;
      endDate: string;
  }
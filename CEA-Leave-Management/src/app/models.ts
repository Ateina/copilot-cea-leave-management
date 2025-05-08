export interface LeaveRequestFilter {
    userEmail?: string;
    status?: string;
  type?: string;
}

export interface VacationSummary {
      status: string;
      type: string;
      startDate: string;
      endDate: string;
  }
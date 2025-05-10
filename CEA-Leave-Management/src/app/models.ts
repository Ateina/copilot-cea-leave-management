export interface LeaveRequestFilter {
    userEmail?: string;
    status?: string;
    type?: string;
}

export interface LeaveRequest {
    userEmail?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
}

export interface LeaveRequestUpdate {
    requestId?: string;
    status?: string;
}

export interface VacationSummary {
      status: string;
      type: string;
      startDate: string;
      endDate: string;
  }
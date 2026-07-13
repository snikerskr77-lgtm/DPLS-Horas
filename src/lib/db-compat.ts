export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export function isMissingBreakTimesColumnError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes('break_times') ||
    message.includes('breaks_data') ||
    message.includes('column') && message.includes('does not exist') && message.includes('break')
  );
}

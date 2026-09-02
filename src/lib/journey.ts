export type JourneyMode = 'teacher' | 'student';

const KEYS: Record<JourneyMode, string> = {
  teacher: 'lectern.journey.collapsed.teacher.v1',
  student: 'lectern.journey.collapsed.student.v1',
};

export function isJourneyCollapsed(mode: JourneyMode): boolean {
  try {
    return localStorage.getItem(KEYS[mode]) === '1';
  } catch {
    return false;
  }
}

export function setJourneyCollapsed(mode: JourneyMode, collapsed: boolean): void {
  try {
    if (collapsed) localStorage.setItem(KEYS[mode], '1');
    else localStorage.removeItem(KEYS[mode]);
  } catch {
    // ignore quota / private mode
  }
}

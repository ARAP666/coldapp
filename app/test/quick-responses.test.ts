import { QUICK_RESPONSES, CHAT_QUICK_RESPONSES } from '../src/assets/quickResponses';

describe('quickResponses', () => {
  it('has 14 alerts total', () => {
    expect(QUICK_RESPONSES).toHaveLength(14);
  });

  it('includes the ABORTAR alert with confirm=true', () => {
    const abort = QUICK_RESPONSES.find((q) => q.label === 'ABORTAR');
    expect(abort).toBeDefined();
    expect(abort!.confirm).toBe(true);
  });

  it('every alert has the required fields', () => {
    for (const q of QUICK_RESPONSES) {
      expect(typeof q.label).toBe('string');
      expect(q.label.length).toBeGreaterThan(0);
      expect(typeof q.icon).toBe('string');
      expect(q.icon.length).toBeGreaterThan(0);
      expect(typeof q.type).toBe('string');
    }
  });

  it('CHAT_QUICK_RESPONSES is a subset of QUICK_RESPONSES', () => {
    for (const chat of CHAT_QUICK_RESPONSES) {
      expect(QUICK_RESPONSES).toContainEqual(chat);
    }
  });
});

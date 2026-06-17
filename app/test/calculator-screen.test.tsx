// Unit tests for the calculator unlock flow.
//
// The "secret" is that any expression evaluating to 666 triggers onUnlock.
// We test the screen by simulating button presses and asserting that
// onUnlock is (or is not) called.

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CalculatorScreen } from '../src/screens/CalculatorScreen';

// Helper: the calculator renders the same digit both as a button and in the
// display (after the first press). We want to press the button, not the
// display, so we grab the LAST match — the button is rendered after the
// display in the JSX, and there's only one button per digit.
function pressDigit(
  getAllByText: (text: string) => Array<{ props: Record<string, unknown> }>,
  digit: string
) {
  const matches = getAllByText(digit);
  fireEvent.press(matches[matches.length - 1]);
}

describe('CalculatorScreen', () => {
  it('renders without crashing', () => {
    const onUnlock = jest.fn();
    render(<CalculatorScreen onUnlock={onUnlock} />);
  });

  it('does NOT unlock for 333 + 2 (= 335)', () => {
    jest.useFakeTimers();
    const onUnlock = jest.fn();
    const { getAllByText, getByText } = render(<CalculatorScreen onUnlock={onUnlock} />);

    pressDigit(getAllByText, '3');
    pressDigit(getAllByText, '3');
    pressDigit(getAllByText, '3');
    fireEvent.press(getByText('+'));
    pressDigit(getAllByText, '2');
    fireEvent.press(getByText('='));

    jest.advanceTimersByTime(500);
    expect(onUnlock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does NOT unlock for 100 + 1 (= 101)', () => {
    jest.useFakeTimers();
    const onUnlock = jest.fn();
    const { getAllByText, getByText } = render(<CalculatorScreen onUnlock={onUnlock} />);

    pressDigit(getAllByText, '1');
    pressDigit(getAllByText, '0');
    pressDigit(getAllByText, '0');
    fireEvent.press(getByText('+'));
    pressDigit(getAllByText, '1');
    fireEvent.press(getByText('='));

    jest.advanceTimersByTime(500);
    expect(onUnlock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('unlocks for 333 × 2 (= 666)', () => {
    jest.useFakeTimers();
    const onUnlock = jest.fn();
    const { getAllByText, getByText } = render(<CalculatorScreen onUnlock={onUnlock} />);

    pressDigit(getAllByText, '3');
    pressDigit(getAllByText, '3');
    pressDigit(getAllByText, '3');
    fireEvent.press(getByText('×'));
    pressDigit(getAllByText, '2');
    fireEvent.press(getByText('='));

    jest.advanceTimersByTime(500);
    expect(onUnlock).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('unlocks for 666 + 0 (= 666)', () => {
    jest.useFakeTimers();
    const onUnlock = jest.fn();
    const { getAllByText, getByText } = render(<CalculatorScreen onUnlock={onUnlock} />);

    pressDigit(getAllByText, '6');
    pressDigit(getAllByText, '6');
    pressDigit(getAllByText, '6');
    fireEvent.press(getByText('+'));
    pressDigit(getAllByText, '0');
    fireEvent.press(getByText('='));

    jest.advanceTimersByTime(500);
    expect(onUnlock).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('AC resets the display and does not unlock', () => {
    jest.useFakeTimers();
    const onUnlock = jest.fn();
    const { getAllByText, getByText } = render(<CalculatorScreen onUnlock={onUnlock} />);

    pressDigit(getAllByText, '3');
    pressDigit(getAllByText, '3');
    pressDigit(getAllByText, '3');
    fireEvent.press(getByText('AC'));

    fireEvent.press(getByText('='));
    jest.advanceTimersByTime(500);
    expect(onUnlock).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

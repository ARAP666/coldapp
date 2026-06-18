// Tests for QuickButton. The interesting behavior is the 3-press confirm
// for the ABORTAR alert.

import React from 'react';
import { act, render, fireEvent } from '@testing-library/react-native';
import { QuickButton } from '../src/components/QuickButton';
import type { QuickResponse } from '../src/types';

const ALERT: QuickResponse = {
  label: 'ALERTA',
  icon: '🚨',
  type: 'alert',
};

const ABORT: QuickResponse = {
  label: 'ABORTAR',
  icon: '⛔',
  type: 'abort',
  confirm: true,
};

describe('QuickButton', () => {
  it('fires onSend on the first press when confirm is not required', () => {
    jest.useFakeTimers();
    const onSend = jest.fn();
    const { getByText } = render(<QuickButton item={ALERT} onSend={onSend} />);
    fireEvent.press(getByText(/ALERTA/i));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(ALERT);
    jest.useRealTimers();
  });

  it('requires 3 presses to fire onSend when confirm=true', () => {
    jest.useFakeTimers();
    const onSend = jest.fn();
    const { getByText } = render(<QuickButton item={ABORT} onSend={onSend} />);
    fireEvent.press(getByText(/ABORTAR/i));
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.press(getByText(/ABORTAR/i));
    expect(onSend).not.toHaveBeenCalled();
    fireEvent.press(getByText(/ABORTAR/i));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(ABORT);
    jest.useRealTimers();
  });

  it('resets the confirm counter after the timeout elapses', () => {
    jest.useFakeTimers();
    const onSend = jest.fn();
    const { getByText } = render(<QuickButton item={ABORT} onSend={onSend} />);
    fireEvent.press(getByText(/ABORTAR/i));
    fireEvent.press(getByText(/ABORTAR/i));
    // Now let the 3000ms timeout elapse.
    act(() => {
      jest.advanceTimersByTime(3500);
    });
    // Two more presses should not trigger; we need three again.
    fireEvent.press(getByText(/ABORTAR/i));
    expect(onSend).not.toHaveBeenCalled();
    jest.useRealTimers();
  });
});

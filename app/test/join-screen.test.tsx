import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { JoinScreen } from '../src/screens/JoinScreen';

describe('JoinScreen', () => {
  const baseProps = {
    connectionError: null,
    onRetry: jest.fn(),
  };

  it('shows a loading state when codename is null', () => {
    const onJoin = jest.fn();
    const onAbort = jest.fn();
    const { getByTestId, getAllByTestId, getByText } = render(
      <JoinScreen {...baseProps} codename={null} connected={false} onJoin={onJoin} onAbort={onAbort} />
    );
    expect(getByTestId('codename-loading')).toBeTruthy();
    expect(getByText('PREPARANDO SESIÓN')).toBeTruthy();
    expect(getAllByTestId('calculator-mark')).toHaveLength(2);
    expect(getByText('ESPERANDO…')).toBeTruthy();
  });

  it('displays the assigned codename once the server replies', () => {
    const onJoin = jest.fn();
    const onAbort = jest.fn();
    const { getByTestId, getByText } = render(
      <JoinScreen {...baseProps} codename="BRAVO-07" connected onJoin={onJoin} onAbort={onAbort} />
    );
    expect(getByTestId('assigned-codename').props.children).toBe('BRAVO-07');
    expect(getByText('ENTRAR A LA RED')).toBeTruthy();
  });

  it('disables the enter button when not ready (no codename or not connected)', () => {
    const onJoin = jest.fn();
    const onAbort = jest.fn();
    const { getByTestId } = render(
      <JoinScreen {...baseProps} codename="BRAVO-07" connected={false} onJoin={onJoin} onAbort={onAbort} />
    );
    const btn = getByTestId('enter-button');
    expect(btn.props.accessibilityState?.disabled || btn.props.disabled).toBe(true);
  });

  it('calls onJoin when the user presses enter (codename + connected)', () => {
    const onJoin = jest.fn();
    const onAbort = jest.fn();
    const { getByText } = render(
      <JoinScreen {...baseProps} codename="BRAVO-07" connected onJoin={onJoin} onAbort={onAbort} />
    );
    fireEvent.press(getByText('ENTRAR A LA RED'));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('calls onAbort when the user taps "volver a la calculadora"', () => {
    const onJoin = jest.fn();
    const onAbort = jest.fn();
    const { getByText } = render(
      <JoinScreen {...baseProps} codename="BRAVO-07" connected onJoin={onJoin} onAbort={onAbort} />
    );
    fireEvent.press(getByText(/volver a la calculadora/i));
    expect(onAbort).toHaveBeenCalledTimes(1);
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('shows a retry action when Railway is unavailable', () => {
    const onRetry = jest.fn();
    const { getByTestId, getByText } = render(
      <JoinScreen
        codename={null}
        connected={false}
        connectionError="xhr poll error"
        onRetry={onRetry}
        onJoin={jest.fn()}
        onAbort={jest.fn()}
      />
    );
    expect(getByTestId('connection-error')).toBeTruthy();
    fireEvent.press(getByText('REINTENTAR'));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

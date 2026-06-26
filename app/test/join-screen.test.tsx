import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { JoinScreen } from '../src/screens/JoinScreen';

describe('JoinScreen', () => {
  const baseProps = {
    connected: false,
    connectionError: null,
    roomCode: null,
    pendingAnswerCode: null,
    onCreateRoom: jest.fn(),
    onJoinRoomCode: jest.fn(),
    onAcceptAnswerCode: jest.fn(),
    onShareRoomCode: jest.fn(),
    onShareAnswerCode: jest.fn(),
    onRetry: jest.fn(),
    onJoin: jest.fn(),
    onAbort: jest.fn(),
  };

  it('shows the serverless empty state', () => {
    const { getByTestId, getAllByTestId, getByText } = render(
      <JoinScreen {...baseProps} codename={null} />
    );
    expect(getByTestId('codename-loading')).toBeTruthy();
    expect(getByText('SIN SESION')).toBeTruthy();
    expect(getAllByTestId('calculator-mark')).toHaveLength(2);
    expect(getByText('CREA O PEGA UN CODIGO')).toBeTruthy();
  });

  it('creates a room', () => {
    const onCreateRoom = jest.fn();
    const { getByText } = render(
      <JoinScreen {...baseProps} codename={null} onCreateRoom={onCreateRoom} />
    );
    fireEvent.press(getByText('CREAR SALA'));
    expect(onCreateRoom).toHaveBeenCalledTimes(1);
  });

  it('uses a pasted invitation', () => {
    const onJoinRoomCode = jest.fn();
    const { getByTestId, getByText } = render(
      <JoinScreen {...baseProps} codename={null} onJoinRoomCode={onJoinRoomCode} />
    );
    fireEvent.changeText(getByTestId('room-code-input'), 'FRIA:abc');
    fireEvent.press(getByText('USAR INVITACION'));
    expect(onJoinRoomCode).toHaveBeenCalledWith('FRIA:abc');
  });

  it('enables enter once a local codename exists', () => {
    const onJoin = jest.fn();
    const { getByTestId, getByText } = render(
      <JoinScreen {...baseProps} codename="FRIA-1234" connected onJoin={onJoin} />
    );
    expect(getByTestId('assigned-codename').props.children).toBe('FRIA-1234');
    fireEvent.press(getByText('ENTRAR A LA RED'));
    expect(onJoin).toHaveBeenCalledTimes(1);
  });

  it('shows share controls for invite and answer codes', () => {
    const onShareRoomCode = jest.fn();
    const onShareAnswerCode = jest.fn();
    const { getByText } = render(
      <JoinScreen
        {...baseProps}
        codename="FRIA-1234"
        roomCode="FRIA:invite"
        pendingAnswerCode="FRIA:answer"
        onShareRoomCode={onShareRoomCode}
        onShareAnswerCode={onShareAnswerCode}
      />
    );
    fireEvent.press(getByText('COMPARTIR CODIGO'));
    fireEvent.press(getByText('ENVIAR RESPUESTA'));
    expect(onShareRoomCode).toHaveBeenCalledTimes(1);
    expect(onShareAnswerCode).toHaveBeenCalledTimes(1);
  });

  it('calls onAbort when the user taps back', () => {
    const onAbort = jest.fn();
    const { getByText } = render(
      <JoinScreen {...baseProps} codename="FRIA-1234" onAbort={onAbort} />
    );
    fireEvent.press(getByText(/volver a la calculadora/i));
    expect(onAbort).toHaveBeenCalledTimes(1);
  });
});

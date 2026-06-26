import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CalculatorScreen } from './src/screens/CalculatorScreen';
import { FriaScreen } from './src/screens/FriaScreen';
import { JoinScreen } from './src/screens/JoinScreen';
import { useWebRtcRoom } from './src/hooks/useWebRtcRoom';
import { notifyIncomingCalculatorUpdate } from './src/notifications';
import { Message } from './src/types';
import { isCleanupDone, showCleanupHint } from './src/cleanup';
import { ErrorBoundary } from './src/ErrorBoundary';

type AppState = 'calculator' | 'join' | 'fria';

export default function App() {
  const [state, setState] = useState<AppState>('calculator');

  // Mount-time setup.
  useEffect(() => {
    hideSystemBars();
  }, []);

  const handleIncomingMessage = useCallback((msg: Message) => {
    void notifyIncomingCalculatorUpdate(msg);
  }, []);

  const {
    connected,
    connectionError,
    codename,
    members,
    messages,
    peerLocations,
    kickedReason,
    roomCode,
    pendingAnswerCode,
    createRoom,
    joinRoomCode,
    acceptAnswerCode,
    shareRoomCode,
    shareAnswerCode,
    sendMessage,
    sendQuickAlert,
    sendLocation,
    leaveRoom,
    purgeRoom,
    retryConnection,
  } = useWebRtcRoom(handleIncomingMessage);

  const handleUnlock = useCallback(() => {
    setState('join');
  }, []);

  const handleJoin = useCallback(() => {
    setState('fria');
  }, []);

  const handleExit = useCallback(() => {
    leaveRoom(() => {
      setState('calculator');
    });
  }, [leaveRoom]);

  const handleDefinitiveExit = useCallback(() => {
    purgeRoom();
  }, [purgeRoom]);

  // Once the server hands us a codename (i.e. we're in the join screen
  // with a real identity), and we haven't yet prompted for install-artifact
  // cleanup, show the native alert. We only do this on the join screen so
  // it never interrupts someone who's already deep in the chat.
  useEffect(() => {
    if (state !== 'join' || !codename) return;
    let cancelled = false;
    isCleanupDone().then((done) => {
      if (cancelled || done) return;
      showCleanupHint();
    });
    return () => {
      cancelled = true;
    };
  }, [state, codename]);

  // If the server kicks us (inactivity timeout, etc.) bounce back to the
  // calculator with the socket torn down.
  useEffect(() => {
    if (!kickedReason) return;
    setState('calculator');
  }, [kickedReason]);

  return (
    <ErrorBoundary>
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0a0a0b" translucent={false} />

      {state === 'calculator' && (
        <CalculatorScreen onUnlock={handleUnlock} />
      )}

      {state === 'join' && (
        <JoinScreen
          codename={codename}
          connected={connected}
          connectionError={connectionError}
          roomCode={roomCode}
          pendingAnswerCode={pendingAnswerCode}
          onCreateRoom={createRoom}
          onJoinRoomCode={joinRoomCode}
          onAcceptAnswerCode={acceptAnswerCode}
          onShareRoomCode={shareRoomCode}
          onShareAnswerCode={shareAnswerCode}
          onRetry={retryConnection}
          onJoin={handleJoin}
          onAbort={handleExit}
        />
      )}

      {state === 'fria' && codename && (
        <FriaScreen
          alias={codename}
          members={members}
          messages={messages}
          peerLocations={peerLocations}
          connected={connected}
          sendMessage={sendMessage}
          sendQuickAlert={sendQuickAlert}
          sendLocation={sendLocation}
          onExit={handleExit}
          onDefinitiveExit={handleDefinitiveExit}
        />
      )}
    </SafeAreaProvider>
    </ErrorBoundary>
  );
}

// Immersive: hide the Android navigation bar and tell iOS to use dark
// content. Best-effort; on web or unsupported platforms this is a no-op.
function hideSystemBars() {
  if (Platform.OS !== 'android') return;
  try {
    // expo-navigation-bar v1.x API: setVisibilityAsync + setBehaviorAsync.
    // v2.x added setHidden but is SDK 52+.
    NavigationBar.setVisibilityAsync('hidden').catch(() => {});
  } catch {
    // ignore
  }
}

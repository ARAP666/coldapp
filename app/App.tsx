import React, { useState, useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import * as NavigationBar from 'expo-navigation-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CalculatorScreen } from './src/screens/CalculatorScreen';
import { FriaScreen } from './src/screens/FriaScreen';
import { JoinScreen } from './src/screens/JoinScreen';
import { useSocket } from './src/hooks/useSocket';
import { configureForegroundPush } from './src/push';
import { isCleanupDone, showCleanupHint } from './src/cleanup';

const ROOM_ID = 'fria-001';

type AppState = 'calculator' | 'join' | 'fria';

export default function App() {
  const [state, setState] = useState<AppState>('calculator');
  const [socketEnabled, setSocketEnabled] = useState(false);

  // Mount-time setup.
  useEffect(() => {
    configureForegroundPush();
    hideSystemBars();
  }, []);

  const handleIncomingMessage = useCallback(() => {
    // The hook already calls notifyIncoming(); this is a hook for future
    // analytics or sound playing if needed.
  }, []);

  const {
    connected,
    codename,
    members,
    messages,
    peerLocations,
    kickedReason,
    sendMessage,
    sendQuickAlert,
    sendLocation,
    clearMessages,
    leaveRoom,
  } = useSocket({ roomId: ROOM_ID, enabled: socketEnabled, onIncomingMessage: handleIncomingMessage });

  const handleUnlock = useCallback(() => {
    setSocketEnabled(true);
    setState('join');
  }, []);

  const handleJoin = useCallback(() => {
    setState('fria');
  }, []);

  const handleExit = useCallback(() => {
    setSocketEnabled(false);
    setState('calculator');
  }, []);

  const handleDefinitiveExit = useCallback(() => {
    leaveRoom();
    setSocketEnabled(false);
    setState('calculator');
  }, [leaveRoom]);

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
    setSocketEnabled(false);
    setState('calculator');
  }, [kickedReason]);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor="#0a0a0b" translucent={false} />

      {state === 'calculator' && (
        <CalculatorScreen onUnlock={handleUnlock} />
      )}

      {state === 'join' && (
        <JoinScreen
          codename={codename}
          connected={connected}
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
          clearMessages={clearMessages}
          onExit={handleExit}
          onDefinitiveExit={handleDefinitiveExit}
        />
      )}
    </SafeAreaProvider>
  );
}

// Immersive: hide the Android navigation bar and tell iOS to use dark
// content. Best-effort; on web or unsupported platforms this is a no-op.
function hideSystemBars() {
  if (Platform.OS !== 'android') return;
  try {
    // NavigationBar.setHidden is the modern synchronous API.
    (NavigationBar as unknown as { setHidden: (v: boolean) => void }).setHidden(
      true
    );
  } catch {
    // ignore
  }
}

import { useEffect, useRef, useCallback, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { Platform, Vibration } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Message, Member, PeerLocation } from '../types';
import { getExpoPushTokenAsync } from '../push';
import { clearLocalFriaData } from '../localData';

const SERVER_URL = process.env.EXPO_PUBLIC_SERVER_URL || 'https://your-railway-app.railway.app';

interface UseSocketOptions {
  roomId: string;
  enabled: boolean;
  onIncomingMessage?: (msg: Message) => void;
}

interface UseSocketReturn {
  connected: boolean;
  connectionError: string | null;
  codename: string | null;
  members: Member[];
  messages: Message[];
  peerLocations: Map<string, PeerLocation>;
  kickedReason: string | null;
  sendMessage: (text: string, type?: string, color?: string | null) => void;
  sendQuickAlert: (label: string, icon: string, alertType: string, color: string) => void;
  sendLocation: (lat: number, lng: number) => void;
  leaveRoom: (onDone: () => void) => void;
  purgeRoom: () => void;
  retryConnection: () => void;
}

// Lightweight haptic + vibration burst used when a message arrives while
// the user is in the app. Foreground: we want a clear "you got mail"
// pulse but no system notification banner (the user is already looking
// at the chat).
function notifyIncoming() {
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
  } catch {
    // ignore
  }
  if (Platform.OS === 'android') {
    try {
      Vibration.vibrate(60);
    } catch {
      // ignore
    }
  }
}

export function useSocket({ roomId, enabled, onIncomingMessage }: UseSocketOptions): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [codename, setCodename] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerLocations, setPeerLocations] = useState<Map<string, PeerLocation>>(new Map());
  const [kickedReason, setKickedReason] = useState<string | null>(null);

  // Latest onIncomingMessage in a ref so the connect effect doesn't
  // re-fire every time the parent passes a new callback identity.
  const cbRef = useRef(onIncomingMessage);
  useEffect(() => {
    cbRef.current = onIncomingMessage;
  }, [onIncomingMessage]);

  useEffect(() => {
    if (!enabled || !roomId) return;

    const socket = io(SERVER_URL, {
      transports: ['polling', 'websocket'],
      timeout: 10000,
      reconnectionAttempts: 5,
      reconnectionDelay: 1500,
    });

    socketRef.current = socket;

    socket.on('connect', async () => {
      setConnected(true);
      setConnectionError(null);
      let pushToken: string | null = null;
      try {
        pushToken = await getExpoPushTokenAsync();
      } catch {
        // best-effort
      }
      socket.emit('join_room', { roomId, pushToken });
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      setConnected(false);
      setConnectionError(error.message || 'No se pudo conectar con el servidor');
    });

    socket.on('joined', (payload: { alias: string; roomId: string }) => {
      setCodename(payload.alias);
    });

    socket.on('history', (msgs: Message[]) => {
      setMessages(msgs);
    });

    socket.on('message', (msg: Message) => {
      setMessages((prev) => [...prev.slice(-199), msg]);
      notifyIncoming();
      cbRef.current?.(msg);
    });

    socket.on('members_update', (memberList: Member[]) => {
      setMembers(memberList);
    });

    socket.on('peer_location', (loc: PeerLocation) => {
      setPeerLocations((prev) => {
        const next = new Map(prev);
        next.set(loc.alias, loc);
        return next;
      });
    });

    socket.on('kicked', (payload: { reason: string }) => {
      setKickedReason(payload?.reason ?? 'unknown');
    });

    socket.on('room_purged', () => {
      setMessages([]);
      setMembers([]);
      setPeerLocations(new Map());
      setCodename(null);
      setKickedReason('room_purged');
      void clearLocalFriaData();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setConnectionError(null);
      setCodename(null);
      setKickedReason(null);
    };
  }, [enabled, roomId]);

  const sendMessage = useCallback(
    (text: string, type = 'text', color: string | null = null) => {
      socketRef.current?.emit('message', { text, type, color });
    },
    []
  );

  const sendQuickAlert = useCallback(
    (label: string, icon: string, alertType: string, color: string) => {
      socketRef.current?.emit('quick_alert', { label, icon, alertType, color });
    },
    []
  );

  const sendLocation = useCallback((lat: number, lng: number) => {
    socketRef.current?.emit('location_update', { lat, lng });
  }, []);

  const purgeRoom = useCallback(() => {
    socketRef.current?.emit('purge_room');
  }, []);

  const leaveRoom = useCallback((onDone: () => void) => {
    const socket = socketRef.current;
    if (!socket?.connected) {
      onDone();
      return;
    }
    socket.timeout(3000).emit('leave_room', () => onDone());
  }, []);

  const retryConnection = useCallback(() => {
    setConnectionError(null);
    socketRef.current?.connect();
  }, []);

  return {
    connected,
    connectionError,
    codename,
    members,
    messages,
    peerLocations,
    kickedReason,
    sendMessage,
    sendQuickAlert,
    sendLocation,
    leaveRoom,
    purgeRoom,
    retryConnection,
  };
}

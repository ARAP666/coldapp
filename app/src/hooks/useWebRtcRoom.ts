import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Share } from 'react-native';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import type RTCDataChannel from 'react-native-webrtc/lib/typescript/RTCDataChannel';
import { clearLocalFriaData } from '../localData';
import { Message, Member, PeerLocation } from '../types';

type SignalKind = 'offer' | 'answer';

interface SessionDescriptionWire {
  type: string;
  sdp: string;
}

interface SignalPayload {
  v: 1;
  kind: SignalKind;
  roomId: string;
  alias: string;
  to?: string;
  description: SessionDescriptionWire;
  candidates: Record<string, unknown>[];
}

type WirePayload =
  | { kind: 'hello'; alias: string }
  | { kind: 'bye'; alias: string }
  | { kind: 'message'; message: Message }
  | { kind: 'location'; location: PeerLocation }
  | { kind: 'purge' };

interface Peer {
  id: string;
  alias: string;
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
}

type PeerConnectionWithHandlers = RTCPeerConnection & {
  ondatachannel?: (event: { channel: RTCDataChannel }) => void;
  onconnectionstatechange?: () => void;
  onicegatheringstatechange?: () => void;
};

type DataChannelWithHandlers = RTCDataChannel & {
  onopen?: () => void;
  onclose?: () => void;
  onmessage?: (event: { data: unknown }) => void;
};

interface UseWebRtcRoomReturn {
  connected: boolean;
  connectionError: string | null;
  codename: string | null;
  roomCode: string | null;
  pendingAnswerCode: string | null;
  members: Member[];
  messages: Message[];
  peerLocations: Map<string, PeerLocation>;
  kickedReason: string | null;
  createRoom: () => Promise<void>;
  joinRoomCode: (code: string) => Promise<void>;
  acceptAnswerCode: (code: string) => Promise<void>;
  shareRoomCode: () => Promise<void>;
  shareAnswerCode: () => Promise<void>;
  sendMessage: (text: string, type?: string, color?: string | null) => void;
  sendQuickAlert: (label: string, icon: string, alertType: string, color: string) => void;
  sendLocation: (lat: number, lng: number) => void;
  leaveRoom: (onDone: () => void) => void;
  purgeRoom: () => void;
  retryConnection: () => void;
}

const ROOM_PREFIX = 'FRIA:';
const LINK_PREFIX = 'fria://room?code=';

function randomCode(size = 6) {
  return Math.random().toString(36).slice(2, 2 + size).toUpperCase();
}

function makeAlias() {
  return `FRIA-${randomCode(4)}`;
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function encodeSignal(payload: SignalPayload) {
  return `${ROOM_PREFIX}${Buffer.from(JSON.stringify(payload), 'utf8').toString('base64')}`;
}

function decodeSignal(input: string): SignalPayload {
  const trimmed = input.trim();
  const code = trimmed.startsWith(LINK_PREFIX)
    ? decodeURIComponent(trimmed.slice(LINK_PREFIX.length))
    : trimmed;
  const raw = code.startsWith(ROOM_PREFIX) ? code.slice(ROOM_PREFIX.length) : code;
  const payload = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as SignalPayload;
  if (payload.v !== 1 || !payload.kind || !payload.roomId || !payload.alias) {
    throw new Error('Código FRÍA inválido');
  }
  if (!payload.description?.type || !payload.description?.sdp) {
    throw new Error('Código FRÍA incompleto');
  }
  return payload;
}

async function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    const rtc = pc as PeerConnectionWithHandlers;
    const done = () => {
      rtc.onicegatheringstatechange = undefined;
      resolve();
    };
    rtc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') done();
    };
    setTimeout(done, 1500);
  });
}

export function useWebRtcRoom(onIncomingMessage?: (msg: Message) => void): UseWebRtcRoomReturn {
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [codename, setCodename] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [pendingAnswerCode, setPendingAnswerCode] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [peerLocations, setPeerLocations] = useState<Map<string, PeerLocation>>(new Map());
  const [kickedReason, setKickedReason] = useState<string | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const aliasRef = useRef<string | null>(null);
  const peersRef = useRef<Map<string, Peer>>(new Map());
  const seenFramesRef = useRef<Set<string>>(new Set());
  const cbRef = useRef(onIncomingMessage);

  useEffect(() => {
    cbRef.current = onIncomingMessage;
  }, [onIncomingMessage]);

  const refreshMembers = useCallback(() => {
    const own = aliasRef.current
      ? [{ socketId: 'local', alias: aliasRef.current, joinedAt: Date.now(), lastSeen: Date.now() }]
      : [];
    const remote = Array.from(peersRef.current.values()).map((p) => ({
      socketId: p.id,
      alias: p.alias,
      joinedAt: Date.now(),
      lastSeen: Date.now(),
    }));
    setMembers([...own, ...remote]);
    setConnected(remote.some((p) => peersRef.current.get(p.socketId)?.channel?.readyState === 'open'));
  }, []);

  const closePeer = useCallback(
    (id: string) => {
      const peer = peersRef.current.get(id);
      if (!peer) return;
      peer.channel?.close();
      peer.pc.close();
      peersRef.current.delete(id);
      refreshMembers();
    },
    [refreshMembers]
  );

  const broadcast = useCallback((payload: WirePayload) => {
    const data = JSON.stringify(payload);
    for (const peer of peersRef.current.values()) {
      if (peer.channel?.readyState === 'open') peer.channel.send(data);
    }
  }, []);

  const handleWire = useCallback(
    (peerId: string, payload: WirePayload) => {
      if (payload.kind === 'hello') {
        const peer = peersRef.current.get(peerId);
        if (peer) peer.alias = payload.alias;
        refreshMembers();
        broadcast({ kind: 'hello', alias: aliasRef.current || 'FRIA' });
        return;
      }
      if (payload.kind === 'bye') {
        closePeer(peerId);
        return;
      }
      if (payload.kind === 'message') {
        if (seenFramesRef.current.has(payload.message.id)) return;
        seenFramesRef.current.add(payload.message.id);
        setMessages((prev) => [...prev.slice(-199), payload.message]);
        cbRef.current?.(payload.message);
        broadcast(payload);
        return;
      }
      if (payload.kind === 'location') {
        const frameId = `loc:${payload.location.alias}:${payload.location.timestamp}`;
        if (seenFramesRef.current.has(frameId)) return;
        seenFramesRef.current.add(frameId);
        setPeerLocations((prev) => {
          const next = new Map(prev);
          next.set(payload.location.alias, payload.location);
          return next;
        });
        broadcast(payload);
        return;
      }
      if (payload.kind === 'purge') {
        if (seenFramesRef.current.has('purge')) return;
        seenFramesRef.current.add('purge');
        broadcast(payload);
        setMessages([]);
        setMembers([]);
        setPeerLocations(new Map());
        setKickedReason('room_purged');
        void clearLocalFriaData();
      }
    },
    [broadcast, closePeer, refreshMembers]
  );

  const wireChannel = useCallback(
    (peer: Peer, channel: RTCDataChannel) => {
      const wired = channel as DataChannelWithHandlers;
      peer.channel = channel;
      wired.onopen = () => {
        setConnectionError(null);
        channel.send(JSON.stringify({ kind: 'hello', alias: aliasRef.current || 'FRIA' }));
        refreshMembers();
      };
      wired.onclose = () => closePeer(peer.id);
      wired.onmessage = (event) => {
        try {
          handleWire(peer.id, JSON.parse(String(event.data)) as WirePayload);
        } catch {
          // Ignore malformed peer frames.
        }
      };
    },
    [closePeer, handleWire, refreshMembers]
  );

  const createPeer = useCallback(
    (id: string, alias: string) => {
      const pc = new RTCPeerConnection({ iceServers: [] });
      const rtc = pc as PeerConnectionWithHandlers;
      const peer: Peer = { id, alias, pc, channel: null };
      peersRef.current.set(id, peer);
      rtc.ondatachannel = (event) => wireChannel(peer, event.channel);
      rtc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed') setConnectionError('No se pudo conectar sin servidor');
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'closed') closePeer(id);
      };
      return peer;
    },
    [closePeer, wireChannel]
  );

  const createRoom = useCallback(async () => {
    try {
      setConnectionError(null);
      const alias = aliasRef.current || makeAlias();
      const roomId = roomIdRef.current || randomCode(8);
      const peerId = makeId();
      aliasRef.current = alias;
      roomIdRef.current = roomId;
      setCodename(alias);
      const peer = createPeer(peerId, 'INVITADO');
      const channel = peer.pc.createDataChannel('fria');
      wireChannel(peer, channel);
      const offer = await peer.pc.createOffer({});
      await peer.pc.setLocalDescription(offer);
      await waitForIceGathering(peer.pc);
      const signal = encodeSignal({
        v: 1,
        kind: 'offer',
        roomId,
        alias,
        description: JSON.parse(JSON.stringify(peer.pc.localDescription)) as SessionDescriptionWire,
        candidates: [],
      });
      setRoomCode(signal);
      refreshMembers();
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : 'No se pudo crear la sala');
    }
  }, [createPeer, refreshMembers, wireChannel]);

  const joinRoomCode = useCallback(
    async (code: string) => {
      try {
        setConnectionError(null);
        const offer = decodeSignal(code);
        if (offer.kind !== 'offer') throw new Error('Este código no es una invitación');
        const alias = makeAlias();
        const peerId = offer.alias;
        aliasRef.current = alias;
        roomIdRef.current = offer.roomId;
        setCodename(alias);
        const peer = createPeer(peerId, offer.alias);
        await peer.pc.setRemoteDescription(
          new RTCSessionDescription(
            offer.description
          )
        );
        for (const candidate of offer.candidates) {
          await peer.pc.addIceCandidate(
            new RTCIceCandidate(candidate as ConstructorParameters<typeof RTCIceCandidate>[0])
          );
        }
        const answer = await peer.pc.createAnswer();
        await peer.pc.setLocalDescription(answer);
        await waitForIceGathering(peer.pc);
        setPendingAnswerCode(
          encodeSignal({
            v: 1,
            kind: 'answer',
            roomId: offer.roomId,
            alias,
            to: offer.alias,
            description: JSON.parse(JSON.stringify(peer.pc.localDescription)) as SessionDescriptionWire,
            candidates: [],
          })
        );
        refreshMembers();
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : 'Código inválido');
      }
    },
    [createPeer, refreshMembers]
  );

  const acceptAnswerCode = useCallback(
    async (code: string) => {
      try {
        setConnectionError(null);
        const answer = decodeSignal(code);
        if (answer.kind !== 'answer') throw new Error('Este código no es una respuesta');
        const peer = Array.from(peersRef.current.values()).find((p) => p.alias === 'INVITADO');
        if (!peer) throw new Error('No hay invitación pendiente');
        peer.alias = answer.alias;
        await peer.pc.setRemoteDescription(
          new RTCSessionDescription(
            answer.description
          )
        );
        for (const candidate of answer.candidates) {
          await peer.pc.addIceCandidate(
            new RTCIceCandidate(candidate as ConstructorParameters<typeof RTCIceCandidate>[0])
          );
        }
        setRoomCode(null);
        refreshMembers();
      } catch (err) {
        setConnectionError(err instanceof Error ? err.message : 'Respuesta inválida');
      }
    },
    [refreshMembers]
  );

  const shareCode = useCallback(async (code: string | null) => {
    if (!code) return;
    await Share.share({ message: `${LINK_PREFIX}${encodeURIComponent(code)}` });
  }, []);

  const sendMessage = useCallback(
    (text: string, type = 'text', color: string | null = null) => {
      const msg: Message = {
        id: makeId(),
        alias: aliasRef.current || 'FRIA',
        text,
        type: type as Message['type'],
        color,
        timestamp: Date.now(),
        isQuick: type !== 'text',
      };
      seenFramesRef.current.add(msg.id);
      setMessages((prev) => [...prev.slice(-199), msg]);
      broadcast({ kind: 'message', message: msg });
    },
    [broadcast]
  );

  const sendQuickAlert = useCallback(
    (label: string, icon: string, alertType: string, color: string) => {
      sendMessage(`${icon} ${label}`, alertType, color || null);
    },
    [sendMessage]
  );

  const sendLocation = useCallback(
    (lat: number, lng: number) => {
      const location = { alias: aliasRef.current || 'FRIA', lat, lng, timestamp: Date.now() };
      seenFramesRef.current.add(`loc:${location.alias}:${location.timestamp}`);
      broadcast({
        kind: 'location',
        location,
      });
    },
    [broadcast]
  );

  const leaveRoom = useCallback(
    (onDone: () => void) => {
      broadcast({ kind: 'bye', alias: aliasRef.current || 'FRIA' });
      for (const id of Array.from(peersRef.current.keys())) closePeer(id);
      setConnected(false);
      onDone();
    },
    [broadcast, closePeer]
  );

  const purgeRoom = useCallback(() => {
    seenFramesRef.current.add('purge');
    broadcast({ kind: 'purge' });
    setMessages([]);
    setMembers([]);
    setPeerLocations(new Map());
    setKickedReason('room_purged');
    void clearLocalFriaData();
  }, [broadcast]);

  useEffect(() => {
    const handleUrl = ({ url }: { url: string }) => {
      const code = url.includes('code=') ? decodeURIComponent(url.split('code=')[1]) : '';
      if (!code) return;
      try {
        const signal = decodeSignal(code);
        if (signal.kind === 'offer') void joinRoomCode(code);
        if (signal.kind === 'answer') void acceptAnswerCode(code);
      } catch {
        setConnectionError('Link FRÍA inválido');
      }
    };
    const sub = Linking.addEventListener('url', handleUrl);
    Linking.getInitialURL().then((url) => url && handleUrl({ url })).catch(() => {});
    return () => sub.remove();
  }, [acceptAnswerCode, joinRoomCode]);

  return {
    connected,
    connectionError,
    codename,
    roomCode,
    pendingAnswerCode,
    members,
    messages,
    peerLocations,
    kickedReason,
    createRoom,
    joinRoomCode,
    acceptAnswerCode,
    shareRoomCode: () => shareCode(roomCode),
    shareAnswerCode: () => shareCode(pendingAnswerCode),
    sendMessage,
    sendQuickAlert,
    sendLocation,
    leaveRoom,
    purgeRoom,
    retryConnection: createRoom,
  };
}

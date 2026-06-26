import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { LeafletMap } from '../components/LeafletMap';
import { QuickButton } from '../components/QuickButton';
import { ChatBubble } from '../components/ChatBubble';
import { COLORS, QuickResponse, Message, Member, PeerLocation } from '../types';
import { QUICK_RESPONSES, CHAT_QUICK_RESPONSES } from '../assets/quickResponses';
import { useLocation } from '../hooks/useLocation';

interface Props {
  alias: string;
  members: Member[];
  messages: Message[];
  peerLocations: Map<string, PeerLocation>;
  connected: boolean;
  sendMessage: (text: string, type?: string, color?: string | null) => void;
  sendQuickAlert: (label: string, icon: string, alertType: string, color: string) => void;
  sendLocation: (lat: number, lng: number) => void;
  onExit: () => void;
  onDefinitiveExit: () => void;
}

type Tab = 'map' | 'chat';

export function FriaScreen({
  alias,
  members,
  messages,
  peerLocations,
  connected,
  sendMessage,
  sendQuickAlert,
  sendLocation,
  onExit,
  onDefinitiveExit,
}: Props) {
  const [tab, setTab] = useState<Tab>('map');
  const [mapInput, setMapInput] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatListRef = useRef<FlatList>(null);

  const sendLocationStable = useCallback(
    (la: number, ln: number) => sendLocation(la, ln),
    [sendLocation]
  );
  const { lat, lng } = useLocation(sendLocationStable);

  // Auto-scroll chat
  useEffect(() => {
    if (messages.length > 0 && tab === 'chat') {
      setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, tab]);

  const handleSendMap = () => {
    const val = mapInput.trim();
    if (!val) return;
    sendMessage(val, 'text');
    setMapInput('');
  };

  const handleSendChat = () => {
    const val = chatInput.trim();
    if (!val) return;
    sendMessage(val, 'text');
    setChatInput('');
  };

  const handleQuick = (item: QuickResponse) => {
    sendQuickAlert(item.label, item.icon, item.type, '');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleSafeExit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onExit();
  };

  // Triple-tap "🔥 borrar todo · salir".
  // The server confirms the global purge to every connected member.
  const [emerLevel, setEmerLevel] = useState(0);
  const emerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleEmer = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    setEmerLevel((prev) => {
      const next = Math.min(prev + 1, 3);
      if (emerTimer.current) clearTimeout(emerTimer.current);
      if (next >= 3) {
        onDefinitiveExit();
        return 0;
      }
      emerTimer.current = setTimeout(() => setEmerLevel(0), 3000);
      return next;
    });
  };

  useEffect(() => {
    return () => {
      if (emerTimer.current) clearTimeout(emerTimer.current);
      emerTimer.current = null;
    };
  }, []);

  const emerLabel =
    emerLevel > 0 ? `🔥 borrar todo · salir · ${emerLevel}/3` : '🔥 borrar todo · salir';

  const onlineCount = members.length || 1;

  const gridButtons = QUICK_RESPONSES.filter(
    (q) => q.type !== 'status' && q.type !== 'abort'
  );
  const statusBtn = QUICK_RESPONSES.find((q) => q.type === 'status');
  const abortBtn = QUICK_RESPONSES.find((q) => q.type === 'abort');

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <Text style={styles.logoTitle}>FRÍA</Text>
          <View style={styles.badgeE2E}>
            <Text style={styles.badgeText}>E2E</Text>
          </View>
          <Text style={styles.logoSub}>red cifrada · privada</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.statusRow}>
            <View style={[styles.dot, connected ? styles.dotGreen : styles.dotRed]} />
            <Text style={[styles.statusTxt, !connected && styles.statusTxtDisconnected]}>
              {connected ? `${onlineCount} activos` : 'desconectado'}
            </Text>
          </View>
          <Text style={styles.encTxt}>🔒 AES-256</Text>
        </View>
      </View>

      {/* ── Codename strip ── */}
      <View style={styles.codenameStrip}>
        <Text style={styles.codenameStripLabel}>SOS</Text>
        <Text style={styles.codenameStripVal}>{alias}</Text>
      </View>

      {/* ── Tabs ── */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'map' && styles.tabActive]}
          onPress={() => setTab('map')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabTxt, tab === 'map' && styles.tabTxtActive]}>🗺 MAPA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'chat' && styles.tabActive]}
          onPress={() => setTab('chat')}
          activeOpacity={0.7}
        >
          <Text style={[styles.tabTxt, tab === 'chat' && styles.tabTxtActive]}>
            💬 CHAT
            {messages.length > 0 && tab !== 'chat' && (
              <Text style={styles.badge}> {messages.length > 9 ? '9+' : messages.length}</Text>
            )}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── MAP TAB ── */}
      {tab === 'map' && (
        <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
          <LeafletMap
            myAlias={alias}
            myLat={lat}
            myLng={lng}
            peerLocations={peerLocations}
          />

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>alertas rápidas · mapa</Text>
            {statusBtn && (
              <View style={{ marginBottom: 8 }}>
                <QuickButton item={statusBtn} onSend={handleQuick} />
              </View>
            )}
            <View style={styles.quickGrid}>
              {gridButtons.map((q, i) => (
                <View key={i} style={styles.quickCell}>
                  <QuickButton item={q} onSend={handleQuick} />
                </View>
              ))}
            </View>
            {abortBtn && (
              <View style={{ marginTop: 8 }}>
                <QuickButton item={abortBtn} onSend={handleQuick} />
              </View>
            )}
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="mensaje rápido al grupo..."
              placeholderTextColor={COLORS.txt3}
              value={mapInput}
              onChangeText={setMapInput}
              onSubmitEditing={handleSendMap}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendMap} activeOpacity={0.7}>
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.safeBtn} onPress={handleSafeExit} activeOpacity={0.7}>
              <Text style={styles.safeBtnTxt}>🚪 SALIR SEGURO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emerBtn, emerLevel > 0 && styles.emerBtnActive]}
              onPress={handleEmer}
              activeOpacity={0.7}
            >
              <Text style={styles.emerBtnTxt}>{emerLabel}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.membersBar}
            contentContainerStyle={styles.membersContent}
          >
            <View style={[styles.chip, { borderColor: COLORS.blue }]}>
              <View style={[styles.chipDot, { backgroundColor: COLORS.blue }]} />
              <Text style={[styles.chipTxt, { color: COLORS.blue }]}>{alias}</Text>
            </View>
            {members
              .filter((m) => m.alias !== alias)
              .map((m, i) => {
                const chipColors = [COLORS.red, COLORS.green, COLORS.amber, COLORS.purple, COLORS.cyan];
                const c = chipColors[i % chipColors.length];
                return (
                  <View key={m.socketId} style={[styles.chip, { borderColor: c }]}>
                    <View style={[styles.chipDot, { backgroundColor: c }]} />
                    <Text style={[styles.chipTxt, { color: c }]}>{m.alias}</Text>
                  </View>
                );
              })}
          </ScrollView>

          <FlatList
            ref={chatListRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ChatBubble msg={item} myAlias={alias} />}
            contentContainerStyle={styles.chatContent}
            style={styles.flex}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: false })}
          />

          <View style={styles.chatQuickSection}>
            <Text style={styles.sectionLabel}>alerta rápida · chat</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chatQuickRow}>
                {CHAT_QUICK_RESPONSES.map((q, i) => (
                  <QuickButton key={i} item={q} onSend={handleQuick} compact />
                ))}
              </View>
            </ScrollView>
          </View>

          <View style={styles.actionBar}>
            <TouchableOpacity style={styles.safeBtn} onPress={handleSafeExit} activeOpacity={0.7}>
              <Text style={styles.safeBtnTxt}>🚪 SALIR SEGURO</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.emerBtn, emerLevel > 0 && styles.emerBtnActive]}
              onPress={handleEmer}
              activeOpacity={0.7}
            >
              <Text style={styles.emerBtnTxt}>{emerLabel}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="mensaje al grupo..."
              placeholderTextColor={COLORS.txt3}
              value={chatInput}
              onChangeText={setChatInput}
              onFocus={() => setTimeout(() => chatListRef.current?.scrollToEnd({ animated: true }), 100)}
              onSubmitEditing={handleSendChat}
              returnKeyType="send"
            />
            <TouchableOpacity style={styles.sendBtn} onPress={handleSendChat} activeOpacity={0.7}>
              <Text style={styles.sendIcon}>➤</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: '#111827cc',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.txt,
    letterSpacing: 3,
    fontFamily: 'Courier New',
  },
  logoSub: { fontSize: 9, color: COLORS.txt3, fontFamily: 'Courier New' },
  badgeE2E: {
    backgroundColor: COLORS.greenDim,
    borderWidth: 1,
    borderColor: '#22c55e30',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 9, color: COLORS.green, fontWeight: '600' },
  headerRight: { alignItems: 'flex-end', gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotGreen: { backgroundColor: COLORS.green },
  dotRed: { backgroundColor: COLORS.red },
  statusTxt: { fontSize: 12, color: COLORS.green, fontWeight: '500' },
  statusTxtDisconnected: { color: COLORS.red },
  encTxt: { fontSize: 10, color: COLORS.txt3, fontFamily: 'Courier New' },

  codenameStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#0d0709',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  codenameStripLabel: { fontSize: 9, color: COLORS.txt3, fontFamily: 'Courier New', letterSpacing: 1 },
  codenameStripVal: { fontSize: 12, color: COLORS.txt, fontFamily: 'Courier New', fontWeight: '700', letterSpacing: 2 },

  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    borderRadius: 12,
  },
  tabActive: { borderBottomColor: COLORS.blue },
  tabTxt: { fontSize: 11, fontWeight: '600', color: COLORS.txt3, letterSpacing: 0.8 },
  tabTxtActive: { color: COLORS.txt },
  badge: { fontSize: 10, color: COLORS.red },

  section: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.txt3,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontFamily: 'Courier New',
    marginBottom: 8,
  },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCell: { width: '47.5%' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.border2,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.txt,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIcon: { fontSize: 16, color: '#fff', fontWeight: '800' },

  actionBar: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#0d0709',
    borderTopWidth: 1,
    borderTopColor: '#2a1018',
  },
  safeBtn: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#06b6d42f',
    backgroundColor: '#0e749020',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeBtnTxt: {
    color: '#9be7ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  emerBtn: {
    minHeight: 44,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: '#f43f5e35',
    backgroundColor: '#f43f5e12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emerBtnActive: {
    backgroundColor: '#f43f5e22',
    borderColor: '#f43f5e88',
  },
  emerBtnTxt: { color: COLORS.red, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },

  membersBar: { borderBottomWidth: 1, borderBottomColor: COLORS.border, maxHeight: 48 },
  membersContent: { paddingHorizontal: 14, paddingVertical: 8, gap: 8, flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    backgroundColor: COLORS.surface,
  },
  chipDot: { width: 5, height: 5, borderRadius: 3 },
  chipTxt: { fontSize: 10.5, fontWeight: '600', fontFamily: 'Courier New' },
  chatContent: { padding: 14 },
  chatQuickSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  chatQuickRow: { flexDirection: 'row', gap: 8 },
});

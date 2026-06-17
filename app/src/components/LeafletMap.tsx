import React, { useRef, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { buildMapHtml } from '../assets/mapHtml';
import { PeerLocation } from '../types';

interface Props {
  myAlias: string;
  myLat: number | null;
  myLng: number | null;
  peerLocations: Map<string, PeerLocation>;
}

const DEFAULT_LAT = 9.9281;
const DEFAULT_LNG = -84.0907; // San José, Costa Rica

export function LeafletMap({ myAlias, myLat, myLng, peerLocations }: Props) {
  const webViewRef = useRef<WebView>(null);
  const lastPeers = useRef<Map<string, PeerLocation>>(new Map());

  const lat = myLat ?? DEFAULT_LAT;
  const lng = myLng ?? DEFAULT_LNG;

  const html = buildMapHtml({
    myAlias,
    myLat: lat,
    myLng: lng,
    peers: Array.from(peerLocations.values()),
  });

  // Send location updates to the WebView map without a full reload
  useEffect(() => {
    if (!webViewRef.current) return;
    webViewRef.current.postMessage(
      JSON.stringify({ type: 'update_me', lat, lng })
    );
  }, [lat, lng]);

  useEffect(() => {
    if (!webViewRef.current) return;
    peerLocations.forEach((loc, alias) => {
      const prev = lastPeers.current.get(alias);
      if (!prev || prev.lat !== loc.lat || prev.lng !== loc.lng) {
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'update_peer', alias, lat: loc.lat, lng: loc.lng })
        );
      }
    });
    lastPeers.current = new Map(peerLocations);
  }, [peerLocations]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled={false}
        scrollEnabled={false}
        bounces={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 4 / 3,
    minHeight: 220,
    overflow: 'hidden',
    backgroundColor: '#0b0e16',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0b0e16',
  },
});

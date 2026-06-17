export function buildMapHtml(params: {
  myAlias: string;
  myLat: number;
  myLng: number;
  peers: Array<{ alias: string; lat: number; lng: number }>;
}): string {
  const { myAlias, myLat, myLng, peers } = params;

  const peersJson = JSON.stringify(peers);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #map { width: 100%; height: 100%; background: #0b0e16; }
  .custom-pin {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .pin-avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 2px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    font-family: 'Courier New', monospace;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    position: relative;
  }
  .pin-tag {
    font-size: 8px;
    margin-top: 3px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
  }
  .leaflet-tile-pane { filter: brightness(0.6) saturate(0.4) hue-rotate(200deg); }
  .leaflet-control-zoom a {
    background: #18181c !important;
    color: #8888a0 !important;
    border-color: #222228 !important;
  }
  .leaflet-control-attribution {
    background: rgba(10,10,11,0.8) !important;
    color: #444458 !important;
    font-size: 9px !important;
  }
  .leaflet-control-attribution a { color: #444458 !important; }
</style>
</head>
<body>
<div id="map"></div>
<script>
  const ME_ALIAS = ${JSON.stringify(myAlias)};
  const ME_LAT   = ${myLat};
  const ME_LNG   = ${myLng};
  const PEERS    = ${peersJson};

  const MEMBER_COLORS = ['#3b82f6','#f43f5e','#22c55e','#f59e0b','#a855f7','#06b6d4'];

  const map = L.map('map', {
    center: [ME_LAT, ME_LNG],
    zoom: 15,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19,
  }).addTo(map);

  function colorForIndex(i) {
    return MEMBER_COLORS[i % MEMBER_COLORS.length];
  }

  function makeIcon(alias, color, isMe) {
    const pulse = isMe
      ? \`<div style="position:absolute;inset:-10px;border-radius:50%;border:2px solid \${color};animation:pulse 2.4s ease-out infinite;opacity:0;"></div>\`
      : '';
    const html = \`
      <div class="custom-pin">
        <div class="pin-avatar" style="background:\${color}22;border-color:\${color};color:\${color};">
          \${pulse}
          \${alias.slice(0,2).toUpperCase()}
        </div>
        <div class="pin-tag" style="background:\${color}22;color:\${color};">\${alias}</div>
      </div>
    \`;
    return L.divIcon({ html, className: '', iconSize: [48, 56], iconAnchor: [24, 28] });
  }

  const style = document.createElement('style');
  style.textContent = '@keyframes pulse{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.8);opacity:0}}';
  document.head.appendChild(style);

  // My marker
  const myMarker = L.marker([ME_LAT, ME_LNG], {
    icon: makeIcon(ME_ALIAS || 'YO', '#3b82f6', true),
    zIndexOffset: 1000,
  }).addTo(map);

  // Peer markers
  const peerMarkers = {};
  PEERS.forEach((p, i) => {
    const color = colorForIndex(i + 1);
    peerMarkers[p.alias] = L.marker([p.lat, p.lng], {
      icon: makeIcon(p.alias, color, false),
    }).addTo(map);
  });

  // Listen for updates from React Native.
  // Android's WebView delivers postMessage on the document; iOS and web
  // deliver it on window. Register both to be safe.
  function handleMessage(e) {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'update_me') {
        myMarker.setLatLng([data.lat, data.lng]);
      } else if (data.type === 'update_peer') {
        if (peerMarkers[data.alias]) {
          peerMarkers[data.alias].setLatLng([data.lat, data.lng]);
        } else {
          const idx = Object.keys(peerMarkers).length;
          const color = colorForIndex(idx + 1);
          peerMarkers[data.alias] = L.marker([data.lat, data.lng], {
            icon: makeIcon(data.alias, color, false),
          }).addTo(map);
        }
      } else if (data.type === 'remove_peer') {
        const marker = peerMarkers[data.alias];
        if (marker) {
          map.removeLayer(marker);
          delete peerMarkers[data.alias];
        }
      } else if (data.type === 'center_me') {
        map.setView([data.lat, data.lng], 15);
      }
    } catch {}
  }
  window.addEventListener('message', handleMessage);
  document.addEventListener('message', handleMessage);
</script>
</body>
</html>`;
}

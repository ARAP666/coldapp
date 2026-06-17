// Tests for the Leaflet HTML builder. The builder is a pure string function,
// so we can verify structural invariants without rendering React.

import { buildMapHtml } from '../src/assets/mapHtml';

describe('buildMapHtml', () => {
  it('embeds Leaflet from unpkg', () => {
    const html = buildMapHtml({
      myAlias: 'A1',
      myLat: 9.93,
      myLng: -84.09,
      peers: [],
    });
    expect(html).toMatch(/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.css/);
    expect(html).toMatch(/unpkg\.com\/leaflet@1\.9\.4\/dist\/leaflet\.js/);
  });

  it('inlines the user alias and lat/lng', () => {
    const html = buildMapHtml({
      myAlias: 'A1',
      myLat: 9.9281,
      myLng: -84.0907,
      peers: [],
    });
    expect(html).toContain('"A1"');
    expect(html).toContain('9.9281');
    expect(html).toContain('-84.0907');
  });

  it('serializes peers as JSON for the initial paint', () => {
    const peers = [
      { alias: 'B3', lat: 1, lng: 2 },
      { alias: 'C2', lat: 3, lng: 4 },
    ];
    const html = buildMapHtml({ myAlias: 'A1', myLat: 0, myLng: 0, peers });
    expect(html).toContain('"B3"');
    expect(html).toContain('"C2"');
  });

  it('listens for messages on both window and document (Android WebView)', () => {
    const html = buildMapHtml({
      myAlias: 'A1',
      myLat: 0,
      myLng: 0,
      peers: [],
    });
    expect(html).toMatch(/window\.addEventListener\(['"]message['"]/);
    expect(html).toMatch(/document\.addEventListener\(['"]message['"]/);
  });

  it('handles the remove_peer event so disconnected members vanish', () => {
    const html = buildMapHtml({
      myAlias: 'A1',
      myLat: 0,
      myLng: 0,
      peers: [],
    });
    expect(html).toMatch(/['"]remove_peer['"]/);
    expect(html).toMatch(/map\.removeLayer/);
  });
});

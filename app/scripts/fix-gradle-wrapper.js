const fs = require('fs');
const path = require('path');

const WRAPPER_PATH = path.join(
  process.cwd(),
  'android',
  'gradle',
  'wrapper',
  'gradle-wrapper.properties'
);

const TARGET_VERSION = '8.14.3';

if (!fs.existsSync(WRAPPER_PATH)) {
  console.warn('[fix-gradle-wrapper] No gradle-wrapper.properties found at', WRAPPER_PATH);
  console.warn('[fix-gradle-wrapper] Skipping (expected if no android/ directory yet)');
  process.exit(0);
}

let content = fs.readFileSync(WRAPPER_PATH, 'utf-8');
const original = content;

const DIST_URL = `https\\://services.gradle.org/distributions/gradle-${TARGET_VERSION}-bin.zip`;

content = content.replace(
  /distributionUrl=.+/,
  `distributionUrl=${DIST_URL}`
);

if (content === original) {
  console.log(`[fix-gradle-wrapper] Already pinned to Gradle ${TARGET_VERSION}, no change needed`);
} else {
  fs.writeFileSync(WRAPPER_PATH, content, 'utf-8');
  console.log(`[fix-gradle-wrapper] Pinned Gradle wrapper to ${TARGET_VERSION}`);
}

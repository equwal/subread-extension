/* node --test tests/more-apps.test.cjs */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

// The links in the "More apps" section of the popup: the name, the address and the attributes of each.
function moreApps() {
  const section = read('popup.html').match(/<details id="more-apps"[^>]*>([\s\S]*?)<\/details>/);
  assert.ok(section, 'popup.html has no More apps section');
  return [...section[1].matchAll(/<a ([^>]*)>([^<]*)<\/a>/g)].map(([, attrs, name]) => ({
    name,
    attrs,
    href: (attrs.match(/href="([^"]*)"/) || [])[1],
  }));
}

test('More apps links to the other apps with https, each in a new tab', () => {
  const apps = moreApps();
  assert.ok(apps.length > 1);
  for (const app of apps) {
    assert.match(app.href, /^https:\/\/[^?#]+$/, app.name);   // no tracking parameters
    assert.match(app.attrs, /target="_blank"/, app.name);
    assert.match(app.attrs, /rel="noopener"/, app.name);
  }
  assert.equal(new Set(apps.map((app) => app.href)).size, apps.length);
  assert.equal(apps.at(-1).href, 'https://recentlywritten.com/projects.html');
});

test('More apps does not list the add-on itself', () => {
  for (const app of moreApps()) assert.doesNotMatch(app.href, /subread-extension/, app.name);
});

test('the add-on asks for no new permission and puts no link into YouTube pages', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.deepEqual(manifest.permissions, ['storage']);
  for (const key of ['host_permissions', 'optional_permissions', 'optional_host_permissions']) {
    assert.equal(manifest[key], undefined, key);
  }
  for (const script of manifest.content_scripts) {
    for (const file of script.js) assert.doesNotMatch(read(file), /More apps|recentlywritten\.com/, file);
  }
});

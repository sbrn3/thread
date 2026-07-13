import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// §13.6 — module boundaries are a compile-time guarantee, not a
// convention. This test walks the source and fails on the forbidden
// imports. (A lint rule can replace it later; the invariant is what
// matters, not the tool.)

const SRC = join(__dirname, '..', 'src');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Source with // and /* *​/ comments removed — bans apply to code, not docs. */
function codeOf(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function importsOf(file: string): string[] {
  const text = codeOf(file);
  return [...text.matchAll(/(?:import|export)[^'"]*from\s+['"]([^'"]+)['"]/g)]
    .map((m) => m[1])
    .concat([...text.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]));
}

describe('import boundaries (§13.6)', () => {
  it('nothing in /src/lab imports from /src/ui — the bandit cannot reach the settings store', () => {
    for (const f of walk(join(SRC, 'lab'))) {
      for (const imp of importsOf(f)) {
        expect(imp, `${f} imports ${imp}`).not.toMatch(/\/ui(\/|$)/);
      }
    }
  });

  it('/src/memory imports nothing from /src/lab — a recall grade cannot affect the habit', () => {
    for (const f of walk(join(SRC, 'memory'))) {
      for (const imp of importsOf(f)) {
        expect(imp, `${f} imports ${imp}`).not.toMatch(/\/lab(\/|$)/);
      }
    }
  });

  it('/src/partner imports nothing that can make a network call or schedule a notification', () => {
    const forbidden = /expo-notifications|node-fetch|axios|\/lab(\/|$)|\/notify(\/|$)/;
    for (const f of walk(join(SRC, 'partner'))) {
      for (const imp of importsOf(f)) {
        expect(imp, `${f} imports ${imp}`).not.toMatch(forbidden);
      }
      // and no method to do it: the contract itself must not name one
      expect(codeOf(f)).not.toMatch(
        /notifyPartner\s*\(|getPartnerState\s*\(|sharePartnerStreak\s*\(/,
      );
    }
  });

  it('no Math.random() anywhere in /src — seeded PRNG only (§16.7)', () => {
    for (const f of walk(SRC)) {
      expect(codeOf(f), f).not.toMatch(/Math\.random\s*\(/);
    }
  });
});

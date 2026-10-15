import type { FullConfig } from '@playwright/test';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
export default function cleanup(config: FullConfig) {
  const directory = path.dirname(config.metadata.databasePath as string);
  if (path.dirname(directory) !== tmpdir() || !path.basename(directory).startsWith('trustx-e2e-')) throw new Error('Unexpected test database path');
  rmSync(directory, { recursive: true, force: true });
}

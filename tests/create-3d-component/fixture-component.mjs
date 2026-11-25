import {access} from 'node:fs/promises';
import {join} from 'node:path';

export async function fixtureComponent(project,id) {
  const named=join(project,'components',id);
  try {
    await access(join(named,'package.json'));
    return named;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const legacy=join(project,'component');
  await access(join(legacy,'package.json'));
  return legacy;
}

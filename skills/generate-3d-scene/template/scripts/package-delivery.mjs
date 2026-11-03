import { resolve, dirname } from 'node:path';
import { publishPreview } from './publish-preview.mjs';

export function packageDelivery(root) {
  root = resolve(root);
  return publishPreview(root, dirname(root));
}

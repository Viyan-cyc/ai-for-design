/** Application assembly shared by run/edit. Kept outside the replaceable 3D package. */
import { createScene3D, type Scene3DOptions } from '../3d/index';
import { cards } from './cards';
import { createDataAdapter } from './data/adapter';
import { connectData } from './data/connect';

export async function bootScene(host: HTMLElement, options: Scene3DOptions = {}) {
  const handle = await createScene3D(host, { cards, ...options });
  // The host application owns its DOM identifier; the reusable package has no fixed ID.
  handle.internals.canvas.id = 'scene-canvas';
  const adapter = createDataAdapter(handle);
  try {
    handle.onDispose(connectData(adapter));
  } catch (error) {
    handle.dispose();
    throw error;
  }
  return { handle, adapter, data: handle.serialize(), canvas: handle.internals.canvas };
}

/** Runs inside the page as well as in deterministic contract tests. */
export const verifyEditRoundTrip = async (h) => {
  const require = (ok, detail) => { if (!ok) throw new Error(detail); };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const se = h.internals.sceneEngine;
  await h.whenReady({ timeoutMs: 15000 });
  const ids = se.getAllIds();
  require(ids.length > 0, 'no scene nodes');
  const id = ids[0];
  const original = clone(h.serialize());
  const node = clone(se.getNode(id));
  const obj = se.getObject(id);
  require(Boolean(obj), 'missing object');
  const visible = !obj.visible;
  const position = [(node.position?.[0] ?? 0) + 0.5, node.position?.[1] ?? 0, (node.position?.[2] ?? 0) + 0.5];
  const check = () => {
    const actual = se.getObject(id);
    require(se.getVisual(id)?.visible === visible, 'visual patch failed');
    require(actual?.visible === visible, 'object visibility not synchronized');
    for (const [i, axis] of ['x', 'y', 'z'].entries()) {
      require(Math.abs(actual.position[axis] - position[i]) < 1e-6, 'object position not synchronized');
      require(Math.abs(se.getNode(id).position[i] - position[i]) < 1e-6, 'node position mismatch');
    }
    require(JSON.stringify([...se.getAllIds()].sort()) === JSON.stringify([...ids].sort()), 'node set changed');
  };
  try {
    se.patchVisual(id, { visible });
    h.update({ [se.getNodeType(id)]: [{ ...node, position }] });
    await h.whenReady({ timeoutMs: 15000 });
    check();
    const saved = clone(h.serialize());
    const savedNode = Object.values(saved).filter(Array.isArray).flat().find((n) => n?.id === id);
    require(saved.__visuals?.[id]?.visible === visible, 'serialize lost visual');
    require(JSON.stringify(savedNode?.position) === JSON.stringify(position), 'serialize lost transform');
    h.update({ remove: [...se.getAllIds()] });
    require(se.getAllIds().length === 0, 'clear before reload failed');
    h.update(saved);
    await h.whenReady({ timeoutMs: 15000 });
    check();
    return { id, nodes: ids.length, visible, position };
  } finally {
    h.update({ remove: [...se.getAllIds()] });
    h.update(original);
    await h.whenReady({ timeoutMs: 15000 });
  }
};

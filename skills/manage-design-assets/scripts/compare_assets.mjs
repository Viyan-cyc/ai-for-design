#!/usr/bin/env node
/**
 * Compare prototype assets against an asset library and propose sync actions.
 * 1:1 port of compare_assets.py (D18/N5) — output must be equivalent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { scanDirectory, loadIndex } from './scan_assets.mjs';

function classify(kind, protoAssets, libAssets, libIndex) {
  const items = [];
  for (const [assetId, info] of Object.entries(protoAssets)) {
    const entry = {
      kind,
      id: assetId,
      prototypeFile: info.file,
      prototypeHash: info.hash,
      files: info.files,
    };
    if (!(assetId in libIndex)) {
      entry.status = 'added';
      entry.action = 'register';
      entry.reason = 'New asset in prototype, not present in library index.';
      entry.approvedIndexEntry = null;
    } else {
      const libSource = libIndex[assetId].source ?? '';
      entry.libraryFile = libSource;
      if (assetId in libAssets) {
        entry.libraryHash = libAssets[assetId].hash;
        if (libAssets[assetId].hash !== info.hash) {
          entry.status = 'changed';
          entry.action = 'update';
          entry.reason = 'Prototype source differs from library source.';
        } else {
          entry.status = 'in-sync';
          entry.action = 'none';
          entry.reason = 'Contents are identical.';
        }
      } else {
        entry.status = 'orphaned';
        entry.action = 'update';
        entry.reason = 'Registered in index but source file missing; will recreate from prototype.';
      }
    }
    items.push(entry);
  }
  return items;
}

export function compare(prototypeRoot, libraryRoot, contract) {
  const protoScan = scanDirectory(prototypeRoot, contract, 'prototype');
  const libScan = scanDirectory(libraryRoot, contract, 'library');

  const componentIndex = loadIndex(libraryRoot, contract, 'components');
  const templateIndex = loadIndex(libraryRoot, contract, 'templates');

  const components = classify('component', protoScan.components, libScan.components, componentIndex);
  const templates = classify('template', protoScan.templates, libScan.templates, templateIndex);

  const allItems = [...components, ...templates];
  const actionable = allItems.filter((i) => i.action !== 'none');

  return {
    schemaVersion: '1.0',
    assetId: contract.assetId,
    prototypeRoot: String(path.resolve(prototypeRoot)),
    libraryRoot: String(path.resolve(libraryRoot)),
    approved: false,
    summary: {
      totalPrototypeComponents: Object.keys(protoScan.components).length,
      totalPrototypeTemplates: Object.keys(protoScan.templates).length,
      added: allItems.filter((i) => i.status === 'added').length,
      changed: allItems.filter((i) => i.status === 'changed').length,
      orphaned: allItems.filter((i) => i.status === 'orphaned').length,
      inSync: allItems.filter((i) => i.status === 'in-sync').length,
      actionable: actionable.length,
    },
    components,
    templates,
    actionable,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  let output = get('-o') ?? get('--output');
  const positional = args.filter((a) => !a.startsWith('-'));
  if (positional.length < 3 || positional.some((a) => a === '-h' || a === '--help')) {
    console.error('usage: node compare_assets.mjs <contract> <prototype> <library> [-o output]');
    process.exit(2);
  }
  const [contractPath, prototype, library] = positional;
  const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
  const proposal = compare(path.resolve(prototype), path.resolve(library), contract);

  const text = JSON.stringify(proposal, null, 2);
  if (output) {
    fs.writeFileSync(output, text + '\n');
    console.log(`Proposal written to ${output}`);
  } else {
    console.log(text);
  }
}

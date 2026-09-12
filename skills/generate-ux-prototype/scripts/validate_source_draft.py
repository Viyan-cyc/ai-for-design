#!/usr/bin/env python3
"""Validate source locks, chosen bundles, generated entry and business configuration."""
from __future__ import annotations
import argparse,hashlib,os,re,json
from pathlib import Path
from asset_locator import load_json,safe_path,locate_asset_library,load_contract,index_paths,load_manifest

def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()

def schema_errors(value: object, schema: dict, path: str = "config") -> list[str]:
    """Validate the dependency-free JSON Schema subset used by governed asset libraries."""
    errors: list[str] = []
    if "anyOf" in schema and not any(not schema_errors(value, candidate, path) for candidate in schema["anyOf"]):
        errors.append(f"{path} does not match any permitted value type")
    if "const" in schema and value != schema["const"]:
        errors.append(f"{path} must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        errors.append(f"{path} is not one of the allowed values")
    expected = schema.get("type")
    type_ok = {
        "object": isinstance(value, dict),
        "array": isinstance(value, list),
        "string": isinstance(value, str),
        "integer": isinstance(value, int) and not isinstance(value, bool),
        "number": isinstance(value, (int, float)) and not isinstance(value, bool),
        "boolean": isinstance(value, bool),
        "null": value is None,
    }.get(expected, True)
    if expected and not type_ok:
        return [f"{path} must be {expected}"]
    if isinstance(value, dict):
        required = schema.get("required", [])
        for key in required:
            if key not in value:
                errors.append(f"{path}.{key} is required")
        properties = schema.get("properties", {})
        for key, item in value.items():
            if key in properties:
                errors.extend(schema_errors(item, properties[key], f"{path}.{key}"))
            elif schema.get("additionalProperties") is False:
                errors.append(f"{path}.{key} is not allowed")
    if isinstance(value, list):
        if len(value) < schema.get("minItems", 0):
            errors.append(f"{path} requires at least {schema['minItems']} items")
        if "maxItems" in schema and len(value) > schema["maxItems"]:
            errors.append(f"{path} allows at most {schema['maxItems']} items")
        if schema.get("uniqueItems") and len({json.dumps(item, sort_keys=True, ensure_ascii=False) for item in value}) != len(value):
            errors.append(f"{path} must contain unique items")
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                errors.extend(schema_errors(item, item_schema, f"{path}[{index}]"))
    if isinstance(value, str):
        if len(value) < schema.get("minLength", 0):
            errors.append(f"{path} is shorter than {schema['minLength']}")
        pattern = schema.get("pattern")
        if pattern and re.search(pattern, value) is None:
            errors.append(f"{path} does not match its required pattern")
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if "minimum" in schema and value < schema["minimum"]:
            errors.append(f"{path} must be at least {schema['minimum']}")
        if "maximum" in schema and value > schema["maximum"]:
            errors.append(f"{path} must be at most {schema['maximum']}")
    return errors

def validate(output,assets_root,scope="full"):
 errors=[]
 if scope not in ['full','selected']:return ['Unknown validation scope']
 try:
  selection=load_json(output/'asset-selection.json');plan=load_json(output/'component-plan.json');root,_,entry=locate_asset_library(assets_root,selection['assetId']);contract,_=load_contract(root,entry);paths=index_paths(root,contract);manifest=load_manifest(root,paths['manifest'].relative_to(root).as_posix());template=load_json(paths['templates'])['templates'][selection['templateId']];components=load_json(paths['components'])['components']
  for key in (['assetId','assetVersion','sourceReleaseSha256'] if scope=='full' else ['assetId','assetVersion']):
   if selection[key]!=manifest[key]:errors.append('Release mismatch: '+key)
  if selection.get('handoff'):
   h=selection['handoff']
   if digest(output/'task-handoff.json')!=h['snapshotSha256']:errors.append('Handoff snapshot changed')
   for reference in [{'path':h['source'],'sha256':h['sha256']},*h['inputs']]:
    f=Path(reference['path'])
    if not f.is_file() or digest(f)!=reference['sha256']:errors.append('Handoff input changed: '+str(f))
  config=load_json(safe_path(output,selection['configFile']))
  for key in ['assetId','assetVersion','templateId','directionId']:
   if config.get(key)!=selection.get(key) or plan.get(key)!=selection.get(key):errors.append('Plan/config mismatch: '+key)
  if plan.get('assetGaps'):errors.append('Unresolved asset gaps')
  if selection['interactions']!=plan['interactions']:errors.append('Interaction plan changed')
  if set(template['criticalInteractions'])-set(selection['interactions']):errors.append('Missing critical interactions')
  for key in ['appEntry','configFile','configPreset','configSchema']:
   if selection[key]!=template[key]:errors.append('Template contract changed: '+key)
  if selection['projectRoot']!=contract['projectRoot'] or selection['templateSource']!=template['source']:errors.append('Runtime contract mismatch')
  expected=set(manifest['prototypeBaseFiles'])|set(template['files'])|{template['spec'],template['configSchema']}
  for cid in selection['components']:
   expected.update(components[cid]['files']);expected.add(components[cid]['spec'])
  if set(selection['files'])!=expected:errors.append('Locked bundle file list changed')
  if not set(template['components']).issubset(selection['components']):errors.append('Missing template components')
  for relative,h in selection['files'].items():
   for base in [root,output]:
    f=safe_path(base,relative)
    if not f.is_file() or digest(f)!=h:errors.append('Source changed: '+relative)
  for rel,h in (manifest['protectedFiles'].items() if scope=='full' else []):
   p=safe_path(root,rel)
   if not p.is_file() or digest(p)!=h:errors.append('Library changed: '+rel)
  actual={p.relative_to(output).as_posix() for p in (output/contract['projectRoot']/'src/components').rglob('G*.vue')} if (output/contract['projectRoot']/'src/components').exists() else set()
  wanted={components[c]['source'] for c in selection['components'] if components[c]['source'].endswith('.vue')}
  if actual!=wanted:errors.append('Component source selection differs')
  actual_templates={p.relative_to(output).as_posix() for p in (output/contract['projectRoot']/'src/page-templates').rglob('*.vue')}
  if actual_templates!={template['source']}:errors.append('Unexpected page templates')
  generated=contract['projectRoot']+'/src/selected-template.ts';rel=os.path.relpath(template['source'],contract['projectRoot']+'/src').replace(os.sep,'/');expected_entry="export { default } from './"+rel+"'\n"
  if safe_path(output,generated).read_text()!=expected_entry:errors.append('Generated template entry changed')
  if digest(output/'page-config.schema.json')!=digest(safe_path(root,template['configSchema'])):errors.append('Configuration schema changed')
  errors.extend(schema_errors(config,load_json(safe_path(root,template['configSchema']))))
  ids=[n['id'] for n in config.get('nodes',[])]
  if len(ids)!=len(set(ids)):errors.append('Topology node IDs must be unique')
  if any(e['source'] not in ids or e['target'] not in ids for e in config.get('edges',[])):errors.append('Topology edges reference missing nodes')
 except (ValueError,KeyError,OSError,TypeError) as e:errors.append(str(e))
 return errors

def main():
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('output',type=Path);p.add_argument('assets_root',type=Path);p.add_argument('--scope',choices=['full','selected'],default='full');a=p.parse_args();errors=validate(a.output.resolve(),a.assets_root.resolve(),a.scope)
 if errors:print('\n'.join('ERROR: '+e for e in errors));return 1
 print('Prototype source locks, bundles and configuration are valid. Browser interactions are a separate check.');return 0
if __name__=='__main__':raise SystemExit(main())

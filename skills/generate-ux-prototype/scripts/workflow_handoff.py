"""Validate optional cross-stage evidence before a prototype is written (stdlib only)."""
import hashlib,json
from pathlib import Path

def digest(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def read_reference(base,reference):
    if not isinstance(reference,dict) or not isinstance(reference.get('path'),str) or not reference['path'].strip():
        raise ValueError('Reference requires a nonempty path')
    path=(base/reference['path']).resolve()
    if not path.is_file() or reference.get('sha256')!=digest(path):raise ValueError('Missing or changed handoff input: '+str(path))
    return path

def ids_in(value):
    if isinstance(value,dict):
        result={value['id']} if isinstance(value.get('id'),str) else set()
        for v in value.values():result|=ids_in(v)
        return result
    if isinstance(value,list):
        result=set()
        for v in value:result|=ids_in(v)
        return result
    return set()

def load_handoff(plan_path,plan):
    if not plan.get('handoff'):return None
    path=read_reference(Path(plan_path).resolve().parent,plan['handoff'])
    data=json.loads(path.read_text())
    from validate_source_draft import schema_errors
    schema=json.loads((Path(__file__).resolve().parents[1]/'references/task-handoff.schema.json').read_text())
    errors=schema_errors(data,schema,'handoff')
    if errors:raise ValueError('; '.join(errors))
    if data['selectedDirectionId']!=plan['directionId']:raise ValueError('Handoff direction differs from plan')
    docs={};references=[]
    for item in data['inputs']:
        source=read_reference(path.parent,item)
        references.append({**item,'path':str(source)})
        if item['kind'] in ['requirements','insights']:
            if item['kind'] in docs:raise ValueError('Only one current artifact per analysis stage')
            doc=json.loads(source.read_text())
            if doc.get('projectId')!=data['projectId']:raise ValueError('Upstream projectId differs')
            docs[item['kind']]=doc
    if data['mode']=='staged' and not {'requirements','insights'}<=docs.keys():raise ValueError('Staged handoff requires requirements and insights')
    if 'insights' in docs:
        insight=docs['insights'];selected=data['selectedDirectionId'];directions=insight.get('designDirections',[])
        direction_ids=[d['id'] for d in directions]
        if len(direction_ids)!=len(set(direction_ids)):raise ValueError('Duplicate direction IDs')
        if insight.get('selectedDirectionId')!=selected:raise ValueError('Selected upstream direction differs')
        chosen=next((d for d in directions if d['id']==selected),None)
        if not chosen or chosen.get('status') not in ['selected','approved']:raise ValueError('Upstream direction is not selected')
        if 'requirements' in docs:
            missing=set(chosen.get('requirementIds',[]))-ids_in(docs['requirements'])
            if missing:raise ValueError('Unknown requirement IDs: '+', '.join(sorted(missing)))
    if data.get('userConfirmation',{}).get('status')=='confirmed' and not data['userConfirmation'].get('reference','').strip():
        raise ValueError('User confirmation needs an evidence reference')
    return {'source':str(path),'sha256':digest(path),'data':data,'inputs':references}

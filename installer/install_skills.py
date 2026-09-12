#!/usr/bin/env python3
"""Install four self-contained Skills and bind them to this movable source package."""
import argparse,json,shutil,tempfile
from pathlib import Path

PACKAGE=Path(__file__).resolve().parents[1]

def install(destination, rebind=False):
    catalog=json.loads((PACKAGE/'skill-catalog.json').read_text())
    destination=Path(destination).expanduser().resolve()
    ids=[s['id'] for s in catalog['skills']]
    if destination==PACKAGE/'skills':
        raise ValueError('Choose a separate installed-skills directory')
    for sid in ids:
        target=destination/sid
        if rebind:
            if not (target/'SKILL.md').is_file():raise ValueError('Missing installed Skill: '+sid)
            binding=target/'agents/package-location.json'
            if not binding.is_file():raise ValueError('No V1.5 binding; install this version in a clean destination first')
            previous=json.loads(binding.read_text())
            if previous.get('packageId')!=catalog['packageId'] or previous.get('packageVersion')!=catalog['packageVersion']:
                raise ValueError('Rebind only relocates the same version; install the new version first')
        elif target.exists():raise ValueError('Move old Skill outside destination before installing: '+str(target))
    binding={'packageId':catalog['packageId'],'packageVersion':catalog['packageVersion'],'packageRoot':str(PACKAGE),'entry':'AI-ENTRY.md','catalog':'asset-catalog.json'}
    destination.mkdir(parents=True,exist_ok=True)
    if rebind:
        for sid in ids:(destination/sid/'agents/package-location.json').write_text(json.dumps(binding,ensure_ascii=False,indent=2)+'\n')
    else:
        with tempfile.TemporaryDirectory(prefix='.gdesign-install-',dir=destination) as temp:
            stage=Path(temp)
            for sid in ids:
                shutil.copytree(PACKAGE/'skills'/sid,stage/sid,ignore=shutil.ignore_patterns('__pycache__','*.pyc','.DS_Store'))
                (stage/sid/'agents/package-location.json').write_text(json.dumps(binding,ensure_ascii=False,indent=2)+'\n')
            written=[]
            try:
                for sid in ids:
                    (stage/sid).rename(destination/sid);written.append(destination/sid)
            except Exception:
                for target in written:shutil.rmtree(target)
                raise
    return {'skills':ids,'packageRoot':str(PACKAGE),'destination':str(destination),'rebound':rebind}

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('destination',type=Path);p.add_argument('--rebind',action='store_true');a=p.parse_args()
    try:print(json.dumps(install(a.destination,a.rebind),ensure_ascii=False,indent=2))
    except (ValueError,OSError) as e:p.exit(1,str(e)+'\n')

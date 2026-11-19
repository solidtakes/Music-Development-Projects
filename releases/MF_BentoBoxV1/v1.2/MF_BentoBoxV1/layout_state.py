"""Small, fail-closed, assignment-only persistence for MF BentoBoxV1.

No Live parameter values, ring states, device IDs, Song data or MIDI mappings are
serialized. Data lives outside the install folder. This module is pure Python;
importing it never writes to disk.
"""
import json
import os
import shutil
import tempfile
from pathlib import Path

SCHEMA = 1
FACTORY_LAYOUT = {
    'bank1_columns': [0, 2, 4, 3],  # Mixer / FX / VU / Master
    'bank2_buttons': ['Clip Launch'] * 4,
    'bank2_rotaries': ['Device Control', 'Device Control', 'Sends', 'Volume'],
}
BANK1_MAX = {0: 1, 2: 2, 3: 1, 4: 2, 5: 4}
BANK2_BUTTONS = ('Blank', 'Clip Launch', 'Arm', 'Solo', 'Mute', 'Stop')
BANK2_UNIQUE = ('Arm', 'Solo', 'Mute', 'Stop')
BANK2_ROTARIES = ('Volume', 'Pan', 'Sends', 'Device Control')


def validated_layout(raw):
    """Copy validated assignments; reject malformed/unknown content entirely."""
    if not isinstance(raw, dict) or set(raw) != set(FACTORY_LAYOUT):
        raise ValueError('layout keys invalid')
    b1 = raw['bank1_columns']
    buttons = raw['bank2_buttons']
    rotaries = raw['bank2_rotaries']
    if any(not isinstance(a, list) or len(a) != 4 for a in (b1, buttons, rotaries)):
        raise ValueError('layout needs four entries per bank/row')
    if any(type(v) is not int or not 0 <= v <= 8 for v in b1):
        raise ValueError('unknown Bank 1 module')
    if any(b1.count(k) > cap for k, cap in BANK1_MAX.items()):
        raise ValueError('duplicate exclusive Bank 1 module')
    if any(type(v) is not str or v not in BANK2_BUTTONS for v in buttons):
        raise ValueError('unknown Bank 2 push module')
    if any(buttons.count(k) > 1 for k in BANK2_UNIQUE):
        raise ValueError('duplicate exclusive Bank 2 module')
    if any(type(v) is not str or v not in BANK2_ROTARIES for v in rotaries):
        raise ValueError('unknown Bank 2 rotary module')
    return {
        'bank1_columns': list(b1),
        'bank2_buttons': list(buttons),
        'bank2_rotaries': list(rotaries),
    }


def state_home():
    override = os.environ.get('MF_BENTOBOX_STATE_DIR')
    if override:
        return Path(override).expanduser()
    if os.name == 'nt':
        parent = os.environ.get('APPDATA') or os.environ.get('LOCALAPPDATA')
        return Path(parent) / 'MF_BentoBoxV1' if parent else Path.home() / 'MF_BentoBoxV1'
    if os.sys.platform == 'darwin':
        return Path.home() / 'Library' / 'Application Support' / 'MF_BentoBoxV1'
    return Path(os.environ.get('XDG_STATE_HOME', Path.home() / '.local' / 'state')) / 'MF_BentoBoxV1'


class LayoutStore(object):
    def __init__(self, home=None):
        self.directory = Path(home) if home is not None else state_home()
        self.path = self.directory / 'layouts-v1.json'
        self.backup = self.directory / 'layouts-v1.json.bak'

    @staticmethod
    def _verify(raw):
        if not isinstance(raw, dict) or set(raw) != {'schema', 'last_used', 'presets'}:
            raise ValueError('unsupported state document')
        if type(raw['schema']) is not int or raw['schema'] != SCHEMA:
            raise ValueError('unsupported schema')
        last = raw['last_used']
        if last is not None:
            last = validated_layout(last)
        presets = raw['presets']
        if not isinstance(presets, dict) or any(str(k) not in ('1','2','3','4') for k in presets):
            raise ValueError('unsupported preset slot')
        return {'schema': SCHEMA, 'last_used': last,
                'presets': {str(k): validated_layout(v) for k, v in presets.items()}}

    @staticmethod
    def blank():
        return {'schema': SCHEMA, 'last_used': None, 'presets': {}}

    def load(self):
        # Backup is only used when an existing primary is damaged. New installs
        # are not treated as corrupt. Never overwrite unreadable originals.
        for path in (self.path, self.backup):
            if not path.is_file():
                continue
            try:
                with path.open('r', encoding='utf-8') as handle:
                    return self._verify(json.load(handle))
            except (OSError, ValueError, TypeError, UnicodeError):
                continue
        return self.blank()

    def save(self, document):
        doc = self._verify(document)
        self.directory.mkdir(parents=True, exist_ok=True)
        # Prevent valid backup from being replaced by a corrupt primary.
        if self.path.is_file():
            try:
                with self.path.open('r', encoding='utf-8') as handle:
                    self._verify(json.load(handle))
            except (OSError, ValueError, TypeError, UnicodeError):
                # Do not overwrite a damaged state file without preserving a
                # copy. If quarantine fails, fail closed rather than destroy
                # the user's only copy of the damaged document.
                quarantine = self.directory / 'layouts-v1.corrupt.json'
                index = 0
                while quarantine.exists():
                    index += 1
                    quarantine = self.directory / ('layouts-v1.corrupt-{}.json'.format(index))
                os.replace(self.path, quarantine)
            else:
                shutil.copyfile(str(self.path), str(self.backup))
        handle_id = None
        temp_name = None
        try:
            handle_id, temp_name = tempfile.mkstemp(prefix='layouts-', suffix='.tmp', dir=str(self.directory))
            with os.fdopen(handle_id, 'w', encoding='utf-8') as stream:
                handle_id = None
                json.dump(doc, stream, sort_keys=True, indent=2)
                stream.write('\n')
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(temp_name, self.path)
            temp_name = None
        finally:
            if handle_id is not None:
                os.close(handle_id)
            if temp_name is not None:
                try:
                    os.unlink(temp_name)
                except OSError:
                    pass
        return doc

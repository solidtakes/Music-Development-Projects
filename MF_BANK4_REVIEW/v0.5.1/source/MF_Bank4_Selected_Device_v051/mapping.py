"""Proposed v0.5.1 mappings. Resolve names at runtime; never guess indexes."""
VERSION = '0.5.1 Rebuild Candidate'
FIRST_CC = 48
RGB_STATUS = 0xBA  # human channel 11
RING_STATUS = 0xBB  # human channel 12
# Each tuple contains explicit alternative host names for one encoder slot.
EQ = tuple((('{}'.format(i) + ' Frequency A',),
            ('{}'.format(i) + ' Gain A',)) for i in range(1, 9))
EQ = tuple(slot for pair in EQ for slot in pair)
FILTER = (
    ('Frequency',), ('Resonance',), ('Filter Type',),
    ('Filter Circuit - LP/HP', 'Filter Circuit'), ('Drive',),
    ('LFO Amount',), ('LFO Frequency', 'LFO Freq', 'LFO Rate'),
    ('Env. Modulation', 'Env Modulation', 'Env Amount'),
) + ((),) * 8
COMPRESSOR = (
    ('Threshold',), ('Ratio',), ('Attack',), ('Release',),
    ('Knee',), ('Makeup',), ('Dry/Wet',), ('Output Gain', 'Output'),
    ('Auto Release',), ('LookAhead', 'Lookahead'),
    ('Model',), ('Envelope',), ('S/C EQ On',),
    ('S/C EQ Freq',), ('S/C EQ Gain',), ('S/C Listen',),
)
PROFILES = {
    'Eq8': (EQ, (68,) * 16),
    'AutoFilter': (FILTER, (108,) * 8 + (0,) * 8),
    'Compressor2': (COMPRESSOR, (72,) * 16),
    'Compressor': (COMPRESSOR, (72,) * 16),
}

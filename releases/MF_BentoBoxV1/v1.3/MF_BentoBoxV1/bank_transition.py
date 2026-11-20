"""Bank-selection LED transition preview integrated as a guarded host overlay.

Requires the Twister's documented Ch4 CC0..CC3 bank-change reports. The
hardware may vary by firmware; never synthesizes a bank-change command and
never reconfigures the Twister. Bank 4 is intentionally unchanged.
"""
import time


class BankTransitionMixin:
    BANK_ANIMATION_SECONDS = 1.85
    BANK_ANIMATION_FRAME_TICKS = 1
    BANK_ANIMATION_LABELS = ('SEL','4TRK','SEQ')
    BANK_ANIMATION_GLYPHS = {
        'S': ('.###','#...','.##.','###.'),
        'E': ('####','#...','###.','####'),
        'L': ('#...','#...','#...','####'),
        '4': ('#..#','#..#','####','...#'),
        'T': ('####','.##.','.##.','.##.'),
        'R': ('###.','#..#','###.','#..#'),
        'K': ('#..#','#.#.','##..','#..#'),
        'Q': ('.##.','#..#','#.#.','.###'),
    }

    def _bank_animation_initialize(self):
        self._bank_animation_selected = None
        self._bank_animation_active = None
        self._bank_animation_started = 0.0
        self._bank_animation_tick_pending = False
        self._bank_animation_native_feedback = {}
        self._bank_animation_last_frame = None

    def _bank_animation_suppress_for_key(self, status, cc):
        if status not in (0xBA,0xBB) or not 0 <= cc < 64:
            return False
        return (self._bank_animation_active is not None and
                cc // 16 == self._bank_animation_active)

    def _bank_change_value(self, bank, value):
        if self._three_bank_closed or int(value) <= 0:
            return
        if bank >= len(self.BANK_ANIMATION_LABELS):
            self._bank_animation_selected = bank
            self._bank_animation_active = None
            return
        if bank == self._bank_animation_selected:
            return
        self._bank_animation_selected = bank
        self._bank_animation_active = bank
        self._bank_animation_started = time.monotonic()
        self._bank_animation_last_frame = None
        self.show_message('BentoBox: switching to Bank {} {}'.format(
            bank+1,self.BANK_ANIMATION_LABELS[bank]))
        self._bank_animation_paint(now=self._bank_animation_started)
        self._bank_animation_schedule_tick()

    def _bank_animation_schedule_tick(self):
        if (self._bank_animation_active is not None and
                not self._three_bank_closed and not self._bank_animation_tick_pending):
            self._bank_animation_tick_pending = True
            self.schedule_message(self.BANK_ANIMATION_FRAME_TICKS, self._bank_animation_tick)

    def _bank_animation_tick(self):
        self._bank_animation_tick_pending = False
        if self._three_bank_closed or self._bank_animation_active is None:
            return
        now = time.monotonic()
        self._bank_animation_paint(now)
        if now - self._bank_animation_started >= self.BANK_ANIMATION_SECONDS:
            self._bank_animation_finish()
        else:
            self._bank_animation_schedule_tick()

    def _bank_animation_paint(self, now):
        bank = self._bank_animation_active
        if bank is None or self._three_bank_closed:
            return
        from .Bank1_SelectedTrack import MidiFighterTwisterCustom
        elapsed = max(0.0, min(self.BANK_ANIMATION_SECONDS, now-self._bank_animation_started))
        title = self.BANK_ANIMATION_LABELS[bank]
        slot = self.BANK_ANIMATION_SECONDS / len(title)
        index = min(len(title)-1, int(elapsed / slot))
        progress = max(0.0, min(1.0, (elapsed-index*slot) / slot))
        # Each letter scrolls in, holds, then clears for the next. Final
        # letter never scrolls out and remains lit until the ready handoff.
        if index == len(title)-1:
            offset = min(0,int(-4+4*min(1.0,progress/.62)))
        elif progress < .35:
            offset = min(0,int(-4+4*progress/.35))
        elif progress < .67:
            offset = 0
        else:
            offset = min(4,int(4*(progress-.67)/.33))
        white = max(0,min(127,int(127*min(1.0, progress/.85))))
        if index == len(title)-1 and elapsed >= self.BANK_ANIMATION_SECONDS:
            offset, white = 0, 127
        frame = (bank, index, offset, white)
        if self._bank_animation_last_frame == frame:
            return
        self._bank_animation_last_frame = frame
        color = (self.LED_COLORS['yellow'],self.LED_COLORS['light_blue'],
                 self.LED_COLORS['purple'])[bank]
        glyph = self.BANK_ANIMATION_GLYPHS[title[index]]
        for row in range(4):
            for col in range(4):
                source = col-offset
                active = 0 <= source < 4 and glyph[row][source] == '#'
                cc = bank*16+row*4+col
                # RGB and ring are updated together, never an end-of-animation
                # all-black clear. Native LED data is cached during animation.
                MidiFighterTwisterCustom._send_midi(self,(0xBA,cc,color if active else 0))
                MidiFighterTwisterCustom._send_midi(self,(0xBB,cc,white if active else 0))

    def _bank_animation_finish(self):
        bank = self._bank_animation_active
        if bank is None or self._three_bank_closed:
            return
        from .Bank1_SelectedTrack import MidiFighterTwisterCustom
        # Do not send blank values for LEDs whose native state has not yet
        # been reported. Their final letter pixel stays until native output.
        self._bank_animation_active = None
        for status in (0xBA,0xBB):
            for local in range(16):
                key = (status, bank*16+local)
                msg = self._bank_animation_native_feedback.get(key)
                if msg is not None:
                    MidiFighterTwisterCustom._send_midi(self,msg)
        # The global layers own some rows and may already have active colors.
        if self._transport_visible:
            self._render_transport_feedback(force=True)
        if self._edit_visible:
            self._edit_render_feedback(force=True)
        if self._preset_overlay_active():
            self._render_preset_feedback(force=True)
        if self._edit_visible or self._transport_visible:
            self._edit_announce()


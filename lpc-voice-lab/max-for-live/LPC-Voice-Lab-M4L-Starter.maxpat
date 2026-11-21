{
  "patcher": {
    "fileversion": 1,
    "appversion": {
      "major": 9,
      "minor": 0,
      "revision": 0,
      "architecture": "x64",
      "modernui": 1
    },
    "classnamespace": "box",
    "rect": [
      80,
      80,
      1100,
      1020
    ],
    "bglocked": 0,
    "openinpresentation": 0,
    "default_fontsize": 12,
    "default_fontface": 0,
    "default_fontname": "Arial",
    "gridonopen": 1,
    "gridsize": [
      15,
      15
    ],
    "toolbarvisible": 1,
    "boxes": [
      {
        "box": {
          "id": "obj-1",
          "maxclass": "comment",
          "text": "LPC VOICE LAB — MAX FOR LIVE VOCODER PROTOTYPE",
          "patching_rect": [
            40,
            22,
            850,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-2",
          "maxclass": "comment",
          "text": "Stereo input: VOICE = LEFT | CARRIER = RIGHT. 8-band MSP vocoder, NOT the LPC engine.",
          "patching_rect": [
            40,
            50,
            930,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-3",
          "maxclass": "comment",
          "text": "Route two tracks into a stereo bus: voice hard-left, synth hard-right. Insert this M4L audio effect on bus.",
          "patching_rect": [
            40,
            75,
            950,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-4",
          "maxclass": "newobj",
          "text": "plugin~",
          "patching_rect": [
            40,
            115,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-5",
          "maxclass": "newobj",
          "text": "*~ 1.",
          "patching_rect": [
            40,
            155,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-6",
          "maxclass": "newobj",
          "text": "*~ 1.",
          "patching_rect": [
            235,
            155,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-7",
          "maxclass": "comment",
          "text": "Mic Input",
          "patching_rect": [
            40,
            212,
            260,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-8",
          "maxclass": "live.dial",
          "patching_rect": [
            40,
            237,
            54,
            54
          ],
          "parameter_enable": 1,
          "parameter_mmin": 0,
          "parameter_mmax": 200,
          "parameter_initial": [
            1,
            100
          ],
          "parameter_initial_enable": 1,
          "parameter_longname": "Mic Input",
          "parameter_shortname": "Mic Input"
        }
      },
      {
        "box": {
          "id": "obj-9",
          "maxclass": "newobj",
          "text": "* 0.01",
          "patching_rect": [
            105,
            247,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-10",
          "maxclass": "newobj",
          "text": "loadmess 100",
          "patching_rect": [
            186,
            247,
            96,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-11",
          "maxclass": "comment",
          "text": "Carrier Input",
          "patching_rect": [
            250,
            212,
            260,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-12",
          "maxclass": "live.dial",
          "patching_rect": [
            250,
            237,
            54,
            54
          ],
          "parameter_enable": 1,
          "parameter_mmin": 0,
          "parameter_mmax": 200,
          "parameter_initial": [
            1,
            100
          ],
          "parameter_initial_enable": 1,
          "parameter_longname": "Carrier Input",
          "parameter_shortname": "Carrier Input"
        }
      },
      {
        "box": {
          "id": "obj-13",
          "maxclass": "newobj",
          "text": "* 0.01",
          "patching_rect": [
            315,
            247,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-14",
          "maxclass": "newobj",
          "text": "loadmess 100",
          "patching_rect": [
            396,
            247,
            96,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-15",
          "maxclass": "comment",
          "text": "Eight log-spaced formant bands. Filtered voice amplitude drives matching carrier band.",
          "patching_rect": [
            40,
            346,
            800,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-16",
          "maxclass": "comment",
          "text": "BAND 1 — 200 Hz",
          "patching_rect": [
            40,
            387,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-17",
          "maxclass": "newobj",
          "text": "reson~ 1. 200 1.65",
          "patching_rect": [
            40,
            415,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-18",
          "maxclass": "newobj",
          "text": "reson~ 1. 200 1.65",
          "patching_rect": [
            40,
            445,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-19",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            160,
            415,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-20",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            160,
            444,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-21",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            155,
            478,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-22",
          "maxclass": "comment",
          "text": "BAND 2 — 325 Hz",
          "patching_rect": [
            284,
            387,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-23",
          "maxclass": "newobj",
          "text": "reson~ 1. 325 1.65",
          "patching_rect": [
            284,
            415,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-24",
          "maxclass": "newobj",
          "text": "reson~ 1. 325 1.65",
          "patching_rect": [
            284,
            445,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-25",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            404,
            415,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-26",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            404,
            444,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-27",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            399,
            478,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-28",
          "maxclass": "comment",
          "text": "BAND 3 — 520 Hz",
          "patching_rect": [
            528,
            387,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-29",
          "maxclass": "newobj",
          "text": "reson~ 1. 520 1.65",
          "patching_rect": [
            528,
            415,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-30",
          "maxclass": "newobj",
          "text": "reson~ 1. 520 1.65",
          "patching_rect": [
            528,
            445,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-31",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            648,
            415,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-32",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            648,
            444,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-33",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            643,
            478,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-34",
          "maxclass": "comment",
          "text": "BAND 4 — 820 Hz",
          "patching_rect": [
            772,
            387,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-35",
          "maxclass": "newobj",
          "text": "reson~ 1. 820 1.65",
          "patching_rect": [
            772,
            415,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-36",
          "maxclass": "newobj",
          "text": "reson~ 1. 820 1.65",
          "patching_rect": [
            772,
            445,
            138,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-37",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            892,
            415,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-38",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            892,
            444,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-39",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            887,
            478,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-40",
          "maxclass": "comment",
          "text": "BAND 5 — 1310 Hz",
          "patching_rect": [
            40,
            550,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-41",
          "maxclass": "newobj",
          "text": "reson~ 1. 1310 1.65",
          "patching_rect": [
            40,
            578,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-42",
          "maxclass": "newobj",
          "text": "reson~ 1. 1310 1.65",
          "patching_rect": [
            40,
            608,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-43",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            160,
            578,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-44",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            160,
            607,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-45",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            155,
            641,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-46",
          "maxclass": "comment",
          "text": "BAND 6 — 2100 Hz",
          "patching_rect": [
            284,
            550,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-47",
          "maxclass": "newobj",
          "text": "reson~ 1. 2100 1.65",
          "patching_rect": [
            284,
            578,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-48",
          "maxclass": "newobj",
          "text": "reson~ 1. 2100 1.65",
          "patching_rect": [
            284,
            608,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-49",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            404,
            578,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-50",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            404,
            607,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-51",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            399,
            641,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-52",
          "maxclass": "comment",
          "text": "BAND 7 — 3390 Hz",
          "patching_rect": [
            528,
            550,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-53",
          "maxclass": "newobj",
          "text": "reson~ 1. 3390 1.65",
          "patching_rect": [
            528,
            578,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-54",
          "maxclass": "newobj",
          "text": "reson~ 1. 3390 1.65",
          "patching_rect": [
            528,
            608,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-55",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            648,
            578,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-56",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            648,
            607,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-57",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            643,
            641,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-58",
          "maxclass": "comment",
          "text": "BAND 8 — 5460 Hz",
          "patching_rect": [
            772,
            550,
            200,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-59",
          "maxclass": "newobj",
          "text": "reson~ 1. 5460 1.65",
          "patching_rect": [
            772,
            578,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-60",
          "maxclass": "newobj",
          "text": "reson~ 1. 5460 1.65",
          "patching_rect": [
            772,
            608,
            145,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-61",
          "maxclass": "newobj",
          "text": "abs~",
          "patching_rect": [
            892,
            578,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-62",
          "maxclass": "newobj",
          "text": "slide~ 64 800",
          "patching_rect": [
            892,
            607,
            103,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-63",
          "maxclass": "newobj",
          "text": "*~",
          "patching_rect": [
            887,
            641,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-64",
          "maxclass": "newobj",
          "text": "+~",
          "patching_rect": [
            40,
            792,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-65",
          "maxclass": "newobj",
          "text": "+~",
          "patching_rect": [
            174,
            792,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-66",
          "maxclass": "newobj",
          "text": "+~",
          "patching_rect": [
            308,
            792,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-67",
          "maxclass": "newobj",
          "text": "+~",
          "patching_rect": [
            442,
            792,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-68",
          "maxclass": "newobj",
          "text": "+~",
          "patching_rect": [
            576,
            792,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-69",
          "maxclass": "newobj",
          "text": "+~",
          "patching_rect": [
            710,
            792,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-70",
          "maxclass": "newobj",
          "text": "+~",
          "patching_rect": [
            844,
            792,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-71",
          "maxclass": "newobj",
          "text": "*~ 0.95",
          "patching_rect": [
            380,
            840,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-72",
          "maxclass": "newobj",
          "text": "clip~ -0.94 0.94",
          "patching_rect": [
            516,
            840,
            124,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-73",
          "maxclass": "newobj",
          "text": "*~ 1.",
          "patching_rect": [
            715,
            840,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-74",
          "maxclass": "newobj",
          "text": "plugout~",
          "patching_rect": [
            880,
            840,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-75",
          "maxclass": "comment",
          "text": "Effect Output",
          "patching_rect": [
            790,
            212,
            260,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-76",
          "maxclass": "live.dial",
          "patching_rect": [
            790,
            237,
            54,
            54
          ],
          "parameter_enable": 1,
          "parameter_mmin": 0,
          "parameter_mmax": 200,
          "parameter_initial": [
            1,
            100
          ],
          "parameter_initial_enable": 1,
          "parameter_longname": "Effect Output",
          "parameter_shortname": "Effect Output"
        }
      },
      {
        "box": {
          "id": "obj-77",
          "maxclass": "newobj",
          "text": "* 0.01",
          "patching_rect": [
            855,
            247,
            70,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-78",
          "maxclass": "newobj",
          "text": "loadmess 100",
          "patching_rect": [
            936,
            247,
            96,
            22
          ]
        }
      },
      {
        "box": {
          "id": "obj-79",
          "maxclass": "comment",
          "text": "Save As Max Audio Effect (.amxd) from Max for Live editor after opening this .maxpat source.",
          "patching_rect": [
            40,
            930,
            970,
            20
          ]
        }
      },
      {
        "box": {
          "id": "obj-80",
          "maxclass": "comment",
          "text": "NOTE: This M4L proof-of-concept cannot match the IVL/MDA LPC core's sound; dedicated LPC port is future work.",
          "patching_rect": [
            40,
            956,
            990,
            20
          ]
        }
      }
    ],
    "lines": [
      {
        "patchline": {
          "source": [
            "obj-4",
            0
          ],
          "destination": [
            "obj-5",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-4",
            1
          ],
          "destination": [
            "obj-6",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-8",
            0
          ],
          "destination": [
            "obj-9",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-9",
            0
          ],
          "destination": [
            "obj-5",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-10",
            0
          ],
          "destination": [
            "obj-8",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-12",
            0
          ],
          "destination": [
            "obj-13",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-13",
            0
          ],
          "destination": [
            "obj-6",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-14",
            0
          ],
          "destination": [
            "obj-12",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-17",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-18",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-17",
            0
          ],
          "destination": [
            "obj-19",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-19",
            0
          ],
          "destination": [
            "obj-20",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-18",
            0
          ],
          "destination": [
            "obj-21",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-20",
            0
          ],
          "destination": [
            "obj-21",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-23",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-24",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-23",
            0
          ],
          "destination": [
            "obj-25",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-25",
            0
          ],
          "destination": [
            "obj-26",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-24",
            0
          ],
          "destination": [
            "obj-27",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-26",
            0
          ],
          "destination": [
            "obj-27",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-29",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-30",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-29",
            0
          ],
          "destination": [
            "obj-31",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-31",
            0
          ],
          "destination": [
            "obj-32",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-30",
            0
          ],
          "destination": [
            "obj-33",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-32",
            0
          ],
          "destination": [
            "obj-33",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-35",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-36",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-35",
            0
          ],
          "destination": [
            "obj-37",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-37",
            0
          ],
          "destination": [
            "obj-38",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-36",
            0
          ],
          "destination": [
            "obj-39",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-38",
            0
          ],
          "destination": [
            "obj-39",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-41",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-42",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-41",
            0
          ],
          "destination": [
            "obj-43",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-43",
            0
          ],
          "destination": [
            "obj-44",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-42",
            0
          ],
          "destination": [
            "obj-45",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-44",
            0
          ],
          "destination": [
            "obj-45",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-47",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-48",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-47",
            0
          ],
          "destination": [
            "obj-49",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-49",
            0
          ],
          "destination": [
            "obj-50",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-48",
            0
          ],
          "destination": [
            "obj-51",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-50",
            0
          ],
          "destination": [
            "obj-51",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-53",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-54",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-53",
            0
          ],
          "destination": [
            "obj-55",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-55",
            0
          ],
          "destination": [
            "obj-56",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-54",
            0
          ],
          "destination": [
            "obj-57",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-56",
            0
          ],
          "destination": [
            "obj-57",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-5",
            0
          ],
          "destination": [
            "obj-59",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-6",
            0
          ],
          "destination": [
            "obj-60",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-59",
            0
          ],
          "destination": [
            "obj-61",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-61",
            0
          ],
          "destination": [
            "obj-62",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-60",
            0
          ],
          "destination": [
            "obj-63",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-62",
            0
          ],
          "destination": [
            "obj-63",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-21",
            0
          ],
          "destination": [
            "obj-64",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-27",
            0
          ],
          "destination": [
            "obj-64",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-64",
            0
          ],
          "destination": [
            "obj-65",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-33",
            0
          ],
          "destination": [
            "obj-65",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-65",
            0
          ],
          "destination": [
            "obj-66",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-39",
            0
          ],
          "destination": [
            "obj-66",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-66",
            0
          ],
          "destination": [
            "obj-67",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-45",
            0
          ],
          "destination": [
            "obj-67",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-67",
            0
          ],
          "destination": [
            "obj-68",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-51",
            0
          ],
          "destination": [
            "obj-68",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-68",
            0
          ],
          "destination": [
            "obj-69",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-57",
            0
          ],
          "destination": [
            "obj-69",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-69",
            0
          ],
          "destination": [
            "obj-70",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-63",
            0
          ],
          "destination": [
            "obj-70",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-70",
            0
          ],
          "destination": [
            "obj-71",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-71",
            0
          ],
          "destination": [
            "obj-72",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-72",
            0
          ],
          "destination": [
            "obj-73",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-73",
            0
          ],
          "destination": [
            "obj-74",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-73",
            0
          ],
          "destination": [
            "obj-74",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-76",
            0
          ],
          "destination": [
            "obj-77",
            0
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-77",
            0
          ],
          "destination": [
            "obj-73",
            1
          ]
        }
      },
      {
        "patchline": {
          "source": [
            "obj-78",
            0
          ],
          "destination": [
            "obj-76",
            0
          ]
        }
      }
    ]
  }
}
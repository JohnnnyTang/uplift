# Combined 6G + 6H fit inspection

Captured after rebasing 6H onto main 9e3c713 (merged 6G), using installed Chrome
157.0.8103.79 / WebGPU at device scale factor 1. The available native adapter reports
Intel, architecture `xe-2lpg`; device and description strings are empty.

Both lessons were inspected at 1366×768 and 2560×1440. Each pair shows the settled
scene and the entrance frozen at 6200 ms, near the lift's 3% overshoot peak. The
actual peak screenshots show no clipped block, page, navigation or controls. Desk
objects remain outside the reading/control surfaces. No horizontal overflow was
reported in any of the four combinations.

`settled-bounds.json` records the existing geometry hook's settled-height hulls.
That hook does not include the animated body's height scale, so **peak clearance is
a visual inspection, not a claimed numeric peak bounding-box measurement**.

| Lesson  | Viewport  | Settled hull top | Settled hull bottom |
| ------- | --------- | ---------------: | ------------------: |
| Glacial | 1366×768  |        153.31 px |           309.33 px |
| Plates  | 1366×768  |        105.65 px |           439.64 px |
| Glacial | 2560×1440 |        227.68 px |           546.97 px |
| Plates  | 2560×1440 |         91.23 px |           831.19 px |

No additional fit or geometry adjustment was needed. The merged desk/fit options,
flap-state flush, both sessions' decisions and acceptance notes remain intact.

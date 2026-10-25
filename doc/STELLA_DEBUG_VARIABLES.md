## Scanline overflow breakpoint

Enter this command in the Stella debugger console to break as soon as the
current frame exceeds the normal 262-scanline limit:

```text
breakif {_scan > #262}

breakIf { _scanEnd != #262 }
```

This is useful when testing bank transitions and other frame-timing changes.
It detects frames longer than 262 scanlines; it does not detect short frames.
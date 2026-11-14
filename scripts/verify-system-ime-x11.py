#!/usr/bin/env python3
"""Send physical XTest keys to the private X server used by verify-system-ime.sh."""
import ctypes
import os
import sys
import time

x11 = ctypes.CDLL('libX11.so.6')
xtst = ctypes.CDLL('libXtst.so.6')
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XSetInputFocus.argtypes = [ctypes.c_void_p, ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong]
x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
x11.XStringToKeysym.restype = ctypes.c_ulong
x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
x11.XKeysymToKeycode.restype = ctypes.c_uint
x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]

display = x11.XOpenDisplay(os.environ['DISPLAY'].encode())
if not display:
    raise RuntimeError('cannot open isolated X display')


def code(name):
    keycode = x11.XKeysymToKeycode(display, x11.XStringToKeysym(name.encode()))
    if not keycode:
        raise RuntimeError(f'unknown key {name}')
    return keycode


try:
    if sys.argv[1] == 'focus':
        x11.XSetInputFocus(display, int(sys.argv[2], 16), 1, 0)
        x11.XSync(display, 0)
    elif sys.argv[1] == 'combo':
        modifier, action = code(sys.argv[2]), code(sys.argv[3])
        for keycode, pressed in [(modifier, 1), (action, 1), (action, 0), (modifier, 0)]:
            xtst.XTestFakeKeyEvent(display, keycode, pressed, 0)
        x11.XSync(display, 0)
    else:
        for name in sys.argv[1:]:
            keycode = code(name)
            xtst.XTestFakeKeyEvent(display, keycode, 1, 0)
            xtst.XTestFakeKeyEvent(display, keycode, 0, 0)
            x11.XSync(display, 0)
            time.sleep(0.12)
finally:
    x11.XCloseDisplay(display)

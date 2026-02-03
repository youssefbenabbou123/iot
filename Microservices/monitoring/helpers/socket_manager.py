# Global socket manager instance and asyncio loop (for emitting from threads)
socket_manager = None
_event_loop = None

def set_socket_manager(manager):
    """Set the global socket manager"""
    global socket_manager
    socket_manager = manager

def get_socket_manager():
    """Get the global socket manager"""
    return socket_manager

def set_event_loop(loop):
    """Set the asyncio event loop (main app loop) for thread-safe emit"""
    global _event_loop
    _event_loop = loop

def get_event_loop():
    """Get the asyncio event loop"""
    return _event_loop

def create_instance(c_instance):
    from .surface import PushReadOnly
    return PushReadOnly(c_instance)

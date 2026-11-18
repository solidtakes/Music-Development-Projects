from .surface import ReadOnlyProbe


def create_instance(c_instance):
    return ReadOnlyProbe(c_instance)

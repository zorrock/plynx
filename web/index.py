#!/usr/bin/env python
from web.node import *
from web.common import *
from web.graph import *
from web.resource import *
from web.user import *
from web.feedback import *
from gevent.wsgi import WSGIServer


if __name__ == "__main__":
    http_server = WSGIServer(('', 5000), app)
    http_server.serve_forever()

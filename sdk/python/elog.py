#!/usr/bin/env python3

"""
elog command-line interface to scilog
"""

import argparse
import datetime
from pathlib import Path
import urllib3

from scilog import Basesnippet, Paragraph, SciLog

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

"""
/// elog -h <hostname> [-p port] [-d subdir]
///                              Location where elogd is running
///     -l logbook               Name of logbook
///     -s                       Use SSL for communication
///     [-v]                     For verbose output
///     [-w password]            Write password defined on server
///     [-u username password]   User name and password
///     [-f <attachment>]        Up to 50 attachments
///     -a <attribute>=<value>   Up to 50 attributes
///     [-r <id>]                Reply to existing message
///     [-q]                     Quote original text on reply
///     [-e <id>]                Edit existing message
///     [-x]                     Suppress email notification
///     [-n 0|1|2]               Encoding: 0:ELcode,1:plain,2:HTML
///     -m <textfile>] | <text>

"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter, fromfile_prefix_chars='@')
    parser.add_argument("-h", "--host",
                        help="Server address")
    parser.add_argument("-d", "--dir",
                        help="Subdirectory")
    parser.add_argument("-p", "--port", type=int,
                        help="Port")
    parser.add_argument("-s", "--ssl", action='store_true',
                        help="Use SSL")
    parser.add_argument("-l", "--logbook",
                        help="Name of logbook")
    parser.add_argument("-v", "--verbose", action='store_true',
                        help="Verbose output")
    parser.add_argument("-w", "--password",
                        help="Password")
    parser.add_argument("-u", "--user",
                        help="User name and password")
    parser.add_argument("-f", "--attach", type=Path, action='append',
                        help="Attachment file (up to 50)")
    parser.add_argument("-a", "--attribute", action='append',
                        help="Attribute (up to 50). Format: attribute=value.")
    parser.add_argument("-r", "--reply-to", type=int,
                        help="Reply to ID")
    parser.add_argument("-q", "--quote", action='store_true',
                        help="Quote original text on reply")
    parser.add_argument("-e", "--edit", type=int,
                        help="Edit existing message")
    parser.add_argument("-x", "--no-notify", action='store_true',
                        help="Suppress email notification")
    parser.add_argument("-n", "--encoding", type=int, choices=[0, 1, 2],
                        help="Encoding")
    parser.add_argument("-m", "--message-file", type=Path,
                        help="Message file")
    parser.add_argument("message", nargs="?",
                        help="Message text")

    clargs = parser.parse_args()

    clargs.attribute = dict(attr.strip().split("=") for attr in clargs.attribute)
    clargs.pgroup = clargs.attribute['p-group']
    clargs.url = f"http{'s' if clargs.ssl}://{clargs.host}{':' + str(clargs.port) if clargs.port else ''}/api/v1"

    return clargs


def main():
    clargs = parse_args()

    tmp = Basesnippet()
    tmp.id = "2"

    log = SciLog(clargs.url, options={"username": "gac-x03da@psi.ch"})
    # print(log.token)
    logbooks = log.get_logbooks(ownerGroup=clargs.pgroup)
    print(logbooks)

    assert len(logbooks) == 1
    logbook = logbooks[0]
    print(logbook)

    log.select_logbook(logbook)

    begin_time = datetime.datetime.now()
    for ii in range(1000):
        log.send_message(f"<p>from python; number: {ii}</p>")
    # print(res)
    print(datetime.datetime.now() - begin_time)

    # snips = log.get_snippets(snippetType="paragraph", ownerGroup=pgroup)
    # print(snips)


if __name__ == "__main__":
    main()

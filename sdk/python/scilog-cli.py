#!/usr/bin/env python3

"""
Command-line interface to SciLog.

This script provides a command line interface to SciLog
so that we have to minimally modify our ingestion scripts.

The interface is similar to ELOG's but not fully compatible.
"""

import argparse
import datetime
from pathlib import Path
import urllib3

from scilog import Basesnippet, Paragraph, SciLog, LogbookMessage

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(formatter_class=argparse.ArgumentDefaultsHelpFormatter, fromfile_prefix_chars='@',
                                     description="Command-line interface to SciLog")
    parser.add_argument("--host",
                        help="Server address")
    parser.add_argument("-p", "--port", type=int,
                        help="Port")
    parser.add_argument("-l", "--logbook",
                        help="Name (title) of logbook. "
                             "This and the p-group attribute are used to select the logbook. "
                             "If the p-group owns only one logbook, this argument is not necessary.")
    parser.add_argument("-v", "--verbose", action='store_true',
                        help="Verbose output")
    parser.add_argument("-u", "--user",
                        help="User name (e-mail address). "
                             "The user must be in the access group of the log book. "
                             "The command line client supports only password authentication.")
    parser.add_argument("-w", "--password",
                        help="Password.")
    parser.add_argument("-g", "--group",
                        help="group like 'p12345'.")
    parser.add_argument("-f", "--attach", type=Path, action='append',
                        help="Attachment file. "
                             "Option can be repeated without limit.")
    parser.add_argument("-t", "--tag", action='append',
                        help="Tag. "
                             "Option can be repeated without limit.")
    parser.add_argument("-r", "--reply-to",
                        help="Reply to ID. Not supported.")
    parser.add_argument("-e", "--edit", type=int,
                        help="Edit existing message. Not supported.")
    parser.add_argument("-n", "--markup", type=int, choices=[0, 1, 2], default=1,
                        help="Markup style of message text: 1:plain, 2:HTML. "
                             "If plain, line breaks are marked up with <br> tags before submission.")
    parser.add_argument("-c", "--encoding", default="utf8",
                        help="Character encoding of message file (-m option). "
                             "All values supported by the Python open command are allowed. "
                             "utf8 is recommended for all new applications. "
                             "Other options: latin1, ascii, cp1252, macroman. "
                             "This option is not supported by the original elog interface.")
    parser.add_argument("-m", "--message-file", type=Path,
                        help="Message file")
    parser.add_argument("message", nargs="?",
                        help="Message text")

    clargs = parser.parse_args()

    clargs.url = f"https://{clargs.host}{':' + str(clargs.port) if clargs.port else ''}/api/v1"

    return clargs


def main():
    clargs = parse_args()

    options = {"username": clargs.user, 
               "password": clargs.password}
               
    log = SciLog(clargs.url, options=options)

    logbook_args = {"ownerGroup": clargs.group}
    if clargs.logbook:
        logbook_args["name"] = clargs.logbook

    logbooks = log.get_logbooks(**logbook_args)
    assert len(logbooks) >= 1, "no logbooks match filter criteria"
    assert len(logbooks) <= 1, "multiple logbooks match filter criteria"
    logbook = logbooks[0]
    log.select_logbook(logbook)

    msg = LogbookMessage()

    if clargs.message:
        msg.add_text(clargs.message)

    if clargs.message_file:
        with open(clargs.message_file, "rt", encoding=clargs.encoding) as f:
            message_text = f.readlines()
            if clargs.markup == 2:
                message_text = "".join(message_text)
            else:
                message_text = "<p>" + "<br>".join(message_text) + "</p>"
            msg.add_text(message_text)

    try:
        for att in clargs.attach:
            msg.add_file(att)
    except (AttributeError, TypeError):
        pass

    try:
        for tag in clargs.tag:
            msg.add_tag(tag)
    except (AttributeError, TypeError):
        pass

    if clargs.reply_to:
        msg.add_tag(f"reply-to:{clargs.reply_to}")

    log.send_logbook_message(msg)
    

if __name__ == "__main__":
    main()

from __future__ import annotations

import functools
import json
import os
import uuid
import warnings
from typing import Any, Tuple

from typeguard import typechecked

import scilog.logbook_message as lm
from .authmixin import HEADER_JSON, AuthError
from .httpclient import HttpClient
from .snippet import Basesnippet, Filesnippet, Location, Paragraph

ACLS = ["createACL", "readACL", "updateACL", "deleteACL", "shareACL", "adminACL"]


def pinned_to_logbook(logbook_keys, include_none=False):
    def pinned_to_logbook_inner(func):
        @functools.wraps(func)
        def pinned_to_logbook_call(log, *args, **kwargs):
            if not isinstance(log.logbook, Basesnippet):
                warnings.warn("No logbook selected.")
            else:
                logbook = log.logbook.to_dict(include_none=include_none)
                for key in logbook_keys:
                    if key not in kwargs:
                        if key == "parentId":
                            kwargs[key] = log.logbook.id
                        else:
                            if logbook.get(key):
                                kwargs[key] = logbook[key]
            return func(log, *args, **kwargs)

        return pinned_to_logbook_call

    return pinned_to_logbook_inner


class SciLogRestAPI(HttpClient):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)


class SciLog:
    IMAGE_TYPES = ["png", "jpg", "jpeg"]

    def __init__(self, *args, **kwargs):
        self.http_client = SciLogRestAPI(*args, **kwargs)
        self.logbook = None

    def select_logbook(self, logbook: Basesnippet):
        self.logbook = logbook

    @pinned_to_logbook(["parentId", *ACLS])
    def get_snippets(self, **kwargs):
        url = self.http_client.address + "/basesnippets"
        params = self.http_client.make_filter(where=kwargs)
        headers = HEADER_JSON.copy()
        return Paragraph.from_http_response(
            self.http_client.get_request(url, params=params, headers=headers)
        )

    @staticmethod
    def _replace_json_placeholder(snippet: dict, field: str, data: Any) -> dict:
        if not snippet.get(field):
            return snippet
        if isinstance(snippet[field], list):
            if "default" in snippet[field]:
                data = set(data) | set(group for group in snippet[field] if group)
                snippet[field] = list(data)
            return snippet

        if isinstance(snippet[field], str):
            if snippet[field] == "default":
                snippet[field] = data
            return snippet

        raise ValueError("The used placeholder type is not supported. ")

    @pinned_to_logbook(["parentId", *ACLS])
    def import_from_dict(self, snippet: dict, **kwargs):
        msg = snippet["textcontent"]
        snippet_dict = {k: v for k, v in snippet.items() if k != "textcontent"}
        for key in ACLS:
            snippet_dict = self._replace_json_placeholder(snippet_dict, key, kwargs.get(key, []))
        self.send_message(msg, **snippet_dict)

    @pinned_to_logbook(["parentId", *ACLS])
    def send_message(self, msg, **kwargs):
        url = self.http_client.address + "/basesnippets"
        snippet = Paragraph()
        snippet.import_dict(kwargs)
        snippet.textcontent = msg
        payload = snippet.to_dict(include_none=False)
        return self.post_snippet(**payload)

    @pinned_to_logbook(["parentId", *ACLS])
    def post_snippet(self, **kwargs):
        url = self.http_client.address + "/basesnippets"
        payload = kwargs
        if payload.get("files"):
            payload = self.upload_files(payload)
        return Paragraph.from_http_response(
            self.http_client.post_request(url, payload=payload, headers=HEADER_JSON)
        )

    @pinned_to_logbook(["parentId", *ACLS])
    def post_location(self, **kwargs):
        url = self.http_client.address + "/basesnippets"
        payload = kwargs
        if payload.get("files"):
            payload = self.upload_files(payload)
        return Location.from_http_response(
            self.http_client.post_request(url, payload=payload, headers=HEADER_JSON)
        )

    def upload_files(self, payload):
        for file in payload.get("files"):
            if "fileId" in file and file["fileId"] is not None:
                continue
            print("Posting from filepath:", file["filepath"])
            filesnippet = self._post_filesnippet(
                file["filepath"],
                **{
                    key: val
                    for key, val in payload.items()
                    if key
                    in ACLS + [k for k, v in Filesnippet._deprecated_by.items() if v == "ACLS"]
                },
            )
            file["fileId"] = filesnippet.id
            file["accessHash"] = filesnippet.accessHash
            file.pop("filepath")
        return payload

    @pinned_to_logbook(ACLS)
    def _post_filesnippet(self, filepath, **kwargs):
        url = self.http_client.address + "/filesnippet/files"

        file_extension = os.path.splitext(filepath)[-1]
        if not file_extension:
            raise ValueError("filepath must be pointing to a file, not a directory.")
        file_extension = file_extension[1:]

        snippet = Filesnippet()
        snippet.import_dict(kwargs)
        snippet.fileExtension = file_extension
        payload = snippet.to_dict(include_none=False)

        file_descriptor = "image" if file_extension in self.IMAGE_TYPES else "file"
        multipart_form_data = {
            "file": (
                filepath + "." + file_extension,
                open(filepath, "rb"),
                f"{file_descriptor}/{file_extension}",
            ),
            "fields": (None, json.dumps(payload)),
        }
        return Filesnippet.from_http_response(
            self.http_client.post_request(
                url, files=multipart_form_data, headers={"Accept": "application/json"}
            )
        )

    @pinned_to_logbook(ACLS)
    def post_file(self, filepath: str, **kwargs) -> Filesnippet:
        """Upload a file
        Args:
            filepath (str): Path to the file that ought to be uploaded
        Raises:
            FileNotFoundError: Raised if the file specified in filepath does not exist
            ValueError: Raised if the filepath is not pointing to a file
        Returns:
            Filesnippet: Filesnippet containing the metadata of the newly created entry
        """
        if not os.path.exists(filepath):
            raise FileNotFoundError("Specified file does not exist.")

        fsnippet = self._post_filesnippet(filepath, **kwargs)
        # ret = self._file_upload(filepath, fsnippet.id, file_extension)
        return fsnippet

    @pinned_to_logbook(ACLS)
    def append_files_to_snippet(self, snippet: Paragraph, filepaths: list, **kwargs) -> Paragraph:
        """Append files or images to an already existing snippet. Files and images will be appended following the order given in 'filepaths'.
        Args:
            snippet (Paragraph): Snippet to which the files should be appended
            filepaths (list): List of file paths pointing to the files that should be uploaded
        Returns:
            Paragraph: Updated snippet
        """
        snippet.id
        for filepath in filepaths:
            fsnippet = self.post_file(filepath)

            if not isinstance(snippet.files, list):
                snippet.files = []

            # if we reach this point, we can assume that filepath has been checked (cf. self.post_file)
            file_info, file_textcontent = self.prepare_file_content(
                filepath=filepath, fsnippet=fsnippet
            )
            snippet.textcontent += file_textcontent
            snippet.files.append(file_info)

        return self.patch_snippet(snippet)

    @typechecked
    def send_logbook_message(self, msg: lm.LogbookMessage) -> None:
        payload = msg._content.to_dict(include_none=False)
        payload["linkType"] = "paragraph"
        # FIXME the python sdk should not use the ownergroup
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self.post_snippet(**payload)

    @staticmethod
    def prepare_file_content(filepath: str, fsnippet: Filesnippet = None) -> Tuple:
        file_extension = filepath.split(".")[-1].lower()
        file_hash = str(uuid.uuid4())
        file_id = fsnippet.id if fsnippet and fsnippet.id else None
        accessHash = fsnippet.accessHash if fsnippet and fsnippet.accessHash else None

        if file_extension in SciLog.IMAGE_TYPES:
            textcontent = (
                f'<figure class="image image_resized"><img src="" title="{file_hash}"></figure>'
            )
            file_info = {
                "fileHash": file_hash,
                "filepath": filepath,
                "fileExtension": f"image/{file_extension}",
                "fileId": file_id,
                "accessHash": accessHash,
                "style": {"width": "82.25%", "height": ""},
            }

        else:
            textcontent = f'<p><a class="fileLink" target="_blank" href="file:{file_hash}">{os.path.basename(filepath)}</a></p>'
            file_info = {
                "fileHash": file_hash,
                "filepath": filepath,
                "fileExtension": f"file/{file_extension}",
                "fileId": file_id,
                "accessHash": accessHash,
            }
        return (file_info, textcontent)

    def patch_snippet(self, snippet: Paragraph, **kwargs) -> Paragraph:
        """Update (patch) snippet with given snippet.
        Args:
            snippet (Basesnippet): Snippet containing the newly updated fields
        Returns:
            Basesnippet: Updated snippet
        """
        url = self.http_client.address + "/basesnippets/" + snippet.id
        snippet.id = None
        snippet.createdAt = None
        snippet.createdBy = None
        snippet.expiresAt = None
        payload = snippet.to_dict(include_none=False)
        return Basesnippet.from_http_response(
            self.http_client.patch_request(url, payload=payload, headers=HEADER_JSON)
        )

    def get_logbooks(self, **kwargs):
        url = self.http_client.address + "/basesnippets"
        snippet = Basesnippet()
        snippet.import_dict(kwargs)
        snippet.snippetType = "logbook"
        params = self.http_client.make_filter(where=snippet.to_dict(include_none=False))
        return Basesnippet.from_http_response(
            self.http_client.get_request(url, params=params, headers=HEADER_JSON)
        )


class SciLogAuthError(AuthError):
    pass

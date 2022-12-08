import {bind, BindingScope, ContextTags, inject} from '@loopback/core';
import {EXPORT_SERVICE} from '../keys';
import {FileRepository} from '../repositories/file.repository';
import {UserProfile} from '@loopback/security';

const Mongo = require('mongodb');

interface LateXTag {
  header: string;
  footer: string;
  waitUntilRead: boolean;
  position: number;
}

@bind({
  scope: BindingScope.TRANSIENT,
  tags: {[ContextTags.KEY]: EXPORT_SERVICE},
})
export class ExportService {
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  currentDataSnippet: any;
  tableColumnsCounter = 0;
  _fileCounter = 0;
  updateFileCounter = true;
  texFile: string;
  exportDir: string;

  imagePath: string;
  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  fs: any;
  user: UserProfile;

  constructor(
    @inject('repositories.FileRepository')
    private filerepository: FileRepository,
  ) {}

  async prepareLateXSourceFile(
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    snippets: any,
    exportDir: string,
    user: UserProfile,
  ): Promise<string> {
    this.fs = require('fs');
    this.exportDir = exportDir;
    this.user = user;
    this.imagePath = this.exportDir + '/images/';
    this.fs.mkdirSync(this.imagePath);

    this.texFile = this.exportDir + '/export.tex';
    const fileExport = this.fs.createWriteStream(this.texFile, {
      flags: 'w', // 'a' means appending (old data will be preserved)
    });

    const src = '';
    fileExport.write(this.prepareHeader() + '\r\n');
    for (const s of snippets) {
      this.currentDataSnippet = s;
      // console.log("Handling snippet index type ",index, this.currentDataSnippet.snippetType)
      // write the quotes first
      if (this.currentDataSnippet?.subsnippets) {
        for (const subS of s.subsnippets) {
          this.currentDataSnippet = subS;
          if (
            this.currentDataSnippet?.textcontent &&
            this.currentDataSnippet.linkType === 'quote'
          ) {
            const latexData: string = await this.translate2LaTeX(
              this.currentDataSnippet.textcontent,
            );

            fileExport.write(latexData + '\r\n');
            // console.log("resetting file counter");
            this.fileCounter = 0;
          }
        }
      }
      // write snippet
      this.currentDataSnippet = s;
      if (this.currentDataSnippet?.textcontent) {
        // console.log(this.currentDataSnippet.textcontent);
        const latexData: string = await this.translate2LaTeX(
          this.currentDataSnippet.textcontent,
        );
        // console.log(this.currentDataSnippet.subsnippets)
        // console.log(latexData);
        fileExport.write(latexData + '\r\n');
        // console.log("resetting file counter");
        this.fileCounter = 0;
      }
      // write comments
      if (this.currentDataSnippet?.subsnippets) {
        for (const subS2 of s.subsnippets) {
          this.currentDataSnippet = subS2;
          if (
            this.currentDataSnippet?.textcontent &&
            this.currentDataSnippet.linkType === 'comment'
          ) {
            const latexData: string = await this.translate2LaTeX(
              this.currentDataSnippet.textcontent,
            );
            fileExport.write(latexData + '\r\n');
            // console.log("resetting file counter");
            this.fileCounter = 0;
          }
        }
      }
    }
    fileExport.write(this.writeFooter() + '\r\n');
    fileExport.close();
    return src;
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  compilePDF(): Promise<any> {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
      exec(
        'cd ' +
          this.exportDir +
          '; pdflatex -interaction=nonstopmode ./export.tex',
        (error: string, stdout: string, stderr: string) => {
          if (
            error &&
            stdout.includes(
              'Fatal error occurred, no output PDF file produced!',
            )
          ) {
            console.warn(stdout);
          }

          resolve(stdout ? stdout : stderr);
        },
      );
    });
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  createZipFile(): Promise<any> {
    const exec = require('child_process').exec;
    return new Promise((resolve, reject) => {
      exec(
        'cd ' + this.exportDir + '; zip -r all.zip .',
        (error: string, stdout: string, stderr: string) => {
          if (error) {
            console.warn(error);
          }

          resolve(this.exportDir + '/all.zip');
        },
      );
    });
  }

  private set fileCounter(value: number) {
    if (this.updateFileCounter) {
      this._fileCounter = value;
    }
  }

  private get fileCounter(): number {
    return this._fileCounter;
  }

  private prepareHeader() {
    const header =
      '\\documentclass[11pt, a4paper, abstraction]{scrartcl}\r\n' +
      '%\\usepackage[T1]{fontenc}\r\n' +
      '\\usepackage[utf8]{inputenc}\r\n' +
      '\\usepackage[british]{babel}\r\n' +
      '\\usepackage{graphicx}\r\n' +
      '\\usepackage{subcaption}\r\n' +
      '\\usepackage{verbatim}\r\n' +
      '\\usepackage{sectsty}\r\n' +
      '\\usepackage{pdfpages}\r\n' +
      '\\usepackage{hyperref}\r\n' +
      '\\usepackage{float}\r\n' +
      '\\usepackage{fancyhdr}\r\n\r\n' +
      '\\usepackage{ulem}\r\n\r\n' +
      '% % Header and footer% %\r\n' +
      '\\pagestyle{fancy}\r\n' +
      '\\fancyhf{}\r\n' +
      '\\fancyhead[LE,RO]{\\leftmark}\r\n' +
      '\\fancyhead[RE,LO]{SCILOG - \\today}\r\n' +
      '\\fancyfoot[LE,RO]{\\thepage}\r\n\r\n' +
      '% % Import math tools % %\r\n' +
      '\\usepackage{amsfonts}\r\n' +
      '\\usepackage{amsmath}\r\n' +
      '\\usepackage{amssymb}\r\n' +
      '\\usepackage{mathrsfs}\r\n' +
      '\\usepackage{bm}\r\n' +
      '\\usepackage{upgreek}\r\n\r\n' +
      '% % define layout % %\r\n' +
      '\\usepackage[a4paper]{geometry}\r\n' +
      '\\newgeometry{inner=2.5cm, outer=2.5cm, bottom=3cm, top=2cm, marginparwidth=1.5cm}\r\n\r\n' +
      '% % font color % %\r\n' +
      '\\usepackage{xcolor}\r\n' +
      '\\definecolor{darkblue}{rgb}{0, 0.2, 0.349}\r\n' +
      '\\definecolor{comment}{HTML}{F7F2C5}\r\n' +
      '\\definecolor{quote}{HTML}{ECECEC}\r\n' +
      '\\usepackage[labelfont={color=darkblue,bf}, format=plain]{caption}\r\n\r\n' +
      '\\chapterfont{\\color{darkblue}}\r\n' +
      '\\sectionfont{\\color{darkblue}}\r\n' +
      '\\subsectionfont{\\color{darkblue}}\r\n\r\n' +
      '\\usepackage{csquotes}\r\n\r\n' +
      '% % define hyphenation for fancy words %%\r\n' +
      '\\hyphenation{pty-cho-gra-phy}\r\n' +
      '\\hyphenation{pty-cho-gra-phic}\r\n\r\n' +
      '% % code snippets %%\r\n' +
      '\\usepackage{listings}\r\n' +
      '\\lstset{\r\n  basicstyle=\\ttfamily,\r\n  columns=fullflexible,\r\n  frame=single,\r\n  breaklines=true,\r\n  postbreak=\\mbox{\\textcolor{red}{$\\hookrightarrow$}\\space},\r\n}\r\n' +
      '%\\newcommand{\\bluefont}{\\color{darkblue}}\r\n' +
      '\\newcommand{\\mh}[1]{\\large\\textbf{\\textcolor{darkblue}{#1}}}\r\n\r\n\r\n' +
      '\\setcounter{secnumdepth}{0} \r\n' +
      '\\setlength\\parindent{0pt} \r\n' +
      '\\begin{document}';
    return header;
  }

  private writeFooter() {
    const footer = '\\end{document}';
    return footer;
  }

  private replaceSpecial(nodeValue: string) {
    return nodeValue.replace(/[_#%]/g, '\\$&');
  }

  private async translate2LaTeX(inputString: string): Promise<string> {
    let out = '';
    const jsdom = require('jsdom');
    const {JSDOM} = jsdom;
    const dom = new JSDOM('<!DOCTYPE html>' + inputString + '');
    const element = dom.window.document.querySelector('body');
    const treeObject = {};
    if (
      this.currentDataSnippet.linkType === 'comment' ||
      this.currentDataSnippet.linkType === 'quote'
    ) {
      const tag = await this.translateHTMLTags(
        this.currentDataSnippet.linkType,
      );
      out += tag.header;
      out += await this.unpackHTML(element, treeObject);
      out += tag.footer;
    } else {
      out += await this.unpackHTML(element, treeObject);
    }

    return out;
  }

  // eslint-disable-next-line  @typescript-eslint/no-explicit-any
  private async unpackHTML(element: any, object: any): Promise<string> {
    const nodeList = element.childNodes;
    let content = '';
    if (nodeList != null) {
      if (nodeList.length) {
        object[element.nodeName] = []; // IMPT: empty [] array for parent node to push non-text recursivable elements (see below)

        for (const n of nodeList) {
          // console.log("nodeName", nodeList[i].className);
          let nodeTag = await this.translateHTMLTags(n.nodeName, n);
          this.checkTableCounter(n.nodeName);
          let tmpContent = '';
          if (n.nodeType === 3) {
            // if child node is **final base-case** text node
            // console.log("nodeValue", nodeList[i].nodeValue);
            tmpContent = this.replaceSpecial(n.nodeValue);
            // content += tmpContent;
          } else {
            object[element.nodeName].push({}); // push {} into empty [] array where {} for recursivable elements
            tmpContent = await this.unpackHTML(
              n,
              object[element.nodeName][object[element.nodeName].length - 1],
            );
          }
          if (nodeTag.waitUntilRead) {
            // recalculate nodeTag before appending the content
            this.updateFileCounter = false;
            nodeTag = await this.translateHTMLTags(n.nodeName, n);
            this.updateFileCounter = true;
          }
          content = this.sumContents(nodeTag, tmpContent, content);
        }
      }
    }
    return content;
  }

  private sumContents(nodeTag: LateXTag, tmpContent: string, content: string) {
    if (
      nodeTag.header === '\\begin{verbatim}\r\n' &&
      tmpContent.startsWith('\\begin{verbatim}\r\n')
    ) {
      content += tmpContent;
    } else if (
      nodeTag.header.startsWith('\\href{') &&
      tmpContent.includes('\\begin{center}\r\n')
    ) {
      const begin = '\\begin{center}\r\n';
      const position = tmpContent.lastIndexOf(begin) + begin.length;
      content += `${tmpContent.substring(0, position)}${
        nodeTag.header
      }${tmpContent.substring(position)}`.replace(
        /(\\end{center}\r\n)/,
        `${nodeTag.footer}$1`,
      );
    } else {
      content += nodeTag.header;
      content += tmpContent;
      content = this.appendContent(content, nodeTag.footer, nodeTag);
    }
    return content;
  }

  private checkTableCounter(tagName: string) {
    switch (tagName) {
      case 'TR':
        this.tableColumnsCounter = 0;
        break;
      case 'TD':
        this.tableColumnsCounter++;
        break;
    }
  }

  private appendContent(
    content: string,
    data: string,
    nodeTag: LateXTag,
  ): string {
    if (nodeTag.position < 0) {
      // console.log("oldContent:", content);
      content = content.slice(0, nodeTag.position);
      // console.log("newContent:", content);
      return (content += data);
    } else {
      return (content += data);
    }
  }

  private async translateHTMLTags(
    nodeName: string,
    // eslint-disable-next-line  @typescript-eslint/no-explicit-any
    node: any = null,
  ): Promise<LateXTag> {
    const out: LateXTag = {
      header: '',
      footer: '',
      waitUntilRead: false,
      position: 0,
    };

    switch (nodeName) {
      case 'H1':
        // H1 headers are mapped to H2 in CKeditor...
        break;
      case 'H2':
        out.header = '\\section{';
        out.footer = '}\r\n';
        break;
      case 'H3':
        out.header = '\\subsection{';
        out.footer = '}\r\n';
        break;
      case 'H4':
        out.header = '\\subsubsection{';
        out.footer = '}\r\n';
        break;
      case 'P':
        out.header = '';
        out.footer = '\\\\\r\n';
        break;
      case 'FIGURE':
        //FIXME: images within tables are currently not supported. They should get a \begin{minipage}{.3\textwidth} instead of \begin{figure}
        if (
          this.currentDataSnippet.files[this.fileCounter]?.className &&
          this.currentDataSnippet.files[this.fileCounter].className.includes(
            'image',
          )
        ) {
          out.header = '\\begin{figure}[H]\r\n\\begin{center}\r\n';
          out.footer = '\\end{center}\r\n\\end{figure}\r\n';
        } else {
          out.header = '\\begin{center}\r\n';
          out.footer = '\\end{center}\r\n';
        }

        break;
      case 'IMG': {
        // console.log(this.currentDataSnippet.files[this.fileCounter].style.width);
        let width: string;
        // eslint-disable-next-line  @typescript-eslint/no-explicit-any
        const currentFile = this.currentDataSnippet.files.find((file: any) => {
          return file.fileHash === node.title;
        });
        if (typeof currentFile == 'undefined') {
          break;
        }
        if (currentFile.style.width) {
          width = (parseFloat(currentFile.style.width) / 100).toFixed(2);
        } else {
          width = '0.6';
        }
        const fileExt = currentFile.fileExtension.split('/')[1];

        // translate snippet fileid to gridfs fileid from _fileid
        const data = await this.filerepository.findById(
          currentFile.fileId,
          undefined,
          {currentUser: this.user},
        );
        const filename = data._fileId;

        // copy gridfs contained images to temporary export folder
        if (this.updateFileCounter) {
          const bucket = new Mongo.GridFSBucket(
            this.filerepository.dataSource.connector?.db,
          );
          // the file extension needs to be added to make latex happy
          bucket
            .openDownloadStream(filename)
            .pipe(
              this.fs.createWriteStream(
                this.imagePath + filename + '.' + fileExt,
              ),
            );
        }
        out.header =
          '\\includegraphics[width=' +
          width +
          '\\linewidth]{' +
          this.imagePath +
          filename +
          '.' +
          fileExt +
          '}\r\n';
        if (this.updateFileCounter) {
          this.fileCounter++;
        }
        break;
      }
      case 'STRONG':
        out.header = '\\textbf{';
        out.footer = '}';
        break;
      case 'I':
        out.header = '\\textit{';
        out.footer = '}';
        break;
      case 'OL':
        out.header = '\\begin{enumerate}\r\n';
        out.footer = '\\end{enumerate}\r\n';
        break;
      case 'UL':
        out.header = '\\begin{itemize}\r\n';
        out.footer = '\\end{itemize}\r\n';
        break;
      case 'LI':
        out.header = '\\item ';
        out.footer = '\r\n';
        break;
      case 'TABLE': {
        let tableOptions = '{|';
        for (let index = 0; index < this.tableColumnsCounter; index++) {
          tableOptions += 'c|';
        }
        tableOptions += '}';
        out.header = '\\begin{tabular}' + tableOptions + '\r\n\\hline ';
        out.footer = '\\end{tabular}\r\n';
        out.waitUntilRead = true;
        // console.log(this.tableColumnsCounter);
        break;
      }
      case 'TBODY':
        break;
      case 'TR':
        out.footer = '\\\\\\hline\r\n';
        out.position = -1;
        break;
      case 'TD':
        out.footer = '&';
        break;
      case 'TH':
        break;
      case '#text':
        break;
      case 'FIGCAPTION':
        out.header = '\\caption{';
        out.footer = '}\r\n';
        break;
      case 'comment':
        out.header =
          '\\hfill\r\n\\colorbox{comment}{\\begin{minipage}{0.8\\textwidth}';
        out.footer = '\\end{minipage}}\\\\';
        break;
      case 'quote':
        out.header =
          '\\hfill\r\n\\colorbox{quote}{\\begin{minipage}{\\textwidth}';
        out.footer = '\\end{minipage}}\\\\';
        break;
      case 'MARK':
        if (node != null) {
          const color = node.className.split('-');
          if (color.length > 0) {
            out.header = '\\colorbox{' + color[1] + '}{';
            out.footer = '}';
          }
        }
        break;
      case 'BR':
        out.footer = '\\\\';
        break;
      case 'A':
        // console.log(node.href);
        out.header = '\\href{' + node.href + '}{';
        out.footer = '}\r\n';
        break;
      case 'U':
        out.header = '\\underline{';
        out.footer = '}';
        break;
      case 'SUB':
        out.header = '\\textsubscript{';
        out.footer = '}';
        break;
      case 'SUP':
        out.header = '\\textsuperscript{';
        out.footer = '}';
        break;
      case 'S':
        out.header = '\\sout{';
        out.footer = '}';
        break;
      default:
        console.log('unknown tag:', nodeName);
        out.header = '\\begin{verbatim}\r\n';
        out.footer = '\\end{verbatim}\r\n';
    }
    return out;
  }
}

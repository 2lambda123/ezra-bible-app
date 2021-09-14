/* This file is part of Ezra Bible App.

   Copyright (C) 2019 - 2021 Ezra Bible App Development Team <contact@ezrabibleapp.net>

   Ezra Bible App is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 2 of the License, or
   (at your option) any later version.

   Ezra Bible App is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with Ezra Bible App. See the file LICENSE.
   If not, see <http://www.gnu.org/licenses/>. */

const marked = require('marked');
const i18nHelper = require('../helpers/i18n_helper.js');
const { parseHTML } = require('../helpers/ezra_helper.js');

/**
 * The ExportController implements the export of certain verses with notes or tags into a Word document.
 *
 * @category Controller
 */


var exportFilePath;
var docx;

module.exports.showSaveDialog = async function (fileTitle) {
  const dialog = require('electron').remote.dialog;
  var dialogOptions = getExportDialogOptions(fileTitle);

  return dialog.showSaveDialog(null, dialogOptions).then(result => {
    exportFilePath = result.filePath;

    if (!result.canceled && exportFilePath != undefined) {
      return exportFilePath;
    } else {
      return null;
    }
  });
};

module.exports.saveWordDocument = async function (title, verses, bibleBooks=undefined, notes={}) {
  if (!exportFilePath) {
    console.log('Export error: exportFilePath is not defined with showSaveDialog()');
  }

  docx = require("docx");


  // // Officegen calling this function after finishing to generate the docx document:
  // docx.on('finalize', (written) => {
  //   shell.openPath(exportFilePath);
  // });

  // // Officegen calling this function to report errors:
  // docx.on('error', function(err) {
  //   console.log(err);
  // });

  const titleP = new docx.Paragraph({
    text: title,
    heading: docx.HeadingLevel.TITLE
  });

  // addMarkdown(p, `# ${title}`);
  // p.addLineBreak();

  var children = [titleP];

  if (bibleBooks && Array.isArray(bibleBooks)) {
    for (const currentBook of bibleBooks) {

      const bookTitle = await i18nHelper.getSwordTranslation(currentBook.longTitle);

      // p.addText(bookTitle, { bold: true });
      // p.addLineBreak();

      const allBlocks = getBibleBookVerseBlocks(currentBook, verses);
      const blockParagraphs = await renderVerseBlocks(allBlocks, currentBook, notes);

      children.push(
        new docx.Paragraph({
          text: bookTitle,
          heading: docx.HeadingLevel.HEADING_3,
          spacing: {before: 200},
        }),
        ...blockParagraphs
      );
    }
  } else {
    const allBlocks = getBookBlockByChapter(verses);
    const chapterParagraphs = await renderVerseBlocks(allBlocks, undefined, notes);
    children.push(...chapterParagraphs);
  }

  const footers = await addBibleTranslationInfo();

  const titleFragment = parseHTML(marked(title));

  var doc = new docx.Document({
    title: titleFragment.textContent,
    creator: 'Ezra Bible App',
    description: 'Automatically generated by Ezra Bible App',
    sections: [{
      children,
      footers,
    }],
    // pageMargins: {
    //   top: 1200,
    //   bottom: 1200,
    //   left: 1000,
    //   right: 1000
    // }
  });

  console.log("Generating word document " + exportFilePath);
  const buffer = await docx.Packer.toBuffer(doc);

  const fs = require('fs/promises');
  await fs.writeFile(exportFilePath, buffer);

  const shell = require('electron').shell;
  shell.openPath(exportFilePath);
  // var out = fs.createWriteStream(exportFilePath);

  // out.on('error', function(err) {
  //   console.log(err);
  // });

  // Async call to generate the output file:
  // docx.generate(out);
};


function getExportDialogOptions(title) {
  const app = require('electron').remote.app;
  var today = new Date();
  var month = getPaddedNumber(today.getMonth() + 1);
  var day = getPaddedNumber(today.getDate());
  var date = today.getFullYear() + '_' + month + '_' + day;
  var fileName = date + '__' + title + '.docx';

  var dialogOptions = {
    defaultPath: app.getPath('documents') + '/' + fileName,
    title: i18n.t("tags.export-tagged-verse-list"),
    buttonLabel: i18n.t("tags.run-export")
  };

  return dialogOptions;
}

function getPaddedNumber(number) {
  var paddedNumber = "" + number;
  if (number < 10) {
    paddedNumber = "0" + number;
  }
  return paddedNumber;
}

function getBibleBookVerseBlocks(bibleBook, verses) {
  var lastVerseNr = 0;
  var allBlocks = [];
  var currentBlock = [];

  // Transform the list of verses into a list of verse blocks (verses that belong together)
  for (let j = 0; j < verses.length; j++) {
    const currentVerse = verses[j];

    if (currentVerse.bibleBookShortTitle == bibleBook.shortTitle) {

      if (currentVerse.absoluteVerseNr > (lastVerseNr + 1)) {
        if (currentBlock.length > 0) {
          allBlocks.push(currentBlock);
        }
        currentBlock = [];
      }

      currentBlock.push(currentVerse);
      lastVerseNr = currentVerse.absoluteVerseNr;
    }
  }

  allBlocks.push(currentBlock);

  return allBlocks;
}

function getBookBlockByChapter(verses) {
  var prevVerseChapter;
  var allBlocks = [];
  var currentBlock = [];

  for (const currentVerse of verses) {

    if (currentVerse.chapter != prevVerseChapter) {
      prevVerseChapter = currentVerse.chapter;
      if (currentBlock.length > 0) {
        allBlocks.push(currentBlock);
        currentBlock = [];
      }
    }

    currentBlock.push(currentVerse);
  }

  allBlocks.push(currentBlock);

  return allBlocks;
}

async function renderVerseBlocks(verseBlocks, bibleBook = undefined, notes = {}) {
  const bibleTranslationId = app_controller.tab_controller.getTab().getBibleTranslationId();
  const separator = await i18nHelper.getReferenceSeparator(bibleTranslationId);

  const notesStyle = { color: '2779AA' };

  var paragraphs = [];

  for (let j = 0; j < verseBlocks.length; j++) {
    const currentBlock = verseBlocks[j];

    const firstVerse = currentBlock[0];
    const lastVerse = currentBlock[currentBlock.length - 1];

    if (j === 0) {
      const bookReferenceId = firstVerse.bibleBookShortTitle.toLowerCase();
      if (notes[bookReferenceId]) {
        // addMarkdown(paragraph, notes[bookReferenceId].text, notesStyle);
        // paragraph.addLineBreak();
      }
    }

    if (bibleBook) { // Output the verse reference of this block
      const bookTitle = await i18nHelper.getSwordTranslation(bibleBook.longTitle);
      // paragraph.addText(bookTitle);
      // paragraph.addText(" " + firstVerse.chapter + separator + firstVerse.verseNr);

      if (currentBlock.length >= 2) { // At least 2 verses, a bigger block
        let secondRef = "";

        if (lastVerse.chapter == firstVerse.chapter) {
          secondRef = "-" + lastVerse.verseNr;
        } else {
          secondRef = " - " + lastVerse.chapter + separator + lastVerse.verseNr;
        }

        // paragraph.addText(secondRef);
      }
      // paragraph.addLineBreak();
    } else if (verseBlocks.length > 1) { // Output chapter reference
      // paragraph.addText(firstVerse.chapter.toString(), { bold: true });
    }

    const verseParagraphs = currentBlock.map(renderVerse);
    // const referenceId = `${currentVerse.bibleBookShortTitle.toLowerCase()}-${currentVerse.absoluteVerseNr}`;
    // if (notes[referenceId]) {
    //   addMarkdown(paragraph, notes[referenceId].text, notesStyle);
    // }

    // Line break after block end
    paragraphs.push(...verseParagraphs, new docx.Paragraph(""));
  }

  return paragraphs;
}

function renderVerse(verse) {

  let currentVerseContent = "";
  const fixedContent = verse.content.replace(/<([a-z]+)(\s?[^>]*?)\/>/g, '<$1$2></$1>'); // replace self clothing tags FIXME: Should it be in the NSI?
  const currentVerseNodes = parseHTML(fixedContent).childNodes;

  // currentVerseContent = currentVerseNodes.reduce((prevContent, currentNode) => {
  //   // We export everything that is not a DIV
  //   // DIV elements contain markup that should not be in the word document
  //   return currentNode.nodeName !== 'DIV' ? prevContent + currentNode.textContent : prevContent;
  // }, "");

  for (let i = 0; i < currentVerseNodes.length; i++) {
    const currentNode = currentVerseNodes[i];
    const currentNodeName = currentNode.nodeName;
    // We export everything that is not a DIV
    // DIV elements contain markup that should not be in the word document
    if (currentNodeName != 'DIV') {
      currentVerseContent += currentNode.textContent;
    }
  }

  return new docx.Paragraph({
    children: [
      new docx.TextRun({text: verse.verseNr, superScript: true}),
      new docx.TextRun(" " + currentVerseContent)
    ]
  });

}

function addMarkdown(paragraph, markdown, options = {}) {
  convertMarkDownTokens(paragraph, marked.lexer(markdown), options);
  paragraph.addLineBreak();
}

// https://marked.js.org/using_pro#lexer
function convertMarkDownTokens(paragraph, tokenArr, options = {}) {
  for (const token of tokenArr) {
    let tokenOptions = {};
    switch (token.type) {
      case 'em':
        tokenOptions.italic = true;
        break;
      case 'strong':
        tokenOptions.bold = true;
        break;
      case 'codespan':
        tokenOptions.highlight = 'yellow';
        break;
      case 'hr':
      case 'space':
        paragraph.addLineBreak();
        break;
      case 'heading':
        tokenOptions.bold = true;
        tokenOptions.font_size = 14 - (token.depth - 1); // FIXME: this is not the best representation of the headings
        break;
      case 'link':
        // tokenOptions.link = token.href; // FIXME: this should work, but it doesn't: https://github.com/Ziv-Barber/officegen/tree/master/manual/docx#prgapi
        break;
    }

    if (token.tokens) {
      convertMarkDownTokens(paragraph, token.tokens, { ...options, ...tokenOptions });
    } else if (token.items) {
      convertMarkDownTokens(paragraph, token.items, { ...options, ...tokenOptions });
    } else if (token.text) {
      paragraph.addText(token.text, { ...options, ...tokenOptions });
    }

    // Link hack
    if (token.type == 'link' && token.href) {
      paragraph.addText(`(${token.href})`);
    }

    // Add line break after block tokens
    if (['paragraph', 'heading', 'blockquote', 'list_item'].includes(token.type)) {
      paragraph.addLineBreak();
    }
  }
}

async function addBibleTranslationInfo() {
  const bibleTranslationId = app_controller.tab_controller.getTab().getBibleTranslationId();
  const swordModule = await ipcNsi.getLocalModule(bibleTranslationId);
  const copyright = swordModule.shortCopyright || swordModule.copyright;

  const children = [
    new docx.TextRun(`${i18n.t("general.scripture-quote-from")} `),
    new docx.TextRun({ text: swordModule.description, bold: true }),
    swordModule.distributionLicense ? new docx.TextRun(` (${swordModule.distributionLicense})`) : undefined,
    copyright ? new docx.TextRun({ text: copyright, break: 1 }) : undefined
  ];

  return {
    default: new docx.Footer({
      children: [
        new docx.Paragraph({
          children
        })
      ]
    })
  };
}
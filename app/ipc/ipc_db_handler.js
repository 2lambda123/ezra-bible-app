/* This file is part of Ezra Project.

   Copyright (C) 2019 - 2020 Tobias Klein <contact@ezra-project.net>

   Ezra Project is free software: you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation, either version 2 of the License, or
   (at your option) any later version.

   Ezra Project is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License
   along with Ezra Project. See the file LICENSE.
   If not, see <http://www.gnu.org/licenses/>. */

const { app } = require('electron');
const IpcMain = require('./ipc_main.js');

let dbHelper = null;
let dbDir = null;

class IpcDbHandler {
  constructor() {
    this._ipcMain = new IpcMain();
    this._tagsPersistanceController = null;

    this.initIpcInterface();
  }

  async initDatabase() {
    const DbHelper = require.main.require('./app/helpers/db_helper.js');
    const userDataDir = app.getPath('userData');
    dbHelper = new DbHelper(userDataDir);
    dbDir = dbHelper.getDatabaseDir();

    await dbHelper.initDatabase(dbDir);
    global.models = require.main.require('./app/database/models')(dbDir);

    const TagsPersistanceController = require.main.require('./app/controllers/tags_persistance_controller.js');
    this._tagsPersistanceController = new TagsPersistanceController(global.models);
  }

  initIpcInterface() {
    this._ipcMain.add('db_createNewTag', async (newTagTitle, type) => {
      return await this._tagsPersistanceController.create_new_tag(newTagTitle, type);
    });

    this._ipcMain.add('db_removeTag', async (id) => {
      return await this._tagsPersistanceController.destroy_tag(id);
    });

    this._ipcMain.add('db_updateTag', async(id, newTitle) => {
      return await this._tagsPersistanceController.update_tag(id, newTitle);
    });

    this._ipcMain.add('db_updateTagsOnVerses', async (tagId, verseObjects, versification, action) => {
      return await this._tagsPersistanceController.update_tags_on_verses(tagId, verseObjects, versification, action);
    });

    this._ipcMain.add('db_getTagCount', async () => {
      return await models.Tag.getTagCount();
    });

    this._ipcMain.add('db_getAllTags', async (bibleBookId, lastUsed, onlyStats) => {
      var allSequelizeTags = await models.Tag.getAllTags(bibleBookId, lastUsed, onlyStats);
      var allTags = this.makeSequelizeResultsSerializable(allSequelizeTags);
      return allTags;
    });

    this._ipcMain.add('db_getBookVerseTags', async (bibleBookId, versification) => {
      var bibleBook = await models.BibleBook.findByPk(bibleBookId);
      var sequelizeVerseTags = await bibleBook.getVerseTags();
      var verseTags = this.makeSequelizeResultsSerializable(sequelizeVerseTags);
      var groupedVerseTags = models.VerseTag.groupVerseTagsByVerse(verseTags, versification);
      return groupedVerseTags;
    });

    this._ipcMain.add('db_getVerseTagsByVerseReferenceIds', async (verseReferenceIds, versification) => {
      var sequelizeVerseTags = await models.VerseTag.findByVerseReferenceIds(verseReferenceIds.join(','));
      var verseTags = this.makeSequelizeResultsSerializable(sequelizeVerseTags);
      var groupedVerseTags = models.VerseTag.groupVerseTagsByVerse(verseTags, versification);
      return groupedVerseTags;
    });

    this._ipcMain.add('db_persistNote', async (noteValue, verseObject) => {
      var sequelizeNote = await models.Note.persistNote(noteValue, verseObject);
      var note = undefined;

      if (sequelizeNote !== undefined) {
        note = sequelizeNote.dataValues;
      }

      return note;
    });

    this._ipcMain.add('db_getVerseNotesByBook', async (bibleBookId, versification) => {
      var bibleBook = await models.BibleBook.findByPk(bibleBookId);
      var sequelizeNotes = await bibleBook.getNotes();
      var notes = this.makeSequelizeResultsSerializable(sequelizeNotes);
      var groupedVerseNotes = models.Note.groupNotesByVerse(notes, versification);
      return groupedVerseNotes;
    });

    this._ipcMain.add('db_getBookNotes', async (shortTitle) => {
      var bookNotes = null;
      var bookReference = await models.VerseReference.getBookReference(shortTitle);

      if (bookReference != null) {
        bookNotes = await models.Note.findByVerseReferenceId(bookReference.id);

        if (bookNotes != null) {
          bookNotes = bookNotes.dataValues;
        }
      }

      return bookNotes;
    });

    this._ipcMain.add('db_getNotesByVerseReferenceIds', async (verseReferenceIds, versification) => {
      var sequelizeNotes = await models.Note.findByVerseReferenceIds(verseReferenceIds.join(','));
      var notes = this.makeSequelizeResultsSerializable(sequelizeNotes);
      var groupedNotes = models.Note.groupNotesByVerse(notes, versification);
      return groupedNotes;
    });

    this._ipcMain.add('db_getBibleBook', async (shortTitle) => {
      var sequelizeBibleBook = await models.BibleBook.findOne({ where: { shortTitle: shortTitle }});
      var bibleBook = null;
      
      if (sequelizeBibleBook != null) {
        bibleBook = sequelizeBibleBook.dataValues;
      }
      
      return bibleBook;
    });

    this._ipcMain.add('db_getBibleBooksFromSearchResults', async (searchResults) => {
      var sequelizeBibleBooks = await models.BibleBook.findBySearchResults(searchResults);
      var bibleBooks = this.makeSequelizeResultsSerializable(sequelizeBibleBooks);
      return bibleBooks;
    });

    this._ipcMain.add('db_getBibleBooksFromTagIds', async (tagIds) => {
      var sequelizeBibleBooks = await models.BibleBook.findByTagIds(tagIds);
      var bibleBooks = this.makeSequelizeResultsSerializable(sequelizeBibleBooks);
      return bibleBooks;
    });

    this._ipcMain.add('db_getBibleBooksFromXrefs', async (xrefs) => {
      var sequelizeBibleBooks = await models.BibleBook.findByXrefs(xrefs);
      var bibleBooks = this.makeSequelizeResultsSerializable(sequelizeBibleBooks);
      return bibleBooks;
    });

    this._ipcMain.add('db_getBookTitleTranslation', async (shortTitle, language) => {
      return await models.BibleBook.getBookTitleTranslation(shortTitle, language);
    });

    this._ipcMain.add('db_getBookLongTitle', async (shortTitle) => {
      return await models.BibleBook.getBookLongTitle(shortTitle);
    });

    this._ipcMain.add('db_findBookTitle', async(title) => {
      return await models.BibleBook.findBookTitle(title);
    });

    this._ipcMain.add('db_isNtBook', async (bookCode) => {
      return models.BibleBook.isNtBook(bookCode);
    });

    this._ipcMain.add('db_isOtBook', async (bookCode) => {
      return models.BibleBook.isOtBook(bookCode);
    });

    this._ipcMain.add('db_getVerseReferencesByBookAndAbsoluteVerseNumber', async (bookShortTitle, absoluteVerseNr, versification) => {
      var sequelizeVerseReferences = await models.VerseReference.findByBookAndAbsoluteVerseNumber(bookShortTitle, absoluteVerseNr, versification);
      var verseReferences = this.makeSequelizeResultsSerializable(sequelizeVerseReferences);
      return verseReferences;
    });

    this._ipcMain.add('db_getVerseReferencesByTagIds', async (tagIds) => {
      var sequelizeVerseReferences = await models.VerseReference.findByTagIds(tagIds);
      var verseReferences = this.makeSequelizeResultsSerializable(sequelizeVerseReferences);
      return verseReferences;
    });

    this._ipcMain.add('db_getVerseReferencesByXrefs', async (xrefs) => {
      var sequelizeVerseReferences = await models.VerseReference.findByXrefs(xrefs);
      var verseReferences = this.makeSequelizeResultsSerializable(sequelizeVerseReferences);
      return verseReferences;
    });

    this._ipcMain.add('db_getAbsoluteVerseNumbersFromReference', async (sourceVersification, bookCode, absoluteVerseNr, chapter, verseNr) => {
      var absoluteVerseNumbers = models.VerseReference.getAbsoluteVerseNrs(sourceVersification,
                                                                           bookCode,
                                                                           absoluteVerseNr,
                                                                           chapter,
                                                                           verseNr);
      return absoluteVerseNumbers;
    });

    this._ipcMain.add('db_getLastMetaRecordUpdate', async() => {
      var lastUpdate = await models.MetaRecord.getLastUpdate();
      return lastUpdate;
    });
  }

  makeSequelizeResultsSerializable(sequelizeResults) {
    var results = [];

    sequelizeResults.forEach((result) => {
      results.push(result.dataValues);
    });

    return results;
  }
}

module.exports = IpcDbHandler;
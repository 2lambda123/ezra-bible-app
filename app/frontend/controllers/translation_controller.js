/* This file is part of Ezra Bible App.

   Copyright (C) 2019 - 2022 Ezra Bible App Development Team <contact@ezrabibleapp.net>

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

const i18nHelper = require('../helpers/i18n_helper.js');
const eventController = require('../controllers/event_controller.js');
const { sleep } = require('../helpers/ezra_helper.js');
const verseListController = require('../controllers/verse_list_controller.js');

const INSTANT_LOADING_CHAPTER_LIMIT = 15;
   

/**
 * The TranslationController is used to handle the bible translation menu and to
 * access and generate various information about installed bible translations.
 * 
 * Like all other controllers it is only initialized once. It is accessible at the
 * global object `app_controller.translation_controller`.
 * 
 * @category Controller
 */
class TranslationController {
  constructor() {
    this.translationCount = null;
    this.initBibleSyncBoxDone = false;

    eventController.subscribe('on-bible-text-loaded', async (tabIndex) => {
      await this.toggleTranslationsBasedOnCurrentBook(tabIndex);
    });

    eventController.subscribe('on-tab-selected', async (tabIndex) => {
      await this.initTranslationsMenu(-1, tabIndex);
    });

    // eslint-disable-next-line no-unused-vars
    eventController.subscribe('on-translation-removed', async (translationId) => {
      $("select#bible-select").empty();
      await this.initTranslationsMenu();
    });
  }

  getTranslationCount() {
    return this.translationCount;
  }

  initBibleSyncBox() {
    if (this.initBibleSyncBoxDone) {
      return;
    }

    this.initBibleSyncBoxDone = true;

    $('#bible-sync-box').dialog({
      width: 600,
      height: 300,
      autoOpen: false,
      modal: true,
      title: i18n.t("module-sync.module-sync-header"),
      dialogClass: 'bible-sync-dialog'
    });
  }

  initVerseSelection() {
    app_controller.verse_selection.initHelper(ipcNsi);
  }

  async loadSettings() {
    await app_controller.book_selection_menu.updateAvailableBooks();
    this.initVerseSelection();
  }

  getBibleSelect(tabIndex) {
    var currentVerseListMenu = app_controller.getCurrentVerseListMenu(tabIndex);

    if (currentVerseListMenu != null) {
      var bibleSelect = currentVerseListMenu.find('select.bible-select');
      return bibleSelect;
    } else {
      return null;
    }
  }

  async addLanguageGroupsToBibleSelectMenu(tabIndex, localModules=undefined) {
    var bibleSelect = this.getBibleSelect(tabIndex);
    if (bibleSelect == null) {
      return;
    }

    var languages = await this.getLanguages('BIBLE', localModules);

    for (let i = 0; i < languages.length; i++) {
      let currentLang = languages[i];

      let newOptGroup = "<optgroup class='bible-select-" + currentLang.languageCode + "-translations' label='" + currentLang.languageName + "'></optgroup>";
      bibleSelect.append(newOptGroup);
    }
  }

  updateUiBasedOnNumberOfTranslations(tabIndex, count) {
    var bibleSelect = this.getBibleSelect(tabIndex);
    if (bibleSelect == null) {
      return;
    }

    if (count == 0) {
      bibleSelect.attr('disabled','disabled');
      $('.book-select-button').addClass('ui-state-disabled');
      $('.tag-select-button').addClass('ui-state-disabled');
      $('.module-search-button').addClass('ui-state-disabled');

      let currentVerseList = verseListController.getCurrentVerseList(tabIndex);
      // FIXME: This needs to be adjusted based on the new menu
      currentVerseList.find('.help-text').html(i18n.t("help.help-text-no-translations", { interpolation: {escapeValue: false} }));
    } else {
      $('.bible-select').removeAttr('disabled');
      $('.book-select-button').removeClass('ui-state-disabled');
      $('.module-search-button').removeClass('ui-state-disabled');

      var currentBook = null;
      var currentTagIdList = "";
      var currentSearchTerm = null;

      var currentTab = app_controller.tab_controller.getTab(tabIndex);
      if (currentTab != null) {
        currentBook = currentTab.getBook();
        currentTagIdList = currentTab.getTagIdList();
        currentSearchTerm = currentTab.getSearchTerm();
      }

      if (currentBook == null && currentTagIdList == "" && currentSearchTerm == null)  {
        let currentVerseList = verseListController.getCurrentVerseList(tabIndex);
        currentVerseList.find('.help-text').text(i18n.t("help.help-text-translation-available"));
      }
    }
  }

  addTranslationsToBibleSelectMenu(tabIndex, translations) {
    var bibleSelect = this.getBibleSelect(tabIndex)[0];
    if (bibleSelect == null) {
      return;
    }

    var currentTab = app_controller.tab_controller.getTab(tabIndex);
    var currentBibleTranslationId = null;

    if (currentTab != null) {
      currentBibleTranslationId = currentTab.getBibleTranslationId();
    }

    for (var translation of translations) {
      var currentTranslationEl = document.createElement('option');
      currentTranslationEl.value = translation.name;

      if (platformHelper.isMobile()) {
        currentTranslationEl.innerText = translation.name;
      } else {
        currentTranslationEl.innerText = translation.description;
      }

      if (currentBibleTranslationId == translation.name) {
        currentTranslationEl.selected = "selected";
      }

      var optGroup = bibleSelect.querySelector('.bible-select-' + translation.language + '-translations');
      optGroup.append(currentTranslationEl);
    }
  }

  async initTranslationsMenu(previousTabIndex=-1, tabIndex=undefined) {
    if (tabIndex === undefined) {
      tabIndex = app_controller.tab_controller.getSelectedTabIndex();
    }
    //console.log("initTranslationsMenu " + tabIndex);

    var previousVerseListMenu = null;
    if (previousTabIndex != -1) {
      previousVerseListMenu = app_controller.getCurrentVerseListMenu(previousTabIndex);
    }

    var currentVerseListMenu = app_controller.getCurrentVerseListMenu(tabIndex);
    var bibleSelect = null;

    if (previousVerseListMenu != null && previousVerseListMenu.length > 0) {
      
      var previousBibleSelect = previousVerseListMenu.find('select.bible-select').clone();
      var currentBibleSelect = currentVerseListMenu.find('select.bible-select');
      currentBibleSelect.replaceWith(previousBibleSelect);
      bibleSelect = currentVerseListMenu.find('select.bible-select');

    } else {

      bibleSelect = currentVerseListMenu.find('select.bible-select');
      bibleSelect.empty();

      var translations = await ipcNsi.getAllLocalModules('BIBLE');
      await this.addLanguageGroupsToBibleSelectMenu(tabIndex, translations);

      if (translations == null) translations = [];

      // FIXME: Should be in function
      translations.sort((a, b) => {
        var aDescription = a.description;
        var bDescription = b.description;

        if (aDescription < bDescription) {
          return -1;
        } else if (aDescription > bDescription) {
          return 1;
        } else {
          return 0;
        }
      });

      this.previousTranslationCount = this.translationCount;
      this.translationCount = translations.length;

      if (this.translationCount != this.previousTranslationCount) {
        this.updateUiBasedOnNumberOfTranslations(tabIndex, translations.length);
      }
      
      this.addTranslationsToBibleSelectMenu(tabIndex, translations);
      eventController.subscribe('on-locale-changed', locale => this.updateLanguages(locale, bibleSelect));
    }

    bibleSelect.selectmenu({
      width: platformHelper.isMobile() ? 100 : undefined,
      change: () => {
        if (!app_controller.tab_controller.isCurrentTabEmpty() && app_controller.tab_controller.getTab().getTextType() != 'search_results') {
          uiHelper.showTextLoadingIndicator();
        }

        var currentVerseListMenu = app_controller.getCurrentVerseListMenu();
        var bibleSelect = currentVerseListMenu.find('select.bible-select');

        var oldBibleTranslationId = app_controller.tab_controller.getTab().getBibleTranslationId();
        var newBibleTranslationId = bibleSelect[0].value;

        ipcSettings.set('bibleTranslation', newBibleTranslationId);

        setTimeout(() => {
          eventController.publish('on-translation-changed', {from: oldBibleTranslationId, to: newBibleTranslationId});
        }, 50);
      }
    });

    this.toggleTranslationsBasedOnCurrentBook(tabIndex);

    $('.bible-select-block').find('.ui-selectmenu').bind('click', () => {
      app_controller.hideAllMenus();
    });
  }

  hasCurrentTranslationHeaderElements(tabIndex=undefined) {
    var currentVerseList = verseListController.getCurrentVerseList(tabIndex)[0];
    var query = '.sword-section-title:not([type="chapter"]):not([type="psalm"]):not([type="scope"]):not([type="acrostic"])';
    var allSectionTitles = currentVerseList.querySelectorAll(query);

    return allSectionTitles.length > 0;
  }

  async isStrongsTranslationAvailable() {
    var allTranslations = await ipcNsi.getAllLocalModules();

    if (allTranslations == null) {
      return false;
    }

    for (var dbTranslation of allTranslations) {
      if (dbTranslation.hasStrongs) {
        return true;
      }
    }

    return false;
  }

  async installStrongs(htmlElementForMessages) {
    var message = "<span>" + i18n.t("general.installing-strongs") + " ...</span>";
    htmlElementForMessages.append(message);

    try {
      await ipcNsi.installModule("StrongsHebrew");
      await ipcNsi.installModule("StrongsGreek");
      app_controller.dictionary_controller.runAvailabilityCheck();
      var doneMessage = "<span> " + i18n.t("general.done") + ".</span><br/>";
      htmlElementForMessages.append(doneMessage);
    } catch(e) {
      var errorMessage = "<span> " + i18n.t("general.module-install-failed") + ".</span><br/>";
      htmlElementForMessages.append(errorMessage);
    }
  }

  async installStrongsIfNeeded() {
    //console.time("get sync infos");   
    var strongsAvailable = await ipcNsi.strongsAvailable();
    var strongsInstallNeeded = await this.isStrongsTranslationAvailable() && !strongsAvailable;
    //console.timeEnd("get sync infos");

    if (strongsInstallNeeded) {
      var currentVerseList = verseListController.getCurrentVerseList();
      var verse_list_position = currentVerseList.offset();

      this.initBibleSyncBox();

      $('#bible-sync-box').dialog({
        position: [verse_list_position.left + 50, verse_list_position.top + 30]
      });

      $('#bible-sync-box').dialog("open");
      await sleep(100);
    }

    if (strongsInstallNeeded) {
      await this.installStrongs($('#bible-sync-box'));
    }

    if (strongsInstallNeeded) {
      await sleep(2000);
    }

    $('#bible-sync-box').dialog("close");
  }

  async getLanguages(moduleType='BIBLE', localModules=undefined) {
    if (localModules == undefined) {
      localModules = await ipcNsi.getAllLocalModules(moduleType);
    }

    if (localModules == null) {
      return [];
    }
    
    var languages = [];
    var languageCodes = [];

    for (let i = 0; i < localModules.length; i++) {
      const module = localModules[i];
      const languageName = i18nHelper.getLanguageName(module.language);

      if (!languageCodes.includes(module.language)) {
        languages.push({
          'languageName': languageName,
          'languageCode': module.language
        });
        languageCodes.push(module.language);
      }
    }

    return languages;
  }

  async getInstalledModules(moduleType='BIBLE') {
    var localModules = await ipcNsi.getAllLocalModules(moduleType);
    // FIXME: Should be in function
    localModules.sort((a, b) => {
      var aDescription = a.description;
      var bDescription = b.description;

      if (aDescription < bDescription) {
        return -1;
      } else if (aDescription > bDescription) {
        return 1;
      } else {
        return 0;
      }
    });

    var translations = [];

    for (var i = 0; i < localModules.length; i++) {
      translations.push(localModules[i].name);
    }

    return translations;
  }

  async toggleTranslationsBasedOnCurrentBook(tabIndex=undefined) {
    const bibleSelect = this.getBibleSelect(tabIndex);
    const currentTab = app_controller.tab_controller.getTab(tabIndex);

    if (currentTab != null) {
      let currentBook = currentTab.getBook();
      let previousBook = currentTab.getPreviousBook();

      if (currentBook == previousBook) {
        return;
      }

      let moduleBookStatus = {};

      if (currentBook != null) {
        moduleBookStatus = await ipcNsi.getModuleBookStatus(currentBook);
      }

      let selectOptions = bibleSelect[0].querySelectorAll('option');

      for (let i = 0; i < selectOptions.length; i++) {
        let currentOption = selectOptions[i];
        let currentTextType = currentTab.getTextType();

        if (currentTextType == 'book' && 
            moduleBookStatus != null &&
            currentOption.value in moduleBookStatus &&
            !moduleBookStatus[currentOption.value]) {

          currentOption.disabled = true;
        } else {
          currentOption.disabled = false;
        }
      }

      // Refresh the selectmenu widget
      bibleSelect.selectmenu();
    }
  }

  updateLanguages(localeCode, bibleSelect) {
    if (bibleSelect === null) {
      return;
    }

    let optGroups = bibleSelect.find('optgroup');

    for (let i = 0; i < optGroups.length; i++) {
      let optgroup = optGroups[i];
      const code = optgroup.getAttribute('class').split('-')[2];
      optgroup.setAttribute('label', i18nHelper.getLanguageName(code, false, localeCode));
    }

    // Refresh the selectmenu widget
    bibleSelect.selectmenu();
  }

  async isInstantLoadingBook(bibleTranslationId, bookCode) {
    if (bibleTranslationId == null || bookCode == null) {
      return false;
    }

    var instantLoad = false;
    const bookChapterCount = await ipcNsi.getBookChapterCount(bibleTranslationId, bookCode);
    const bookLoadingModeOption = app_controller.optionsMenu._bookLoadingModeOption;

    switch (bookLoadingModeOption.value) {
      case 'open-complete-book':
        instantLoad = true;
        break;

      case 'open-chapters-large-books':
        if (bookChapterCount <= INSTANT_LOADING_CHAPTER_LIMIT) {
          instantLoad = true;
        }
        break;
    }

    return instantLoad;
  }
}

module.exports = TranslationController;
